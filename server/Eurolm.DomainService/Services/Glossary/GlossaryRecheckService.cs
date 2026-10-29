using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Shared.Events;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Eurolm.DomainService.Services
{
    /// <summary>
    /// Keeps stored key violations in step with the glossary (Phase 8 re-check job). The API queues a job
    /// (coalesced per tenant through a marker document) and publishes <see cref="RecheckGlossaryViolationsEvent"/>;
    /// the worker recomputes violations with the cached matcher and the validator only. Gated by
    /// <c>GlossaryEnforcement:Enabled</c>. Logs counts and ids only.
    /// </summary>
    public class GlossaryRecheckService : IGlossaryRecheckService
    {
        public const int PageSize = 1000;
        /// <summary>A pending marker older than this is assumed lost and is published again.</summary>
        public static readonly TimeSpan StaleAfter = TimeSpan.FromMinutes(30);

        private readonly IGlossaryRecheckJobRepository _jobRepository;
        private readonly IGlossaryRepository _glossaryRepository;
        private readonly IKeyRepository _keyRepository;
        private readonly IGlossaryMatcherCache _matcherCache;
        private readonly IMessageClient _messageClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<GlossaryRecheckService> _logger;

        public GlossaryRecheckService(IGlossaryRecheckJobRepository jobRepository,
                                      IGlossaryRepository glossaryRepository,
                                      IKeyRepository keyRepository,
                                      IGlossaryMatcherCache matcherCache,
                                      IMessageClient messageClient,
                                      IConfiguration configuration,
                                      ILogger<GlossaryRecheckService> logger)
        {
            _jobRepository = jobRepository;
            _glossaryRepository = glossaryRepository;
            _keyRepository = keyRepository;
            _matcherCache = matcherCache;
            _messageClient = messageClient;
            _configuration = configuration;
            _logger = logger;
        }

        private bool IsEnabled => GlossaryEnforcement.IsEnabled(_configuration);

        public Task<bool> QueueAsync(string? glossaryId) =>
            EnqueueAsync(string.IsNullOrWhiteSpace(glossaryId) ? null : new[] { glossaryId.Trim() });

        public async Task TriggerAsync(IReadOnlyCollection<string> glossaryIds)
        {
            if (!IsEnabled) return;
            try
            {
                var ids = glossaryIds?.Where(id => !string.IsNullOrEmpty(id)).Distinct(StringComparer.Ordinal).ToList();
                await EnqueueAsync(ids is { Count: > 0 } ? ids : null);
            }
            catch (Exception ex)
            {
                // The glossary write already succeeded; a missed re-check only leaves violations stale.
                _logger.LogWarning(ex, "Could not queue a glossary re-check for {GlossaryCount} glossaries", glossaryIds?.Count ?? 0);
            }
        }

        private async Task<bool> EnqueueAsync(IReadOnlyList<string>? glossaryIds)
        {
            if (!IsEnabled) return false;

            var tenantId = BlocksContext.GetContext()?.TenantId;
            if (string.IsNullOrEmpty(tenantId)) return false;

            if (!await _jobRepository.TryEnqueueAsync(tenantId, glossaryIds, DateTime.UtcNow, StaleAfter))
            {
                _logger.LogInformation("Glossary re-check already queued for tenant {TenantId}; request merged", tenantId);
                return false;
            }

            try
            {
                await _messageClient.SendToConsumerAsync(new ConsumerMessage<RecheckGlossaryViolationsEvent>
                {
                    // The worker's general listener queue; consumers are resolved by payload type.
                    ConsumerName = Utilities.Constants.UilmQueue,
                    Payload = new RecheckGlossaryViolationsEvent
                    {
                        ProjectKey = tenantId,
                        GlossaryId = glossaryIds is { Count: 1 } ? glossaryIds[0] : null
                    }
                });
            }
            catch
            {
                // Nothing will consume the marker, so drop it; the next request queues a fresh job.
                await _jobRepository.ReleaseAsync(tenantId);
                throw;
            }

            _logger.LogInformation("Glossary re-check queued for tenant {TenantId} ({GlossaryCount} glossaries, whole project {WholeProject})",
                tenantId, glossaryIds?.Count ?? 0, glossaryIds == null);
            return true;
        }

        public async Task<GlossaryRecheckResult> RecheckAsync(RecheckGlossaryViolationsEvent @event)
        {
            ArgumentNullException.ThrowIfNull(@event);
            var result = new GlossaryRecheckResult();
            var tenantId = BlocksContext.GetContext()?.TenantId ?? @event.ProjectKey ?? "";

            // Claim first, so glossary edits made while this job runs queue the next one.
            var job = await _jobRepository.ClaimAsync(tenantId);
            if (!IsEnabled)
            {
                _logger.LogInformation("Glossary re-check skipped for tenant {TenantId}: enforcement is off", tenantId);
                return result;
            }

            var defaultCulture = (await _keyRepository.GetLanguageSettingAsync(tenantId))?.LanguageCode;
            if (string.IsNullOrEmpty(defaultCulture))
            {
                _logger.LogInformation("Glossary re-check skipped for tenant {TenantId}: no default language", tenantId);
                return result;
            }

            var scope = await ResolveScopeAsync(job, @event.GlossaryId);

            // Always rebuild: the API process invalidated its own cache, not this one.
            _matcherCache.Invalidate(tenantId);
            var matcher = await _matcherCache.GetAsync(tenantId);
            result.Ran = true;

            string? after = null;
            while (true)
            {
                var keys = await _keyRepository.GetKeysForGlossaryRecheckAsync(scope, after, PageSize);
                if (keys.Count == 0) break;

                var now = DateTime.UtcNow;
                var updates = new List<(string KeyId, List<KeyGlossaryViolation> Violations)>();
                foreach (var key in keys)
                {
                    result.Checked++;
                    try
                    {
                        var computed = GlossaryTerminologyService.ComputeKeyViolations(key, matcher, defaultCulture, now);
                        var merged = KeepDetectedAt(key.GlossaryViolations, computed);
                        if (merged != null) updates.Add((key.ItemId, merged));
                    }
                    catch (Exception ex)
                    {
                        // This key keeps its stored violations; the rest of the job goes on.
                        result.Failed++;
                        _logger.LogWarning(ex, "Glossary re-check failed for key {KeyId}; stored violations kept", key.ItemId);
                    }
                }

                if (updates.Count > 0)
                {
                    try
                    {
                        await _keyRepository.SetGlossaryViolationsManyAsync(updates);
                        result.Updated += updates.Count;
                    }
                    catch (Exception ex)
                    {
                        result.Failed += updates.Count;
                        _logger.LogWarning(ex, "Glossary re-check could not store violations for {KeyCount} keys after key {AfterKeyId}", updates.Count, after);
                    }
                }

                after = keys[^1].ItemId;
                if (keys.Count < PageSize) break;
            }

            _logger.LogInformation(
                "Glossary re-check for tenant {TenantId} done: {Checked} keys checked, {Updated} updated, {Failed} failed (whole project {WholeProject})",
                tenantId, result.Checked, result.Updated, result.Failed, scope == null);
            return result;
        }

        /// <summary>
        /// Null (every key) when the whole project was asked for or any of the glossaries is global; otherwise
        /// the glossaries' tagged keys, keys in their modules, and keys with stored violations of them.
        /// </summary>
        private async Task<GlossaryRecheckKeyScope?> ResolveScopeAsync(GlossaryRecheckJob? job, string? eventGlossaryId)
        {
            var ids = new HashSet<string>(StringComparer.Ordinal);
            if (job != null)
            {
                if (job.WholeProject) return null;
                ids.UnionWith(job.GlossaryIds ?? new List<string>());
            }
            if (!string.IsNullOrEmpty(eventGlossaryId)) ids.Add(eventGlossaryId);
            if (ids.Count == 0) return null;

            var glossaries = await _glossaryRepository.GetStoredByIdsAsync(ids);
            if (glossaries.Any(g => g.IsGlobal)) return null;

            return new GlossaryRecheckKeyScope
            {
                GlossaryIds = ids.ToList(),
                ModuleIds = glossaries.SelectMany(g => g.ModuleIds ?? new List<string>()).Distinct(StringComparer.Ordinal).ToList()
            };
        }

        /// <summary>
        /// Null when the recomputed violations equal the stored ones (no write). Otherwise the recomputed list,
        /// where a violation that was already stored keeps its original DetectedAt.
        /// </summary>
        public static List<KeyGlossaryViolation>? KeepDetectedAt(List<KeyGlossaryViolation>? stored, List<KeyGlossaryViolation> computed)
        {
            stored ??= new List<KeyGlossaryViolation>();
            var storedByIdentity = stored
                .GroupBy(Identity)
                .ToDictionary(g => g.Key, g => g.First().DetectedAt);

            var unchanged = stored.Count == computed.Count
                && stored.Select(Identity).OrderBy(i => i, StringComparer.Ordinal).SequenceEqual(computed.Select(Identity).OrderBy(i => i, StringComparer.Ordinal));
            if (unchanged) return null;

            foreach (var violation in computed)
            {
                if (storedByIdentity.TryGetValue(Identity(violation), out var detectedAt)) violation.DetectedAt = detectedAt;
            }
            return computed;
        }

        private static string Identity(KeyGlossaryViolation v) =>
            string.Join('\u001f', v.Culture, v.GlossaryId, v.Term, v.Kind, v.Expected ?? "\u0000", v.Found ?? "\u0000");
    }
}
