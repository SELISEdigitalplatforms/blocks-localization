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
        }

        /// <summary>
        /// Names are compared trimmed, NFC-normalized and ignoring case. An existing case-duplicate
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
