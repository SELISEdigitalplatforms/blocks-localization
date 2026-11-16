using Eurolm.DomainService.Repositories;
using FluentValidation;

namespace Eurolm.DomainService.Services
{
    public class ModuleValidator : AbstractValidator<Module>
    {
        public const int MaxDescriptionLength = 500;

        private readonly  IModuleRepository _moduleRepository;

        public ModuleValidator(IModuleRepository moduleRepository)
        {
            _moduleRepository = moduleRepository;

            RuleFor(module => module.ModuleName)
                .NotEmpty().WithMessage("Module name is required.")
                .MustAsync(async (module, name, cancellationToken) => await IsNameUniqueAsync(module.ItemId, name))
                .WithMessage("Module name must be unique.")
                .Length(3, 100).WithMessage("Module name must be between 3 and 100 characters long.");

            RuleFor(module => module.Description)
                .Must(description => description!.Trim().Length <= MaxDescriptionLength)
                .When(module => module.Description != null)
                .WithMessage($"Description must be {MaxDescriptionLength} characters or fewer.");
        }

        private async Task<bool> IsNameUniqueAsync(string? itemId, string name)
        {
            var existing = await _moduleRepository.GetByNameAsync(name);
            if (existing == null) return true;
            return existing.ItemId == itemId;
        }
    }
}