using FluentValidation;

namespace Eurolm.DomainService.Services
{
    public class LanguageValidator : AbstractValidator<Language>
    {
        public LanguageValidator()
        {
            // Validation for LanguageName
            RuleFor(language => language.LanguageName)
                .NotEmpty().WithMessage("Language name is required.")
                .Length(2, 100).WithMessage("Language name must be between 2 and 100 characters long.");

            // Validation for LanguageCode
            RuleFor(language => language.LanguageCode)
                .NotEmpty().WithMessage("Language code is required.")
                .Matches(@"^([a-z]{2,3}-[A-Z]{2,10}|[a-z]{2,3}-x-[A-Za-z]{1,8})$").WithMessage("Language code must follow the format 'xx-XX', 'xxx-XX', or 'xx-x-Y' (e.g., 'en-US', 'zho-CN', 'en-x-cave').");

            // Validation for IsDefault (no need for validation, it's a boolean)
        }
    }
}
