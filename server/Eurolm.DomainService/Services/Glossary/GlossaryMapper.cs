using Eurolm.DomainService.Repositories;
using System.Globalization;
using System.Text;

namespace Eurolm.DomainService.Services
{
    public static class GlossaryMapper
    {
        /// <summary>
        /// The read DTO: structured fields from the effective terminology, and context / additionalNote exactly
        /// as stored, so the Track A UI and the flag-off prompt keep working until migration.
        /// </summary>
        public static Glossary ToDto(BlocksGlossary entity)
        {
            ArgumentNullException.ThrowIfNull(entity);
            var terminology = GlossaryTerminologyResolver.Resolve(entity);
            return new Glossary
            {
                ItemId = entity.ItemId,
                Name = entity.Name,
                Language = entity.Language,
                Type = entity.Type,
                Context = entity.Context,
                AdditionalNote = entity.AdditionalNote,
                IsGlobal = entity.IsGlobal,
                ModuleIds = entity.ModuleIds,
                CreateDate = entity.CreateDate,
                LastUpdateDate = entity.LastUpdateDate,
                Version = entity.Version,
                Rule = GlossaryWireValues.ToWire(terminology.Rule),
                CaseSensitive = terminology.CaseSensitive,
                Variants = terminology.Variants,
                Translations = terminology.Translations.Select(ToDto).ToList(),
                Status = GlossaryWireValues.ToWire(terminology.Status),
                SchemaVersion = entity.SchemaVersion,
                PartOfSpeech = entity.PartOfSpeech,
                UsageExamples = entity.UsageExamples?.ToList()
            };
        }

        public static GlossaryTranslationDto ToDto(GlossaryTranslation translation) => new()
        {
            Language = translation.Language,
            Value = translation.Value,
            ForbiddenValues = translation.ForbiddenValues.ToList()
        };

        /// <summary><c>Name.Trim().Normalize(FormC).ToLowerInvariant()</c>, the form unique names are compared in.</summary>
        public static string NormalizedName(string? name) =>
            Glossary.NormalizeName(name).ToLowerInvariant();

        /// <summary>Trimmed and NFC-normalized, the form structured values are stored in.</summary>
        public static string NormalizeValue(string? value) =>
            (value ?? "").Trim().Normalize(NormalizationForm.FormC);

        /// <summary>The comparison key for "unique" / "differs from" checks on values.</summary>
        public static string CompareKey(string? value) =>
            NormalizeValue(value).ToLower(CultureInfo.InvariantCulture);
    }
}
