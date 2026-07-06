using Eurolm.DomainService.Services;
using FluentValidation;

namespace Eurolm.DomainService.Validation
{
    public class TranslateBlocksLanguageKeysRequestValidator : AbstractValidator<TranslateBlocksLanguageKeysRequest>
    {
        public TranslateBlocksLanguageKeysRequestValidator()
        {
            // Validate ProjectKey
         

            // Validate KeyIds
            RuleFor(request => request.KeyIds)
                .NotNull().WithMessage("KeyIds is required.")
                .Must(ids => ids != null && ids.Count > 0).WithMessage("KeyIds must contain at least one item.");

            RuleForEach(request => request.KeyIds)
                .NotEmpty().WithMessage("Each KeyId is required.")
                .Length(1, 50).WithMessage("Each KeyId must be between 1 and 50 characters long.");

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
