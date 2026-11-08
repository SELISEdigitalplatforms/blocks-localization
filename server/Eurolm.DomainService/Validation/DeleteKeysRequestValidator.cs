using Eurolm.DomainService.Services;
using FluentValidation;

namespace Eurolm.DomainService.Validation
{
    /// <summary>
    /// A bulk delete names its keys either by ID or by filter. Target errors are reported under
    /// <see cref="BulkKeyTarget.Field"/>.
    /// </summary>
    public class DeleteKeysRequestValidator : AbstractValidator<DeleteKeysRequest>
    {
        public DeleteKeysRequestValidator()
        {
            RuleFor(request => request)
                .Must(request => HasIds(request) != (request.Filter != null))
                .OverridePropertyName(BulkKeyTarget.Field)
                .WithMessage(BulkKeyTarget.TargetRequiredMessage);

            RuleFor(request => request.ItemIds)
                .Must(ids => ids.Count <= BulkKeyTarget.MaxKeys)
                .When(request => request.ItemIds != null)
                .OverridePropertyName(BulkKeyTarget.Field)
                .WithMessage(BulkKeyTarget.TooManyKeys);

            When(request => request.Filter != null, () =>
            {
                RuleFor(request => request.Filter!).SetValidator(new GetKeysRequestValidator(validatePaging: false));

                RuleFor(request => request.ExpectedCount)
                    .NotNull().WithMessage("ExpectedCount is required with Filter.")
                    .GreaterThanOrEqualTo(1).WithMessage("ExpectedCount must be at least 1.");

                RuleFor(request => request.ExcludedItemIds)
                    .Must(ids => ids!.Count <= BulkKeyTarget.MaxKeys)
                    .When(request => request.ExcludedItemIds != null)
                    .WithMessage($"ExcludedItemIds cannot exceed {BulkKeyTarget.MaxKeys} items.");
            });

            RuleFor(request => request.ExcludedItemIds)
                .Null()
                .When(request => request.Filter == null)
                .WithMessage("ExcludedItemIds is allowed only with Filter.");
        }

        private static bool HasIds(DeleteKeysRequest request) => request.ItemIds is { Count: > 0 };
    }
}
