using Eurolm.DomainService.Repositories;

namespace Eurolm.DomainService.Services
{
    /// <summary>
    /// A glossary's terminology as the matcher, prompt, validator and read DTO see it: the stored structured
    /// fields (schema 2) or the Track A v1 JSON parsed from AdditionalNote (legacy). Inactive values
    /// (translations under Keep/Forbidden, forbidden values under Keep) are kept but never active (A10).
    /// </summary>
    public class EffectiveTerminology
    {
        public GlossaryRule Rule { get; init; } = GlossaryRule.Translate;
        public bool CaseSensitive { get; init; }
        public List<string> Variants { get; init; } = new();
        /// <summary>Every stored translation and forbidden list, including inactive ones and unknown cultures.</summary>
        public List<GlossaryTranslation> Translations { get; init; } = new();
        public GlossaryStatus Status { get; init; } = GlossaryStatus.Approved;
        /// <summary>Context without a trailing <c>⟦rule: …⟧</c> marker.</summary>
        public string Definition { get; init; } = "";
        /// <summary>AdditionalNote holds terminology JSON of an unknown version; the matcher skips the term.</summary>
        public bool IsUnsupported { get; init; }
        /// <summary>The Track A note text: the parsed note, or the raw text when it was plain or corrupt.</summary>
        public string? Note { get; init; }

        /// <summary>The approved translation for the culture, only under the Translate rule.</summary>
        public string? ActiveTranslation(string? culture)
        {
            if (Rule != GlossaryRule.Translate || string.IsNullOrEmpty(culture)) return null;
            var value = Find(culture)?.Value;
            return string.IsNullOrEmpty(value) ? null : value;
        }

        /// <summary>Values that must not be used for the culture, only under the Translate and Forbidden rules.</summary>
        public IReadOnlyList<string> ActiveForbidden(string? culture)
        {
            if (Rule == GlossaryRule.Keep || string.IsNullOrEmpty(culture)) return Array.Empty<string>();
            return Find(culture)?.ForbiddenValues ?? (IReadOnlyList<string>)Array.Empty<string>();
        }

        /// <summary>All cultures' active values, as /Match returns them.</summary>
        public List<GlossaryTranslation> ActiveTranslations() => Translations
            .Select(t => new GlossaryTranslation
            {
                Language = t.Language,
                Value = ActiveTranslation(t.Language) ?? "",
                ForbiddenValues = ActiveForbidden(t.Language).ToList()
            })
            .Where(t => t.Value.Length > 0 || t.ForbiddenValues.Count > 0)
            .ToList();

        private GlossaryTranslation? Find(string culture) =>
            Translations.FirstOrDefault(t => string.Equals(t.Language, culture, StringComparison.Ordinal));
    }
}
