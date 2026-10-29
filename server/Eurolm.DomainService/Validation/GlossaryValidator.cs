using Eurolm.DomainService.Repositories;
using FluentValidation;

namespace Eurolm.DomainService.Services
{
    public class GlossaryValidator : AbstractValidator<Glossary>
    {
        private readonly IGlossaryRepository _glossaryRepository;

        public GlossaryValidator(IGlossaryRepository glossaryRepository)
        {
            _glossaryRepository = glossaryRepository;

            RuleFor(glossary => glossary.Name)
                .NotEmpty().WithMessage("Name is required.")
                .MustAsync(async (glossary, name, cancellationToken) => await IsNameUniqueAsync(glossary.ItemId, name))
                .WithMessage("Glossary name must be unique.")
                .Length(1, 200).WithMessage("Name must be between 1 and 200 characters long.");

            // Structured fields are merged on save, so they are only checked when the request carries them.
            RuleFor(glossary => glossary.Rule)
                .Must(rule => GlossaryWireValues.TryParseRule(rule, out _))
                .When(glossary => glossary.Rule != null)
                .WithMessage("Rule must be translate, keep or forbidden.");

            RuleFor(glossary => glossary.Status)
                .Must(status => GlossaryWireValues.TryParseStatus(status, out _))
                .When(glossary => glossary.Status != null)
                .WithMessage("Status must be draft, approved or deprecated.");

            RuleFor(glossary => glossary.Variants)
                .Must((glossary, variants) => AreVariantsValid(variants!, glossary.Name))
                .When(glossary => glossary.Variants != null)
                .WithMessage("Variants are invalid.");

            RuleFor(glossary => glossary.Translations)
                .Must(translations => AreTranslationsValid(translations!))
                .When(glossary => glossary.Translations != null)
                .WithMessage("Translations are invalid.");

            RuleFor(glossary => glossary.PartOfSpeech)
                .Must(partOfSpeech => GlossaryWireValues.TryParsePartOfSpeech(partOfSpeech, out _))
                .When(glossary => glossary.PartOfSpeech != null)
                .WithMessage("Part of speech is invalid.");

            RuleFor(glossary => glossary.UsageExamples)
                .Must(examples => AreUsageExamplesValid(examples!))
                .When(glossary => glossary.UsageExamples != null)
                .WithMessage("Usage examples are invalid.");

            // Neither field had a server limit before Phase 6 and the CLI and extension resend both unchanged on
            // every save, so the limits apply on create or when the value changes (A13).
            RuleFor(glossary => glossary.Context)
                .MustAsync(async (glossary, context, _) =>
                    (context?.Length ?? 0) <= MaxContextLength || await IsUnchangedAsync(glossary.ItemId, g => g.Context, context))
                .WithMessage("Context must be 1,600 characters or fewer.");

            RuleFor(glossary => glossary.AdditionalNote)
                .MustAsync(async (glossary, note, _) =>
                    (note?.Length ?? 0) <= MaxAdditionalNoteLength || await IsUnchangedAsync(glossary.ItemId, g => g.AdditionalNote, note))
                .WithMessage("Additional note must be 20,000 characters or fewer.");
        }

        public const int MaxContextLength = 1600;
        public const int MaxAdditionalNoteLength = 20000;
        public const int MaxVariants = 20;
        public const int MaxValueLength = 200;
        public const int MaxForbiddenValues = 10;
        public const int MaxUsageExamples = 5;
        public const int MaxUsageExampleLength = 300;

        private async Task<bool> IsUnchangedAsync(string? itemId, Func<BlocksGlossary, string?> field, string? value)
        {
            if (string.IsNullOrEmpty(itemId)) return false;
            var stored = await _glossaryRepository.GetStoredByIdAsync(itemId);
            return stored != null && string.Equals(field(stored), value, StringComparison.Ordinal);
        }

        private static bool AreVariantsValid(List<string> variants, string? name)
        {
            if (variants.Count > MaxVariants) return false;
            var nameKey = GlossaryMapper.CompareKey(name);
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var variant in variants)
            {
                var value = GlossaryMapper.NormalizeValue(variant);
                if (value.Length is 0 or > MaxValueLength) return false;
                var key = GlossaryMapper.CompareKey(value);
                if (key == nameKey || !seen.Add(key)) return false;
            }
            return true;
        }

        private static bool AreUsageExamplesValid(List<string> examples) =>
            examples.Count <= MaxUsageExamples
            && examples.All(example => example != null && GlossaryMapper.NormalizeValue(example).Length is > 0 and <= MaxUsageExampleLength);

        private static bool AreTranslationsValid(List<GlossaryTranslationDto> translations)
        {
            var languages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var translation in translations)
            {
                if (translation == null) return false;
                var language = (translation.Language ?? "").Trim();
                if (language.Length == 0 || !languages.Add(language)) return false;

                var value = GlossaryMapper.NormalizeValue(translation.Value);
                if (value.Length > MaxValueLength) return false;

                if (!AreForbiddenValuesValid(translation.ForbiddenValues ?? new List<string>(), value)) return false;
            }
            return true;
        }

        private static bool AreForbiddenValuesValid(List<string> forbidden, string value)
        {
            if (forbidden.Count > MaxForbiddenValues) return false;
            var valueKey = GlossaryMapper.CompareKey(value);
            foreach (var item in forbidden)
            {
                var normalized = GlossaryMapper.NormalizeValue(item);
                if (normalized.Length is 0 or > MaxValueLength) return false;
                if (value.Length > 0 && GlossaryMapper.CompareKey(normalized) == valueKey) return false;
            }
            return true;
        }

        /// <summary>
        /// Names are compared trimmed, NFC-normalized and ignoring case: by NormalizedName for documents that have
        /// it, and by the Phase 5 case-insensitive check for older ones (see GetByNameInsensitiveAsync). An existing case-duplicate
        /// (legacy data) may still be saved as long as its own name is unchanged ignoring case.
        /// </summary>
        private async Task<bool> IsNameUniqueAsync(string? itemId, string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return true;

            var matches = await _glossaryRepository.GetByNameInsensitiveAsync(name);
            if (!matches.Any(g => g.ItemId != itemId)) return true;

            // A create always collides; an update collides only when it renames into the other name.
            return !string.IsNullOrEmpty(itemId) && matches.Any(g => g.ItemId == itemId);
        }
    }
}
