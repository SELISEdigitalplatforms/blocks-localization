using Eurolm.DomainService.Repositories;
using FluentValidation;

namespace Eurolm.DomainService.Services
{
    public class ModuleValidator : AbstractValidator<Module>
    {
        private readonly  IModuleRepository _moduleRepository;

        public ModuleValidator(IModuleRepository moduleRepository)
        {
            _moduleRepository = moduleRepository;

            RuleFor(module => module.ModuleName)
                .NotEmpty().WithMessage("Module name is required.")
                .MustAsync(async (name, cancellationToken) => await IsNameUniqueAsync(name))
                .WithMessage("The name must be unique.")
                .Length(3, 100).WithMessage("Module name must be between 3 and 100 characters long.");
        }

        private async Task<bool> IsNameUniqueAsync(string name)
        {
            var configuration = await _moduleRepository.GetByNameAsync(name);
            return configuration == null;
        }
    }
}