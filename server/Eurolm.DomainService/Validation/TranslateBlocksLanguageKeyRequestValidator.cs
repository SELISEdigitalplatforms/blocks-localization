using Eurolm.DomainService.Services;
using FluentValidation;

namespace Eurolm.DomainService.Validation
{
    public class TranslateBlocksLanguageKeyRequestValidator : AbstractValidator<TranslateBlocksLanguageKeyRequest>
    {
        public TranslateBlocksLanguageKeyRequestValidator()
        {
            // Validate ProjectKey
            //RuleFor(request => request.ProjectKey)
            //    .NotEmpty().WithMessage("ProjectKey is required.")
            //    .Length(1, 100).WithMessage("ProjectKey must be between 1 and 100 characters long.");

            // Validate KeyId
            RuleFor(request => request.KeyId)
                .NotEmpty().WithMessage("KeyId is required.")
                .Length(1, 50).WithMessage("KeyId must be between 1 and 50 characters long.");

            // Validate DefaultLanguage
            RuleFor(request => request.DefaultLanguage)
                .NotEmpty().WithMessage("DefaultLanguage is required.")
                .Length(2, 10).WithMessage("DefaultLanguage must be between 2 and 10 characters long.")
                .Matches(@"^[a-z]{2}(-[A-Z]{2})?$").WithMessage("DefaultLanguage must be in format 'xx' or 'xx-XX' (e.g., 'en' or 'en-US').");

            // Validate MessageCoRelationId
            RuleFor(request => request.MessageCoRelationId)
                .NotEmpty().WithMessage("MessageCoRelationId is required.")
                .Length(1, 100).WithMessage("MessageCoRelationId must be between 1 and 100 characters long.");
        }
    }
}