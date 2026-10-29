using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Microsoft.Extensions.Configuration;

namespace Eurolm.DomainService.Services
{
    public class GlossaryTerminologyService : IGlossaryTerminologyService
    {
        private readonly IGlossaryMatcherCache _matcherCache;
        private readonly IKeyRepository _keyRepository;
        private readonly IConfiguration _configuration;

        public GlossaryTerminologyService(IGlossaryMatcherCache matcherCache, IKeyRepository keyRepository, IConfiguration configuration)
        {
            _matcherCache = matcherCache;
            _keyRepository = keyRepository;
            _configuration = configuration;
        }

        private static string TenantId => BlocksContext.GetContext()?.TenantId ?? "";

        public bool IsEnforcementEnabled => GlossaryEnforcement.IsEnabled(_configuration);

        public async Task<MatchGlossaryResponse> MatchAsync(MatchGlossaryRequest request)
        {
            var glossaryIds = request.GlossaryIds;
            var moduleId = request.ModuleId;
            if (!string.IsNullOrWhiteSpace(request.KeyId) && (glossaryIds == null || moduleId == null))
            {
                // Resolved in the context tenant's database only, so another tenant's key finds nothing.
                var key = await _keyRepository.GetByIdAsync(request.KeyId);
                glossaryIds ??= key?.GlossaryIds;
                moduleId ??= key?.ModuleId;
            }

            var matcher = await _matcherCache.GetAsync(TenantId);
            var matches = matcher.Match(request.Text ?? "", new MatchOptions
            {
                SourceCulture = request.Language,
                KeyGlossaryIds = glossaryIds,
                ModuleId = moduleId,
                Mode = string.Equals(request.Mode, "all", StringComparison.OrdinalIgnoreCase) ? GlossaryScopeMode.All : GlossaryScopeMode.Applicable
            });

            return new MatchGlossaryResponse { Matches = matches.Select(ToDto).ToList() };
        }

        public async Task<List<KeyGlossaryViolation>?> ComputeKeyViolationsAsync(BlocksLanguageKey key)
        {
            if (!IsEnforcementEnabled) return null;

            var defaultCulture = (await _keyRepository.GetLanguageSettingAsync(TenantId))?.LanguageCode;
            var sourceText = key.Resources?.FirstOrDefault(r => r.Culture == defaultCulture)?.Value;
            if (string.IsNullOrEmpty(defaultCulture) || string.IsNullOrWhiteSpace(sourceText))
                return new List<KeyGlossaryViolation>();

            var matcher = await _matcherCache.GetAsync(TenantId);
            return ComputeKeyViolations(key, matcher, defaultCulture, DateTime.UtcNow);
        }

        /// <summary>
        /// The key's violations for every non-default culture with a value, with the default culture's value as
        /// the source (matcher and validator only, no AI). Shared by Key/Save and the re-check job.
        /// </summary>
        public static List<KeyGlossaryViolation> ComputeKeyViolations(BlocksLanguageKey key, GlossaryMatcher matcher, string defaultCulture, DateTime detectedAt)
        {
            ArgumentNullException.ThrowIfNull(key);
            ArgumentNullException.ThrowIfNull(matcher);
            var sourceText = key.Resources?.FirstOrDefault(r => r.Culture == defaultCulture)?.Value;
            if (string.IsNullOrEmpty(defaultCulture) || string.IsNullOrWhiteSpace(sourceText))
                return new List<KeyGlossaryViolation>();

            var matches = matcher.Match(sourceText, new MatchOptions
            {
                SourceCulture = defaultCulture,
                KeyGlossaryIds = key.GlossaryIds,
                ModuleId = key.ModuleId,
                Mode = GlossaryScopeMode.Applicable
            });
            if (matches.Count == 0) return new List<KeyGlossaryViolation>();

            var violations = new List<KeyGlossaryViolation>();
            foreach (var resource in key.Resources!)
            {
                if (resource.Culture == defaultCulture || string.IsNullOrWhiteSpace(resource.Value)) continue;

                // The same rule selection the suggestion prompt uses (Approved, applicable, within the caps).
                var ruleMatches = TerminologyPromptBuilder.Build(new SuggestLanguageRequest
                {
                    SourceText = sourceText,
                    CurrentLanguageCode = defaultCulture,
                    DestinationLanguageCode = resource.Culture
                }, matches).RuleMatches;

                violations.AddRange(TranslationValidator.Validate(resource.Value, resource.Culture, ruleMatches)
                    .Select(v => ToKeyViolation(v, resource.Culture, detectedAt)));
            }
            return violations;
        }

        public async Task<List<string>> SuggestGlossaryIdsAsync(Key key, int maxResults)
        {
            var defaultCulture = (await _keyRepository.GetLanguageSettingAsync(TenantId))?.LanguageCode;
            var sourceText = key.Resources?.FirstOrDefault(r => r.Culture == defaultCulture)?.Value;
            if (string.IsNullOrEmpty(defaultCulture) || string.IsNullOrWhiteSpace(sourceText) || maxResults <= 0)
                return new List<string>();

            var matcher = await _matcherCache.GetAsync(TenantId);
            return matcher.Match(sourceText, new MatchOptions
                {
                    SourceCulture = defaultCulture,
                    KeyGlossaryIds = key.GlossaryIds,
                    ModuleId = key.ModuleId,
                    Mode = GlossaryScopeMode.All
                })
                // Key, module and global terms already apply to the key; only the rest are suggestions.
                .Where(m => m.Scope == GlossaryScope.Other)
                .Select(m => m.Glossary.ItemId)
                .Distinct(StringComparer.Ordinal)
                .Take(maxResults)
                .ToList();
        }

        public static KeyGlossaryViolation ToKeyViolation(GlossaryViolationDto violation, string culture, DateTime detectedAt) => new()
        {
            Culture = culture,
            GlossaryId = violation.GlossaryId,
            Term = violation.Term,
            Kind = violation.Kind,
            Expected = violation.Expected,
            Found = violation.Found,
            DetectedAt = detectedAt
        };

        public static GlossaryMatchDto ToDto(GlossaryMatch match) => new()
        {
            GlossaryId = match.Glossary.ItemId,
            Start = match.Start,
            Length = match.Length,
            Surface = match.Surface,
            Term = match.Glossary.Name,
            Rule = match.Terminology.Rule.ToString().ToLowerInvariant(),
            Status = match.Terminology.Status.ToString().ToLowerInvariant(),
            CaseSensitive = match.Terminology.CaseSensitive,
            Scope = match.Scope.ToString().ToLowerInvariant(),
            Definition = match.Terminology.Definition,
            PartOfSpeech = match.Glossary.PartOfSpeech,
            UsageExamples = match.Glossary.UsageExamples?.ToList(),
            Translations = match.Terminology.ActiveTranslations()
                .Select(t => new GlossaryTranslationDto { Language = t.Language, Value = t.Value, ForbiddenValues = t.ForbiddenValues })
                .ToList()
        };
    }
}
