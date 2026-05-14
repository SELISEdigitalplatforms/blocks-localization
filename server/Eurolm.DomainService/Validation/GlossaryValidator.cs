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
                .WithMessage("The name must be unique.")
                .Length(1, 200).WithMessage("Name must be between 1 and 200 characters long.");
        }

        private async Task<bool> IsNameUniqueAsync(string? itemId, string name)
        {
            var existing = await _glossaryRepository.GetByNameAsync(name);
            if (existing == null) return true;
            return existing.ItemId == itemId;
        }
    }
}
