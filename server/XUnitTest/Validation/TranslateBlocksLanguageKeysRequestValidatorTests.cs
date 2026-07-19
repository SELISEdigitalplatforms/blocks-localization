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
            result.Errors.Should().Contain(e => e.ErrorMessage == "KeyIds must contain at least one item.");
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
