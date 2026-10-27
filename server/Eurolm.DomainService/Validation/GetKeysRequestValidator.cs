using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentValidation;

namespace Eurolm.DomainService.Validation
{
    /// <summary>
    /// Rejects Key/Gets requests that would otherwise reach Mongo as a 500 or an unbounded query.
    /// Each rule's error code is the API error code the client branches on.
    /// </summary>
    public class GetKeysRequestValidator : AbstractValidator<GetKeysRequest>
    {
        public const int MaxSearchTextLength = 200;
        private const int MaxCursorLength = 2048;

        public GetKeysRequestValidator()
        {
            RuleFor(request => request.PageSize)
                .GreaterThanOrEqualTo(0).WithErrorCode(KeyListErrorCodes.InvalidPageSize)
                .WithMessage("PageSize cannot be negative.");

            RuleFor(request => request.PageNumber)
                .GreaterThanOrEqualTo(0).WithErrorCode(KeyListErrorCodes.InvalidPageNumber)
                .WithMessage("PageNumber cannot be negative.");

            RuleFor(request => request.SortProperty)
                .Must(sort => KeyListCursor.ResolveSortField(sort) != null).WithErrorCode(KeyListErrorCodes.InvalidSortProperty)
                .WithMessage($"SortProperty must be one of: {string.Join(", ", KeyListCursor.SortFields)}.");

            RuleFor(request => request.Cursor)
                .MaximumLength(MaxCursorLength).WithErrorCode(KeyListErrorCodes.InvalidCursor)
                .WithMessage("Cursor is not valid.");

            RuleFor(request => request.KeySearchText)
                .MaximumLength(MaxSearchTextLength).WithErrorCode(KeyListErrorCodes.SearchTextTooLong)
                .WithMessage($"Search text cannot exceed {MaxSearchTextLength} characters.");

            RuleFor(request => request.SearchKey)
                .MaximumLength(MaxSearchTextLength).WithErrorCode(KeyListErrorCodes.SearchTextTooLong)
                .WithMessage($"Search text cannot exceed {MaxSearchTextLength} characters.");

            RuleForEach(request => request.ResourceSearchFilters)
                .Must(filter => filter == null || (filter.SearchText?.Length ?? 0) <= MaxSearchTextLength)
                .WithErrorCode(KeyListErrorCodes.SearchTextTooLong)
                .WithMessage($"Search text cannot exceed {MaxSearchTextLength} characters.");
        }
    }
}
