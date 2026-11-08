using Eurolm.DomainService.Services;
using Eurolm.DomainService.Validation;
using FluentAssertions;
using Xunit;

namespace XUnitTest
{
    public class DeleteKeysRequestValidatorTests
    {
        private readonly DeleteKeysRequestValidator _validator = new();

        private static DeleteKeysRequest FilterRequest() => new()
        {
            Filter = new GetKeysRequest { ModuleIds = new[] { "m1" } },
            ExcludedItemIds = new List<string> { "k9" },
            ExpectedCount = 933
        };

        [Fact]
        public async Task Validate_ItemIds_IsValid()
        {
            var result = await _validator.ValidateAsync(new DeleteKeysRequest { ItemIds = new List<string> { "k1" } });
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_FilterForm_IsValid()
        {
            var result = await _validator.ValidateAsync(FilterRequest());
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_FilterForm_IgnoresPagingFields()
        {
            var request = FilterRequest();
            request.Filter!.PageSize = -1;
            request.Filter.PageNumber = -1;
            request.Filter.Cursor = new string('x', 2049);

            (await _validator.ValidateAsync(request)).IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_NeitherIdsNorFilter_ReturnsTargetError()
        {
            var result = await _validator.ValidateAsync(new DeleteKeysRequest());

            result.Errors.Should().Contain(e => e.PropertyName == BulkKeyTarget.Field && e.ErrorMessage == BulkKeyTarget.TargetRequiredMessage);
        }

        [Fact]
        public async Task Validate_NullItemIdsAndNoFilter_ReturnsTargetErrorWithoutThrowing()
        {
            var result = await _validator.ValidateAsync(new DeleteKeysRequest { ItemIds = null! });

            result.Errors.Should().Contain(e => e.PropertyName == BulkKeyTarget.Field);
        }

        [Fact]
        public async Task Validate_BothIdsAndFilter_ReturnsTargetError()
        {
            var request = FilterRequest();
            request.ItemIds = new List<string> { "k1" };

            var result = await _validator.ValidateAsync(request);

            result.Errors.Should().Contain(e => e.PropertyName == BulkKeyTarget.Field && e.ErrorMessage == BulkKeyTarget.TargetRequiredMessage);
        }

        [Fact]
        public async Task Validate_MoreThan10000ItemIds_ReturnsTooManyKeys()
        {
            var request = new DeleteKeysRequest { ItemIds = Enumerable.Range(0, 10_001).Select(i => $"k{i}").ToList() };

            var result = await _validator.ValidateAsync(request);

            result.Errors.Should().Contain(e => e.PropertyName == BulkKeyTarget.Field && e.ErrorMessage == BulkKeyTarget.TooManyKeys);
        }

        [Fact]
        public async Task Validate_Exactly10000ItemIds_IsValid()
        {
            var request = new DeleteKeysRequest { ItemIds = Enumerable.Range(0, 10_000).Select(i => $"k{i}").ToList() };

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeTrue();
        }

        [Theory]
        [InlineData(null)]
        [InlineData(0L)]
        [InlineData(-1L)]
        public async Task Validate_FilterWithoutAPositiveExpectedCount_ReturnsError(long? expectedCount)
        {
            var request = FilterRequest();
            request.ExpectedCount = expectedCount;

            var result = await _validator.ValidateAsync(request);

            result.Errors.Should().Contain(e => e.PropertyName == nameof(DeleteKeysRequest.ExpectedCount));
        }

        [Fact]
        public async Task Validate_ExcludedItemIdsWithoutFilter_ReturnsError()
        {
            var request = new DeleteKeysRequest { ItemIds = new List<string> { "k1" }, ExcludedItemIds = new List<string> { "k2" } };

            var result = await _validator.ValidateAsync(request);

            result.Errors.Should().Contain(e => e.PropertyName == nameof(DeleteKeysRequest.ExcludedItemIds));
        }

        [Fact]
        public async Task Validate_MoreThan10000ExcludedItemIds_ReturnsError()
        {
            var request = FilterRequest();
            request.ExcludedItemIds = Enumerable.Range(0, 10_001).Select(i => $"k{i}").ToList();

            var result = await _validator.ValidateAsync(request);

            result.Errors.Should().Contain(e => e.PropertyName == nameof(DeleteKeysRequest.ExcludedItemIds));
        }

        [Fact]
        public async Task Validate_FilterWithTooLongSearchText_ReturnsTheKeyListError()
        {
            var request = FilterRequest();
            request.Filter!.KeySearchText = new string('a', GetKeysRequestValidator.MaxSearchTextLength + 1);

            var result = await _validator.ValidateAsync(request);

            result.Errors.Should().Contain(e => e.ErrorCode == "SEARCH_TEXT_TOO_LONG");
        }
    }
}
