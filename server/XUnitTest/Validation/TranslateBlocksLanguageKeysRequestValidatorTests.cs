using Eurolm.DomainService.Services;
using Eurolm.DomainService.Validation;
using FluentAssertions;
using Xunit;

namespace XUnitTest
{
    public class TranslateBlocksLanguageKeysRequestValidatorTests
    {
        private readonly TranslateBlocksLanguageKeysRequestValidator _validator = new();

        private static TranslateBlocksLanguageKeysRequest CreateValidRequest() => new()
        {
            KeyIds = new List<string> { "key-1", "key-2" },
            DefaultLanguage = "en-US",
            MessageCoRelationId = "corr-123",
            ProjectKey = "proj"
        };

        [Fact]
        public async Task Validate_ValidRequest_ReturnsSuccess()
        {
            var result = await _validator.ValidateAsync(CreateValidRequest());
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_EmptyKeyIds_ReturnsError()
        {
            var request = CreateValidRequest();
            request.KeyIds = new List<string>();

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == BulkKeyTarget.Field && e.ErrorMessage == BulkKeyTarget.TargetRequiredMessage);
        }

        private static TranslateBlocksLanguageKeysRequest CreateFilterRequest() => new()
        {
            Filter = new GetKeysRequest { ModuleIds = new[] { "m1" } },
            ExpectedCount = 935,
            DefaultLanguage = "en-US",
            MessageCoRelationId = "corr-123",
            ProjectKey = "proj"
        };

        [Fact]
        public async Task Validate_FilterForm_ReturnsSuccess()
        {
            var result = await _validator.ValidateAsync(CreateFilterRequest());
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_FilterForm_IgnoresPagingFields()
        {
            var request = CreateFilterRequest();
            request.Filter!.PageSize = -1;
            request.Filter.PageNumber = -1;
            request.Filter.Cursor = new string('x', 2049);

            (await _validator.ValidateAsync(request)).IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_BothKeyIdsAndFilter_ReturnsTargetError()
        {
            var request = CreateFilterRequest();
            request.KeyIds = new List<string> { "key-1" };

            var result = await _validator.ValidateAsync(request);

            result.Errors.Should().Contain(e => e.PropertyName == BulkKeyTarget.Field && e.ErrorMessage == BulkKeyTarget.TargetRequiredMessage);
        }

        [Fact]
        public async Task Validate_NeitherKeyIdsNorFilter_ReturnsTargetError()
        {
            var request = CreateValidRequest();
            request.KeyIds = null;

            var result = await _validator.ValidateAsync(request);

            result.Errors.Should().Contain(e => e.PropertyName == BulkKeyTarget.Field && e.ErrorMessage == BulkKeyTarget.TargetRequiredMessage);
        }

        [Fact]
        public async Task Validate_MoreThan10000KeyIds_ReturnsTooManyKeys()
        {
            var request = CreateValidRequest();
            request.KeyIds = Enumerable.Range(0, 10_001).Select(i => $"k{i}").ToList();

            var result = await _validator.ValidateAsync(request);

            result.Errors.Should().Contain(e => e.PropertyName == BulkKeyTarget.Field && e.ErrorMessage == BulkKeyTarget.TooManyKeys);
        }

        [Fact]
        public async Task Validate_Exactly10000KeyIds_IsValid()
        {
            var request = CreateValidRequest();
            request.KeyIds = Enumerable.Range(0, 10_000).Select(i => $"k{i}").ToList();

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeTrue();
        }

        [Theory]
        [InlineData(null)]
        [InlineData(0L)]
        public async Task Validate_FilterWithoutAPositiveExpectedCount_ReturnsError(long? expectedCount)
        {
            var request = CreateFilterRequest();
            request.ExpectedCount = expectedCount;

            var result = await _validator.ValidateAsync(request);

            result.Errors.Should().Contain(e => e.PropertyName == nameof(TranslateBlocksLanguageKeysRequest.ExpectedCount));
        }

        [Fact]
        public async Task Validate_ExcludedKeyIdsWithoutFilter_ReturnsError()
        {
            var request = CreateValidRequest();
            request.ExcludedKeyIds = new List<string> { "key-3" };

            var result = await _validator.ValidateAsync(request);

            result.Errors.Should().Contain(e => e.PropertyName == nameof(TranslateBlocksLanguageKeysRequest.ExcludedKeyIds));
        }

        [Fact]
        public async Task Validate_FilterWithAnInvalidSort_ReturnsTheKeyListError()
        {
            var request = CreateFilterRequest();
            request.Filter!.SortProperty = "Nope";

            var result = await _validator.ValidateAsync(request);

            result.Errors.Should().Contain(e => e.ErrorCode == "INVALID_SORT_PROPERTY");
        }

        [Fact]
        public async Task Validate_KeyIdItemEmpty_ReturnsError()
        {
            var request = CreateValidRequest();
            request.KeyIds = new List<string> { "" };

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage == "Each KeyId is required.");
        }

        [Fact]
        public async Task Validate_KeyIdItemTooLong_ReturnsError()
        {
            var request = CreateValidRequest();
            request.KeyIds = new List<string> { new string('k', 51) };

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage == "Each KeyId must be between 1 and 50 characters long.");
        }

        [Theory]
        [InlineData("")]
        [InlineData("e")]
        [InlineData("EN-US")]
        [InlineData("en-usa")]
        public async Task Validate_InvalidDefaultLanguage_ReturnsError(string language)
        {
            var request = CreateValidRequest();
            request.DefaultLanguage = language;

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == nameof(TranslateBlocksLanguageKeysRequest.DefaultLanguage));
        }

        [Fact]
        public async Task Validate_EmptyMessageCoRelationId_ReturnsError()
        {
            var request = CreateValidRequest();
            request.MessageCoRelationId = "";

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage == "MessageCoRelationId is required.");
        }

        [Fact]
        public async Task Validate_MessageCoRelationIdTooLong_ReturnsError()
        {
            var request = CreateValidRequest();
            request.MessageCoRelationId = new string('m', 101);

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage == "MessageCoRelationId must be between 1 and 100 characters long.");
        }
    }
}
