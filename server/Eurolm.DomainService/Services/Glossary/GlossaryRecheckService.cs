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
        public static readonly TimeSpan StaleAfter = TimeSpan.FromMinutes(5);
        /// <summary>How long a running job holds the tenant's lease without renewing it (renewed every page).</summary>
        public static readonly TimeSpan LeaseDuration = TimeSpan.FromMinutes(2);

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

        public Task TriggerAsync(IReadOnlyCollection<string> glossaryIds) =>
            TriggerAsync(glossaryIds, Array.Empty<string>(), wholeProject: false);

        public async Task TriggerAsync(IReadOnlyCollection<string> glossaryIds, IReadOnlyCollection<string> previousModuleIds, bool wholeProject)
        {
            if (!IsEnabled) return;
            try
            {
                var ids = wholeProject ? null : DistinctIds(glossaryIds);
                if (ids is { Count: 0 }) ids = null;
                await EnqueueAsync(BlocksContext.GetContext()?.TenantId, ids, ids == null ? null : DistinctIds(previousModuleIds));
            }
            catch (Exception ex)
            {
                // The glossary write already succeeded; a missed re-check only leaves violations stale.
                _logger.LogWarning(ex, "Could not queue a glossary re-check for {GlossaryCount} glossaries", glossaryIds?.Count ?? 0);
            }
        }

        private static List<string> DistinctIds(IEnumerable<string>? ids) =>
            (ids ?? Array.Empty<string>()).Where(id => !string.IsNullOrEmpty(id)).Distinct(StringComparer.Ordinal).ToList();

        private async Task<bool> EnqueueAsync(string? tenantId, IReadOnlyList<string>? glossaryIds, IReadOnlyList<string>? moduleIds)
        {
            if (!IsEnabled) return false;
            if (string.IsNullOrEmpty(tenantId)) return false;

            if (!await _jobRepository.TryEnqueueAsync(tenantId, glossaryIds, moduleIds, DateTime.UtcNow, StaleAfter))
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
            var contextTenantId = BlocksContext.GetContext()?.TenantId;
            var projectKey = @event.ProjectKey;

            if (string.IsNullOrEmpty(contextTenantId))
            {
                if (string.IsNullOrEmpty(projectKey))
                {
                    _logger.LogWarning("Glossary re-check skipped: the event has no tenant");
                    return new GlossaryRecheckResult();
                }
                return await BlocksContext.ExecuteInContext(TenantContext(projectKey), () => RecheckTenantAsync(projectKey, @event.GlossaryId));
            }

            if (!string.IsNullOrEmpty(projectKey) && !string.Equals(contextTenantId, projectKey, StringComparison.Ordinal))
            {
                _logger.LogWarning("Glossary re-check skipped: context tenant {ContextTenantId} does not match event project {ProjectKey}", contextTenantId, projectKey);
                return new GlossaryRecheckResult();
            }

            return await RecheckTenantAsync(contextTenantId, @event.GlossaryId);
        }

        private static BlocksContext TenantContext(string tenantId) => BlocksContext.Create(
            tenantId: tenantId,
            roles: Array.Empty<string>(),
            userId: "",
            isAuthenticated: false,
            requestUri: "",
            organizationId: "",
            expireOn: DateTime.UtcNow.Add(LeaseDuration),
            email: "",
            permissions: Array.Empty<string>(),
            userName: "",
            phoneNumber: "",
            displayName: "",
            oauthToken: "",
            originalTenantId: tenantId,
            applicationDomain: "",
            impersonated: false,
            impersonationSessionId: "");

        private async Task<GlossaryRecheckResult> RecheckTenantAsync(string tenantId, string? glossaryId)
        {
            var result = new GlossaryRecheckResult();

            if (!IsEnabled)
            {
                await _jobRepository.ClaimAsync(tenantId);
                _logger.LogInformation("Glossary re-check skipped for tenant {TenantId}: enforcement is off", tenantId);
                return result;
            }

            var owner = Guid.NewGuid().ToString("N");
            var eventGlossaryId = glossaryId;
            while (await _jobRepository.TryAcquireLeaseAsync(tenantId, owner, DateTime.UtcNow, LeaseDuration))
            {
                bool keptLease;
                try
                {
                    keptLease = await DrainAsync(tenantId, owner, eventGlossaryId, result);
                }
                finally
                {
                    await _jobRepository.ReleaseLeaseAsync(tenantId, owner);
                }

                // A request queued after the last claim, whose message found the lease still taken.
                if (!keptLease || !await _jobRepository.HasQueuedAsync(tenantId)) return result;
                eventGlossaryId = null;
            }

            _logger.LogInformation("Glossary re-check for tenant {TenantId} is running elsewhere; its request stays queued for that job", tenantId);
            return result;
        }

        /// <summary>
        /// Runs queued jobs until none is left. False when the lease was lost (the job's scope is queued again). A
        /// message whose marker was already claimed (a redelivery, or drained by an earlier job) runs nothing.
        /// </summary>
        private async Task<bool> DrainAsync(string tenantId, string owner, string? eventGlossaryId, GlossaryRecheckResult result)
        {
            // Claim after taking the lease, so glossary edits made while a job runs queue the next one.
            for (var job = await _jobRepository.ClaimAsync(tenantId); job != null; job = await _jobRepository.ClaimAsync(tenantId))
            {
                var completed = false;
                bool keptLease;
                try
                {
                    keptLease = await RunAsync(tenantId, owner, job, eventGlossaryId, result);
                    completed = true;
                }
                finally
                {
                    // A failed run puts the claimed scope back so a retry (or the next request) still covers it.
                    if (!completed)
                    {
                        await _jobRepository.RequeueFailedAsync(tenantId, job.WholeProject ? null : job.GlossaryIds, job.ModuleIds, DateTime.UtcNow);
                        _logger.LogWarning("Glossary re-check failed for tenant {TenantId}; scope queued again and marked failed", tenantId);
                    }
                }
                if (!keptLease) return false;
                eventGlossaryId = null;
            }
            return true;
        }

        private async Task<bool> RunAsync(string tenantId, string owner, GlossaryRecheckJob job, string? eventGlossaryId, GlossaryRecheckResult result)
        {
            var defaultCulture = (await _keyRepository.GetLanguageSettingAsync(tenantId))?.LanguageCode;
            if (string.IsNullOrEmpty(defaultCulture))
            {
                _logger.LogInformation("Glossary re-check skipped for tenant {TenantId}: no default language", tenantId);
                return true;
            }

            var scope = await ResolveScopeAsync(job, eventGlossaryId);

            // Always rebuild: the API process invalidated its own cache, not this one.
            _matcherCache.Invalidate(tenantId);
            var matcher = await _matcherCache.GetAsync(tenantId);
            result.Ran = true;

            string? after = null;
            while (true)
            {
                if (!await _jobRepository.TryAcquireLeaseAsync(tenantId, owner, DateTime.UtcNow, LeaseDuration))
                {
                    // The lease ran out and another job took over; queue this job's scope again rather than racing it.
                    _logger.LogWarning("Glossary re-check for tenant {TenantId} lost its lease after key {AfterKeyId}; scope queued again", tenantId, after);
                    await EnqueueAsync(tenantId, scope?.GlossaryIds.ToList(), scope?.ModuleIds.ToList());
                    return false;
                }

                var keys = await _keyRepository.GetKeysForGlossaryRecheckAsync(scope, after, PageSize);
                if (keys.Count == 0) break;

                var updates = ComputeUpdates(keys, matcher, defaultCulture, result);
                if (updates.Count > 0) await StoreUpdatesAsync(updates, after, result);

                after = keys[^1].ItemId;
                if (keys.Count < PageSize) break;
            }

            _logger.LogInformation(
                "Glossary re-check for tenant {TenantId} done: {Checked} keys checked, {Updated} updated, {Failed} failed (whole project {WholeProject})",
                tenantId, result.Checked, result.Updated, result.Failed, scope == null);
            return true;
        }

        /// <summary>
        /// Null (every key) when the whole project was asked for or any of the glossaries is global; otherwise
        /// the glossaries' tagged keys, keys in their modules, and keys with stored violations of them.
        /// </summary>
        private List<GlossaryViolationUpdate> ComputeUpdates(
            List<BlocksLanguageKey> keys, GlossaryMatcher matcher, string defaultCulture, GlossaryRecheckResult result)
        {
            var now = DateTime.UtcNow;
            var updates = new List<GlossaryViolationUpdate>();
            foreach (var key in keys)
            {
                result.Checked++;
                try
                {
                    var computed = GlossaryTerminologyService.ComputeKeyViolations(key, matcher, defaultCulture, now);
                    var merged = KeepDetectedAt(key.GlossaryViolations, computed);
                    if (merged != null) updates.Add(new GlossaryViolationUpdate(key.ItemId, merged, key.LastUpdateDate));
                }
                catch (Exception ex)
                {
                    // This key keeps its stored violations; the rest of the job goes on.
                    result.Failed++;
                    _logger.LogWarning(ex, "Glossary re-check failed for key {KeyId}; stored violations kept", key.ItemId);
                }
            }
            return updates;
        }

        private async Task StoreUpdatesAsync(List<GlossaryViolationUpdate> updates, string? after, GlossaryRecheckResult result)
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

            // The job's modules are where the glossaries were scoped before the change (a removed module, a deleted
            // glossary); the stored glossaries give where they are scoped now.
            return new GlossaryRecheckKeyScope
            {
                GlossaryIds = ids.ToList(),
                ModuleIds = glossaries.SelectMany(g => g.ModuleIds ?? new List<string>())
                    .Concat(job?.ModuleIds ?? new List<string>())
                    .Distinct(StringComparer.Ordinal)
                    .ToList()
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
