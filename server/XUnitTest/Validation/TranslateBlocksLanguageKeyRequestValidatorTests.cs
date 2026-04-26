using Eurolm.DomainService.Services;
using Eurolm.DomainService.Validation;
using FluentAssertions;

namespace XUnitTest
{
    public class TranslateBlocksLanguageKeyRequestValidatorTests
    {
        private readonly TranslateBlocksLanguageKeyRequestValidator _validator = new();

        [Fact]
        public async Task Validate_ValidRequest_ReturnsSuccess()
        {
            var request = CreateValidRequest();

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_EmptyProjectKey_ReturnsExpectedError()
        {
            var request = CreateValidRequest();
            request.ProjectKey = string.Empty;

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e =>
                e.PropertyName == nameof(TranslateBlocksLanguageKeyRequest.ProjectKey) &&
                e.ErrorMessage == "ProjectKey is required.");
        }

        [Fact]
        public async Task Validate_ProjectKeyTooLong_ReturnsExpectedError()
        {
            var request = CreateValidRequest();
            request.ProjectKey = new string('p', 101);

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e =>
                e.PropertyName == nameof(TranslateBlocksLanguageKeyRequest.ProjectKey) &&
                e.ErrorMessage == "ProjectKey must be between 1 and 100 characters long.");
        }

        [Fact]
        public async Task Validate_EmptyKeyId_ReturnsExpectedError()
        {
            var request = CreateValidRequest();
            request.KeyId = string.Empty;

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e =>
                e.PropertyName == nameof(TranslateBlocksLanguageKeyRequest.KeyId) &&
                e.ErrorMessage == "KeyId is required.");
        }

        [Fact]
        public async Task Validate_KeyIdTooLong_ReturnsExpectedError()
        {
            var request = CreateValidRequest();
            request.KeyId = new string('k', 51);

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e =>
                e.PropertyName == nameof(TranslateBlocksLanguageKeyRequest.KeyId) &&
                e.ErrorMessage == "KeyId must be between 1 and 50 characters long.");
        }

        [Theory]
        [InlineData("")]
        [InlineData("e")]
        [InlineData("english")]
        [InlineData("en-us")]
        [InlineData("EN-US")]
        [InlineData("en-USA")]
        public async Task Validate_InvalidDefaultLanguage_ReturnsValidationError(string invalidLanguage)
        {
            var request = CreateValidRequest();
            request.DefaultLanguage = invalidLanguage;

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == nameof(TranslateBlocksLanguageKeyRequest.DefaultLanguage));
        }

        [Theory]
        [InlineData("en")]
        [InlineData("en-US")]
        [InlineData("fr")]
        [InlineData("de-DE")]
        public async Task Validate_ValidDefaultLanguageFormats_ReturnSuccess(string language)
        {
            var request = CreateValidRequest();
            request.DefaultLanguage = language;

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_DefaultLanguageTooLong_ReturnsExpectedError()
        {
            var request = CreateValidRequest();
            request.DefaultLanguage = "ab-CDEFGHIJ";

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e =>
                e.PropertyName == nameof(TranslateBlocksLanguageKeyRequest.DefaultLanguage) &&
                e.ErrorMessage == "DefaultLanguage must be between 2 and 10 characters long.");
        }

        [Fact]
        public async Task Validate_EmptyMessageCoRelationId_ReturnsExpectedError()
        {
            var request = CreateValidRequest();
            request.MessageCoRelationId = string.Empty;

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e =>
                e.PropertyName == nameof(TranslateBlocksLanguageKeyRequest.MessageCoRelationId) &&
                e.ErrorMessage == "MessageCoRelationId is required.");
        }

        [Fact]
        public async Task Validate_MessageCoRelationIdTooLong_ReturnsExpectedError()
        {
            var request = CreateValidRequest();
            request.MessageCoRelationId = new string('m', 101);

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e =>
                e.PropertyName == nameof(TranslateBlocksLanguageKeyRequest.MessageCoRelationId) &&
                e.ErrorMessage == "MessageCoRelationId must be between 1 and 100 characters long.");
        }

        private static TranslateBlocksLanguageKeyRequest CreateValidRequest()
        {
            return new TranslateBlocksLanguageKeyRequest
            {
                ProjectKey = "tenant-1",
                KeyId = "key-123",
                DefaultLanguage = "en-US",
                MessageCoRelationId = "corr-123"
            };
        }
    }
}
