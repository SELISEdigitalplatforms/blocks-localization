using Eurolm.DomainService.Services;
using FluentValidation;

namespace Eurolm.DomainService.Validation
{
    public class TranslateBlocksLanguageKeysRequestValidator : AbstractValidator<TranslateBlocksLanguageKeysRequest>
    {
        public TranslateBlocksLanguageKeysRequestValidator()
        {
            // Validate ProjectKey
         

            // Validate the target: KeyIds or Filter, never both
            RuleFor(request => request)
                .Must(request => (request.KeyIds is { Count: > 0 }) != (request.Filter != null))
                .OverridePropertyName(BulkKeyTarget.Field)
                .WithMessage(BulkKeyTarget.TargetRequiredMessage);

            RuleFor(request => request.KeyIds)
                .Must(ids => ids!.Count <= BulkKeyTarget.MaxKeys)
                .When(request => request.KeyIds != null)
                .OverridePropertyName(BulkKeyTarget.Field)
                .WithMessage(BulkKeyTarget.TooManyKeys);

            When(request => request.Filter != null, () =>
            {
                RuleFor(request => request.Filter!).SetValidator(new GetKeysRequestValidator(validatePaging: false));

                RuleFor(request => request.ExpectedCount)
                    .NotNull().WithMessage("ExpectedCount is required with Filter.")
                    .GreaterThanOrEqualTo(1).WithMessage("ExpectedCount must be at least 1.");

                RuleFor(request => request.ExcludedKeyIds)
                    .Must(ids => ids!.Count <= BulkKeyTarget.MaxKeys)
                    .When(request => request.ExcludedKeyIds != null)
                    .WithMessage($"ExcludedKeyIds cannot exceed {BulkKeyTarget.MaxKeys} items.");
            });

            RuleFor(request => request.ExcludedKeyIds)
                .Null()
                .When(request => request.Filter == null)
                .WithMessage("ExcludedKeyIds is allowed only with Filter.");

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
