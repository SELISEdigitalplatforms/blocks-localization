using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Shared;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging;

namespace Eurolm.DomainService.Services
{
    public class GlossaryManagementService : IGlossaryManagementService
    {
        private readonly IValidator<Glossary> _validator;
        private readonly ILogger<GlossaryManagementService> _logger;
        private readonly IGlossaryRepository _glossaryRepository;
        private readonly IKeyRepository _keyRepository;
        private readonly IGlossaryMatcherCache? _matcherCache;
        private readonly IGlossaryRecheckService? _recheckService;

        public const int MaxGetByIdsCount = 100;
        public const int MaxUsagePageSize = 50;

        internal const string VersionConflictMessage = "This glossary was changed by someone else. Reload and try again.";
        internal const string ItemNotFoundMessage = "Glossary item not found";

        private static string CurrentTenantId => BlocksContext.GetContext()?.TenantId
            ?? throw new InvalidOperationException("A tenant context is required to save a glossary.");

        public GlossaryManagementService(IValidator<Glossary> validator,
                                         ILogger<GlossaryManagementService> logger,
                                         IGlossaryRepository glossaryRepository,
                                         IKeyRepository keyRepository,
                                         IGlossaryMatcherCache? matcherCache = null,
                                         IGlossaryRecheckService? recheckService = null)
        {
            _validator = validator;
            _logger = logger;
            _glossaryRepository = glossaryRepository;
            _keyRepository = keyRepository;
            _matcherCache = matcherCache;
            _recheckService = recheckService;
        }

        public async Task<ApiResponse> SaveGlossaryAsync(Glossary glossary)
        {
            var validationResult = await _validator.ValidateAsync(glossary);

            if (!validationResult.IsValid)
                return new ApiResponse(string.Empty, validationResult.Errors);

            try
            {
                if (string.IsNullOrEmpty(glossary.ItemId))
                {
                    var created = MapNewGlossary(glossary);
                    await _glossaryRepository.InsertAsync(created);
                    InvalidateMatcher();
                    await TriggerRecheckAsync(created.ItemId);
                    return new ApiResponse();
                }

                var existing = await _glossaryRepository.GetStoredByIdAsync(glossary.ItemId);
                if (existing == null)
                    return ValidationError(nameof(Glossary.ItemId), ItemNotFoundMessage);

                // Clients that omit version (CLI, extension) skip the check.
                if (glossary.Version.HasValue && glossary.Version.Value != existing.Version)
                    return ValidationError(nameof(Glossary.Version), VersionConflictMessage);

                var matched = await _glossaryRepository.ReplaceAsync(MapUpdatedGlossary(glossary, existing), glossary.Version);
                if (!matched)
                {
                    // A concurrent save won the versioned replace, or the glossary was deleted meanwhile.
                    return glossary.Version.HasValue
                        ? ValidationError(nameof(Glossary.Version), VersionConflictMessage)
                        : ValidationError(nameof(Glossary.ItemId), ItemNotFoundMessage);
                }
                InvalidateMatcher();
                await TriggerRecheckAsync(glossary.ItemId);
            }
            catch (Exception ex)
            {
                _logger.LogError("Error while saving Glossary {ErrorMessage} : {StackTrace}", ex.Message, ex.StackTrace);
                return new ApiResponse(ex.Message);
            }

            return new ApiResponse();
        }

        public async Task<GetGlossariesResponse> GetGlossariesAsync(GetGlossariesRequest request)
        {
            return await _glossaryRepository.GetAllAsync(request);
        }

        public async Task<Glossary?> GetGlossaryByIdAsync(string itemId)
        {
            return await _glossaryRepository.GetByIdAsync(itemId);
        }

        public async Task<List<Glossary>> GetGlossariesByIdsAsync(IReadOnlyList<string> itemIds)
        {
            var stored = await _glossaryRepository.GetStoredByIdsAsync(itemIds);
            var byId = stored.ToDictionary(g => g.ItemId, StringComparer.Ordinal);

            // Request order, each id once; ids that don't exist (or belong to another tenant) are omitted.
            return itemIds
                .Distinct(StringComparer.Ordinal)
                .Where(byId.ContainsKey)
                .Select(id => GlossaryMapper.ToDto(byId[id]))
                .ToList();
        }

        public async Task<GlossaryUsageResponse?> GetGlossaryUsageAsync(GlossaryUsageRequest request)
        {
            var glossary = await _glossaryRepository.GetStoredByIdAsync(request.ItemId);
            if (glossary == null) return null;

            var usage = await _keyRepository.GetGlossaryKeyUsageAsync(request.ItemId, request.PageNumber, request.PageSize);
            return new GlossaryUsageResponse
            {
                KeyCount = usage.KeyCount,
                Keys = usage.Keys,
                ModuleIds = usage.ModuleIds,
                ViolationKeyCount = usage.ViolationKeyCount
            };
        }

        public async Task<BaseMutationResponse> DeleteGlossaryAsync(DeleteGlossaryRequest request)
        {
            _logger.LogInformation("Deleting glossary start");

            var glossary = await _glossaryRepository.GetByIdAsync(request.ItemId);
            if (glossary == null)
            {
                _logger.LogInformation("Deleting glossary end -- glossary not found");

                return new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "itemId", ItemNotFoundMessage }
                    }
                };
            }

            // Untag every key first, so no key is left pointing at a deleted glossary. Retrying after a
            // failed delete below is safe: the pull is idempotent.
            try
            {
                var modifiedKeys = await _keyRepository.RemoveGlossaryIdFromKeysAsync(request.ItemId);
                _logger.LogInformation("Deleting glossary -- removed from {ModifiedKeyCount} keys", modifiedKeys);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Deleting glossary end -- could not remove it from keys: {ErrorMessage}", ex.Message);

                return new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "Error", "Could not remove the glossary from keys. Nothing was deleted." }
                    }
                };
            }

            await _glossaryRepository.DeleteAsync(request.ItemId);
            InvalidateMatcher();
            await TriggerRecheckAsync(request.ItemId);

            _logger.LogInformation("Deleting glossary end -- Success");
            return new BaseMutationResponse { IsSuccess = true };
        }

        private static ApiResponse ValidationError(string propertyName, string message) =>
            new(string.Empty, new List<ValidationFailure> { new(propertyName, message) });

        private void InvalidateMatcher()
        {
            var tenantId = BlocksContext.GetContext()?.TenantId;
            if (!string.IsNullOrEmpty(tenantId)) _matcherCache?.Invalidate(tenantId);
        }

        /// <summary>Queues a coalesced violation re-check for the glossary (server flag on only; never throws).</summary>
        private Task TriggerRecheckAsync(string glossaryId) =>
            _recheckService?.TriggerAsync(new[] { glossaryId }) ?? Task.CompletedTask;

        private static BlocksGlossary MapNewGlossary(Glossary glossary)
        {
            var now = DateTime.UtcNow;
            var userId = BlocksContext.GetContext()?.UserId;
            var repoGlossary = new BlocksGlossary
            {
                ItemId = Guid.NewGuid().ToString(),
                CreateDate = now,
                LastUpdateDate = now,
                CreatedBy = userId,
                LastUpdatedBy = userId,
                TenantId = CurrentTenantId,
                Version = 1,
                Status = GlossaryStatus.Approved
            };
            CopyEditableFields(glossary, repoGlossary);
            ApplyStructuredFields(glossary, repoGlossary);
            ApplyDescriptiveFields(glossary, repoGlossary);
            return repoGlossary;
        }

        private static BlocksGlossary MapUpdatedGlossary(Glossary glossary, BlocksGlossary existing)
        {
            var repoGlossary = new BlocksGlossary
            {
                ItemId = existing.ItemId,
                CreateDate = existing.CreateDate,
                CreatedBy = existing.CreatedBy,
                LastUpdateDate = DateTime.UtcNow,
                LastUpdatedBy = BlocksContext.GetContext()?.UserId,
                TenantId = CurrentTenantId,
                Version = existing.Version + 1,
                // New fields are merged: omitted ones keep their stored values (old clients can't wipe them).
                Rule = existing.Rule,
                CaseSensitive = existing.CaseSensitive,
                Variants = existing.Variants,
                Translations = existing.Translations,
                Status = existing.Status,
                SchemaVersion = existing.SchemaVersion,
                PartOfSpeech = existing.PartOfSpeech,
                UsageExamples = existing.UsageExamples
            };
            CopyEditableFields(glossary, repoGlossary);
            ApplyStructuredFields(glossary, repoGlossary, existing);
            ApplyDescriptiveFields(glossary, repoGlossary);
            return repoGlossary;
        }

        /// <summary>Existing fields keep replace semantics (for example <c>moduleIds: []</c> clears the modules).</summary>
        private static void CopyEditableFields(Glossary glossary, BlocksGlossary repoGlossary)
        {
            repoGlossary.Name = Glossary.NormalizeName(glossary.Name);
            repoGlossary.NormalizedName = GlossaryMapper.NormalizedName(glossary.Name);
            repoGlossary.Language = glossary.Language;
            repoGlossary.Type = glossary.Type;
            repoGlossary.Context = glossary.Context;
            repoGlossary.AdditionalNote = glossary.AdditionalNote;
            repoGlossary.IsGlobal = glossary.IsGlobal;
            repoGlossary.ModuleIds = glossary.ModuleIds;
        }

        /// <summary>
        /// Merges the structured fields (DATA CONTRACTS › Save): a structured save sets SchemaVersion 2 and, on the
        /// first one, fills the fields it omits from the effective terminology. A save without structured fields
        /// whose additionalNote is Track A v1 JSON copies that terminology into the stored fields (A12).
        /// </summary>
        private static void ApplyStructuredFields(Glossary glossary, BlocksGlossary repoGlossary, BlocksGlossary? existing = null)
        {
            if (glossary.HasStructuredFields())
            {
                if (repoGlossary.SchemaVersion < 2)
                {
                    // Resolve from what is stored (or, on create, from this request's own note).
                    var effective = GlossaryTerminologyResolver.Resolve(existing ?? repoGlossary);
                    repoGlossary.Rule = effective.Rule;
                    repoGlossary.CaseSensitive = effective.CaseSensitive;
                    repoGlossary.Variants = effective.Variants;
                    repoGlossary.Translations = effective.Translations;
                    repoGlossary.Status ??= effective.Status;
                    repoGlossary.SchemaVersion = 2;
                }

                if (glossary.Rule != null && GlossaryWireValues.TryParseRule(glossary.Rule, out var rule))
                    repoGlossary.Rule = rule;
                if (glossary.CaseSensitive != null)
                    repoGlossary.CaseSensitive = glossary.CaseSensitive;
                if (glossary.Variants != null)
                    repoGlossary.Variants = NormalizeVariants(glossary.Variants);
                if (glossary.Translations != null)
                    repoGlossary.Translations = NormalizeTranslations(glossary.Translations);
                if (glossary.Status != null && GlossaryWireValues.TryParseStatus(glossary.Status, out var status))
                    repoGlossary.Status = status;
                return;
            }

            var parsed = GlossaryMetaParser.Parse(glossary.AdditionalNote);
            if (parsed.Status != GlossaryMetaStatus.Structured) return;

            // Track A save: keep the structured fields in sync with the JSON the Track A UI edits.
            repoGlossary.Rule = parsed.Meta.Rule;
            repoGlossary.CaseSensitive = parsed.Meta.CaseSensitive;
            repoGlossary.Variants = parsed.Meta.Variants.ToList();
            repoGlossary.Translations = GlossaryTerminologyResolver.ToTranslations(parsed.Meta);
        }

        /// <summary>
        /// Part of speech and usage examples merge on omit (C17): null keeps the stored value, "" or an empty list
        /// clears it. They are not terminology, so they never change SchemaVersion.
        /// </summary>
        private static void ApplyDescriptiveFields(Glossary glossary, BlocksGlossary repoGlossary)
        {
            if (glossary.PartOfSpeech != null && GlossaryWireValues.TryParsePartOfSpeech(glossary.PartOfSpeech, out var partOfSpeech))
                repoGlossary.PartOfSpeech = partOfSpeech;
            if (glossary.UsageExamples != null)
            {
                var examples = glossary.UsageExamples.Select(GlossaryMapper.NormalizeValue).Where(e => e.Length > 0).ToList();
                repoGlossary.UsageExamples = examples.Count > 0 ? examples : null;
            }
        }

        private static List<string> NormalizeVariants(IEnumerable<string> variants) =>
            variants.Select(GlossaryMapper.NormalizeValue).Where(v => v.Length > 0).ToList();

        private static List<GlossaryTranslation> NormalizeTranslations(IEnumerable<GlossaryTranslationDto> translations) =>
            translations
                .Where(t => t != null)
                .Select(t => new GlossaryTranslation
                {
                    Language = (t.Language ?? "").Trim(),
                    Value = GlossaryMapper.NormalizeValue(t.Value),
                    ForbiddenValues = (t.ForbiddenValues ?? new List<string>())
                        .Select(GlossaryMapper.NormalizeValue).Where(v => v.Length > 0).ToList()
                })
                .ToList();
    }
}
