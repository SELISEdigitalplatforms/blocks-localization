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
                .Setup(r => r.GetByNameInsensitiveAsync(It.IsAny<string>()))
                .ReturnsAsync(new List<Glossary>());
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
                AdditionalNote = "Commonly abbreviated as API"
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
                Name = ""
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
                Name = null
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
                Name = new string('a', 201)
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
                AdditionalNote = null
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
                Name = new string('a', 200)
            };

            // Act
            var result = await _validator.ValidateAsync(glossary);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        private void SetupMatches(string name, params Glossary[] matches) =>
            _glossaryRepositoryMock.Setup(r => r.GetByNameInsensitiveAsync(name)).ReturnsAsync(matches.ToList());

        private static bool HasUniqueError(FluentValidation.Results.ValidationResult result) =>
            result.Errors.Any(e => e.PropertyName == "Name" && e.ErrorMessage == "Glossary name must be unique.");

        [Fact]
        public async Task Validate_DuplicateName_ReturnsError()
        {
            SetupMatches("API", new Glossary { ItemId = "existing-id", Name = "API" });

            var result = await _validator.ValidateAsync(new Glossary { Name = "API" });

            result.IsValid.Should().BeFalse();
            HasUniqueError(result).Should().BeTrue();
        }

        [Fact]
        public async Task Validate_CreateCaseDuplicate_ReturnsError()
        {
            SetupMatches("workspace", new Glossary { ItemId = "existing-id", Name = "Workspace" });

            var result = await _validator.ValidateAsync(new Glossary { Name = "workspace" });

            HasUniqueError(result).Should().BeTrue();
        }

        [Fact]
        public async Task Validate_CreateNfcDuplicateOfNfdName_ReturnsError()
        {
            SetupMatches("Caf\u00e9", new Glossary { ItemId = "existing-id", Name = "Cafe\u0301" });

            var result = await _validator.ValidateAsync(new Glossary { Name = "Caf\u00e9" });

            HasUniqueError(result).Should().BeTrue();
        }

        [Fact]
        public async Task Validate_SameGlossaryUpdate_ReturnsSuccess()
        {
            SetupMatches("API", new Glossary { ItemId = "existing-id", Name = "API" });

            var result = await _validator.ValidateAsync(new Glossary { ItemId = "existing-id", Name = "API" });

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_LegacyCaseDuplicateSavedWithUnchangedName_ReturnsSuccess()
        {
            // "e2e dup" and "E2E DUP" both exist; editing "e2e dup" without renaming it must still save.
            SetupMatches("e2e dup",
                new Glossary { ItemId = "lower", Name = "e2e dup" },
                new Glossary { ItemId = "upper", Name = "E2E DUP" });

            var result = await _validator.ValidateAsync(new Glossary { ItemId = "lower", Name = "e2e dup" });

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_LegacyCaseDuplicateRecasedOnly_ReturnsSuccess()
        {
            SetupMatches("E2E Dup",
                new Glossary { ItemId = "lower", Name = "e2e dup" },
                new Glossary { ItemId = "upper", Name = "E2E DUP" });

            var result = await _validator.ValidateAsync(new Glossary { ItemId = "lower", Name = "E2E Dup" });

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_RenameIntoAnotherGlossarysName_ReturnsError()
        {
            SetupMatches("workspace", new Glossary { ItemId = "other-id", Name = "Workspace" });

            var result = await _validator.ValidateAsync(new Glossary { ItemId = "my-id", Name = "workspace" });

            HasUniqueError(result).Should().BeTrue();
        }

        [Fact]
        public async Task Validate_UniqueNameNewGlossary_ReturnsSuccess()
        {
            // Arrange
            var glossary = new Glossary { Name = "REST" };

            // Act
            var result = await _validator.ValidateAsync(glossary);

            // Assert
            result.IsValid.Should().BeTrue();
        }
    }
}
