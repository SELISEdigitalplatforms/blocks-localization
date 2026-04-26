using Eurolm.DomainService.Services;
using FluentAssertions;
using Xunit;

namespace XUnitTest
{
    public class GlossaryValidatorTests
    {
        private readonly GlossaryValidator _validator;

        public GlossaryValidatorTests()
        {
            _validator = new GlossaryValidator();
        }

        [Fact]
        public async Task Validate_ValidGlossary_ReturnsSuccess()
        {
            // Arrange
            var glossary = new Glossary
            {
                Name = "Application Programming Interface",
                Language = "en-US",
                Type = "Full form",
                Context = "Used in software development",
                AdditionalNote = "Commonly abbreviated as API",
                ProjectKey = "test-project"
            };

            // Act
            var result = await _validator.ValidateAsync(glossary);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_EmptyName_ReturnsError()
        {
            // Arrange
            var glossary = new Glossary
            {
                Name = "",
                ProjectKey = "test-project"
            };

            // Act
            var result = await _validator.ValidateAsync(glossary);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == "Name");
        }

        [Fact]
        public async Task Validate_NullName_ReturnsError()
        {
            // Arrange
            var glossary = new Glossary
            {
                Name = null,
                ProjectKey = "test-project"
            };

            // Act
            var result = await _validator.ValidateAsync(glossary);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == "Name");
        }

        [Fact]
        public async Task Validate_NameTooLong_ReturnsError()
        {
            // Arrange
            var glossary = new Glossary
            {
                Name = new string('a', 201),
                ProjectKey = "test-project"
            };

            // Act
            var result = await _validator.ValidateAsync(glossary);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == "Name");
        }

        [Fact]
        public async Task Validate_OptionalFieldsNull_ReturnsSuccess()
        {
            // Arrange
            var glossary = new Glossary
            {
                Name = "API",
                Language = null,
                Type = null,
                Context = null,
                AdditionalNote = null,
                ProjectKey = "test-project"
            };

            // Act
            var result = await _validator.ValidateAsync(glossary);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_NameWithMaxLength_ReturnsSuccess()
        {
            // Arrange
            var glossary = new Glossary
            {
                Name = new string('a', 200),
                ProjectKey = "test-project"
            };

            // Act
            var result = await _validator.ValidateAsync(glossary);

            // Assert
            result.IsValid.Should().BeTrue();
        }
    }
}
