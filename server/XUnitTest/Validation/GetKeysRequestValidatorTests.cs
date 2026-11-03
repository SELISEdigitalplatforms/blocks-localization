using System.Linq;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Validation;
using FluentAssertions;
using Xunit;

namespace XUnitTest
{
    public class GetKeysRequestValidatorTests
    {
        private readonly GetKeysRequestValidator _validator = new();

        private string[] ErrorCodes(GetKeysRequest request) =>
            _validator.Validate(request).Errors.Select(e => e.ErrorCode).ToArray();

        [Theory]
        [InlineData(0)]
        [InlineData(10)]
        [InlineData(5000)] // clamped by the repository, not rejected
        public void A_non_negative_page_size_is_accepted(int pageSize)
        {
            ErrorCodes(new GetKeysRequest { PageSize = pageSize }).Should().BeEmpty();
        }

        [Fact]
        public void A_negative_page_size_is_rejected()
        {
            ErrorCodes(new GetKeysRequest { PageSize = -1 }).Should().Equal(KeyListErrorCodes.InvalidPageSize);
        }

        [Fact]
        public void A_negative_page_number_is_rejected()
        {
            ErrorCodes(new GetKeysRequest { PageSize = 10, PageNumber = -1 }).Should().Equal(KeyListErrorCodes.InvalidPageNumber);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("KeyName")]
        [InlineData("createDate")]
        [InlineData("LASTUPDATEDATE")]
        public void Whitelisted_or_blank_sort_properties_are_accepted(string? sortProperty)
        {
            ErrorCodes(new GetKeysRequest { PageSize = 10, SortProperty = sortProperty }).Should().BeEmpty();
        }

        [Theory]
        [InlineData("Resources.Value")]
        [InlineData("ModuleId")]
        [InlineData("KeyNam")]
        public void Other_sort_properties_are_rejected(string sortProperty)
        {
            ErrorCodes(new GetKeysRequest { PageSize = 10, SortProperty = sortProperty }).Should().Equal(KeyListErrorCodes.InvalidSortProperty);
        }

        [Fact]
        public void Search_text_over_the_limit_is_rejected_in_every_search_field()
        {
            var tooLong = new string('a', GetKeysRequestValidator.MaxSearchTextLength + 1);

            ErrorCodes(new GetKeysRequest { KeySearchText = tooLong }).Should().Equal(KeyListErrorCodes.SearchTextTooLong);
            ErrorCodes(new GetKeysRequest { SearchKey = tooLong }).Should().Equal(KeyListErrorCodes.SearchTextTooLong);
            ErrorCodes(new GetKeysRequest
            {
                ResourceSearchFilters = new[] { new ResourceSearchFilter { Culture = "en-US", SearchText = tooLong } }
            }).Should().Equal(KeyListErrorCodes.SearchTextTooLong);
        }

        [Fact]
        public void Search_text_at_the_limit_is_accepted()
        {
            var atLimit = new string('a', GetKeysRequestValidator.MaxSearchTextLength);

            ErrorCodes(new GetKeysRequest { KeySearchText = atLimit, SearchKey = atLimit }).Should().BeEmpty();
        }
    }
}
