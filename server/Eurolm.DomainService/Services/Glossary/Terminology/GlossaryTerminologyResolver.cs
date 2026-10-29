using Eurolm.DomainService.Repositories;

namespace Eurolm.DomainService.Services
{
    public static class GlossaryTerminologyResolver
    {
        public static EffectiveTerminology Resolve(BlocksGlossary glossary)
        {
            ArgumentNullException.ThrowIfNull(glossary);
            var definition = RuleMarker.Strip(glossary.Context);
            var status = glossary.Status ?? GlossaryStatus.Approved;

            if (glossary.SchemaVersion >= 2)
            {
                return new EffectiveTerminology
                {
                    Rule = glossary.Rule ?? GlossaryRule.Translate,
                    CaseSensitive = glossary.CaseSensitive ?? false,
                    Variants = glossary.Variants?.ToList() ?? new(),
                    Translations = Copy(glossary.Translations),
                    Status = status,
                    Definition = definition,
                    Note = glossary.AdditionalNote
                };
            }

            var parsed = GlossaryMetaParser.Parse(glossary.AdditionalNote);
            if (parsed.Status == GlossaryMetaStatus.Structured)
            {
                return new EffectiveTerminology
                {
                    Rule = parsed.Meta.Rule,
                    CaseSensitive = parsed.Meta.CaseSensitive,
                    Variants = parsed.Meta.Variants.ToList(),
                    Translations = ToTranslations(parsed.Meta),
                    Status = status,
                    Definition = definition,
                    Note = parsed.Meta.Note
                };
            }

            return new EffectiveTerminology
            {
                Status = status,
                Definition = definition,
                IsUnsupported = parsed.Status == GlossaryMetaStatus.UnsupportedVersion,
                Note = parsed.Status == GlossaryMetaStatus.UnsupportedVersion ? null : parsed.Meta.Note
            };
        }

        /// <summary>Merges the v1 JSON translations and forbidden maps into one entry per culture (translations' order first).</summary>
        public static List<GlossaryTranslation> ToTranslations(GlossaryMeta meta)
        {
            var result = new List<GlossaryTranslation>();
            var byCulture = new Dictionary<string, GlossaryTranslation>(StringComparer.Ordinal);
            GlossaryTranslation Entry(string culture)
            {
                if (!byCulture.TryGetValue(culture, out var entry))
                {
                    entry = new GlossaryTranslation { Language = culture };
                    byCulture[culture] = entry;
                    result.Add(entry);
                }
                return entry;
            }
            foreach (var (culture, value) in meta.Translations) Entry(culture).Value = value;
            foreach (var (culture, values) in meta.Forbidden) Entry(culture).ForbiddenValues = values.ToList();
            return result;
        }

        private static List<GlossaryTranslation> Copy(List<GlossaryTranslation>? translations) =>
            translations?.Select(t => new GlossaryTranslation
            {
                Language = t.Language,
                Value = t.Value ?? "",
                ForbiddenValues = t.ForbiddenValues?.ToList() ?? new()
            }).ToList() ?? new();
    }
}
