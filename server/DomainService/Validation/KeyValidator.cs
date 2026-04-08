using BlocksTemplate.DomainService.Repositories;
using FluentValidation;
using System.Linq;

namespace BlocksTemplate.DomainService.Services
{
    public class KeyValidator : AbstractValidator<Key>
    {
        private readonly IKeyRepository _keyRepository;

        public KeyValidator(IKeyRepository keyRepository)
        {
            _keyRepository = keyRepository;

            // Validate KeyName
            RuleFor(key => key.KeyName)
                .NotEmpty().WithMessage("KeyName is required.")
                .Length(2, 100).WithMessage("KeyName must be between 2 and 100 characters long.");

            // Validate Module
            RuleFor(key => key.ModuleId)
                .NotEmpty().WithMessage("Module is required.")
                .Length(2, 50).WithMessage("Module must be between 2 and 50 characters long.");

            RuleFor(key => key.IsNewKey)
                .MustAsync(async (key, isNewKey, cancellation) =>
                {
                    if (!isNewKey) return true;

                    var existingKey = await _keyRepository.GetKeyByNameAsync(key.KeyName, key.ModuleId);
                    return existingKey == null;
                })
                .WithMessage("KeyName and ModuleId combination must not already exist for this key.");
        }
    }
}
