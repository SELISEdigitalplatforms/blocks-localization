using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using Moq;
using Xunit;

namespace XUnitTest
{
    public class GlossaryValidatorTests
    {
        private readonly GlossaryValidator _validator;
        private readonly Mock<IGlossaryRepository> _glossaryRepositoryMock;

        public GlossaryValidatorTests()
        {
            _glossaryRepositoryMock = new Mock<IGlossaryRepository>();
            _glossaryRepositoryMock
                .Setup(r => r.GetByNameAsync(It.IsAny<string>()))
                .ReturnsAsync((Glossary)null);
            _validator = new GlossaryValidator(_glossaryRepositoryMock.Object);
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

        [Fact]
        public async Task Validate_DuplicateName_ReturnsError()
        {
            // Arrange
            var glossary = new Glossary { Name = "API", ProjectKey = "test-project" };
            var existing = new Glossary { ItemId = "existing-id", Name = "API" };

            _glossaryRepositoryMock
                .Setup(r => r.GetByNameAsync("API"))
                .ReturnsAsync(existing);

            // Act
            var result = await _validator.ValidateAsync(glossary);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == "Name" && e.ErrorMessage == "Glossary name must be unique.");
        }

        [Fact]
        public async Task Validate_SameGlossaryUpdate_ReturnsSuccess()
        {
            // Arrange
            var glossary = new Glossary { ItemId = "existing-id", Name = "API", ProjectKey = "test-project" };
            var existing = new Glossary { ItemId = "existing-id", Name = "API" };

            _glossaryRepositoryMock
                .Setup(r => r.GetByNameAsync("API"))
                .ReturnsAsync(existing);

            // Act
            var result = await _validator.ValidateAsync(glossary);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_UniqueNameNewGlossary_ReturnsSuccess()
        {
            // Arrange
            var glossary = new Glossary { Name = "REST", ProjectKey = "test-project" };

            // Act
            var result = await _validator.ValidateAsync(glossary);

            // Assert
            result.IsValid.Should().BeTrue();
        }
    }
}
