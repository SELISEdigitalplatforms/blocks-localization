using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Services;
using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using BlocksLanguage = BlocksTemplate.DomainService.Repositories.BlocksLanguage;
using LanguageModel = BlocksTemplate.DomainService.Services.Language;

namespace XUnitTest
{
    public class LanguageManagementServiceTests
    {
        private readonly Mock<ILogger<LanguageManagementService>> _loggerMock;
        private readonly Mock<ILanguageRepository> _languageRepositoryMock;
        private readonly Mock<IValidator<LanguageModel>> _validatorMock;
        private readonly LanguageManagementService _service;

        public LanguageManagementServiceTests()
        {
            _loggerMock = new Mock<ILogger<LanguageManagementService>>();
            _languageRepositoryMock = new Mock<ILanguageRepository>();
            _validatorMock = new Mock<IValidator<LanguageModel>>();
            
            _service = new LanguageManagementService(
                _validatorMock.Object,
                _loggerMock.Object,
                _languageRepositoryMock.Object
            );
        }

        [Fact]
        public async Task SaveLanguageAsync_ValidLanguage_ReturnsSuccess()
        {
            // Arrange
            var language = new LanguageModel
            {
                LanguageName = "English",
                LanguageCode = "en-US",
                IsDefault = false,
                ProjectKey = "test-project"
            };

            var validationResult = new FluentValidation.Results.ValidationResult();
            _validatorMock.Setup(v => v.ValidateAsync(language, default))
                .ReturnsAsync(validationResult);

            _languageRepositoryMock.Setup(r => r.GetLanguageByNameAsync(language.LanguageName))
                .ReturnsAsync((BlocksLanguage)null);

            _languageRepositoryMock.Setup(r => r.SaveAsync(It.IsAny<BlocksLanguage>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.SaveLanguageAsync(language);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            _languageRepositoryMock.Verify(r => r.SaveAsync(It.IsAny<BlocksLanguage>()), Times.Once);
        }

        [Fact]
        public async Task SaveLanguageAsync_InvalidLanguage_ReturnsValidationError()
        {
            // Arrange
            var language = new LanguageModel
            {
                LanguageName = "",
                LanguageCode = "invalid",
                ProjectKey = "test-project"
            };

            var validationResult = new FluentValidation.Results.ValidationResult();
            validationResult.Errors.Add(new FluentValidation.Results.ValidationFailure("LanguageName", "Language name is required."));
            
            _validatorMock.Setup(v => v.ValidateAsync(language, default))
                .ReturnsAsync(validationResult);

            // Act
            var result = await _service.SaveLanguageAsync(language);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeFalse();
            _languageRepositoryMock.Verify(r => r.SaveAsync(It.IsAny<BlocksLanguage>()), Times.Never);
        }

        [Fact]
        public async Task SaveLanguageAsync_ExistingLanguage_UpdatesLanguage()
        {
            // Arrange
            var language = new LanguageModel
            {
                LanguageName = "English",
                LanguageCode = "en-US",
                IsDefault = true,
                ProjectKey = "test-project"
            };

            var existingLanguage = new BlocksLanguage
            {
                ItemId = "existing-id",
                LanguageName = "English",
                LanguageCode = "en-US",
                IsDefault = false,
                CreateDate = DateTime.UtcNow.AddDays(-1)
            };

            var validationResult = new FluentValidation.Results.ValidationResult();
            _validatorMock.Setup(v => v.ValidateAsync(language, default))
                .ReturnsAsync(validationResult);

            _languageRepositoryMock.Setup(r => r.GetLanguageByNameAsync(language.LanguageName))
                .ReturnsAsync(existingLanguage);

            _languageRepositoryMock.Setup(r => r.SaveAsync(It.IsAny<BlocksLanguage>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.SaveLanguageAsync(language);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            _languageRepositoryMock.Verify(r => r.SaveAsync(It.Is<BlocksLanguage>(l => 
                l.ItemId == existingLanguage.ItemId && 
                l.IsDefault == language.IsDefault)), Times.Once);
        }

        [Fact]
        public async Task SaveLanguageAsync_ExceptionThrown_ReturnsError()
        {
            // Arrange
            var language = new LanguageModel
            {
                LanguageName = "English",
                LanguageCode = "en-US",
                ProjectKey = "test-project"
            };

            var validationResult = new FluentValidation.Results.ValidationResult();
            _validatorMock.Setup(v => v.ValidateAsync(language, default))
                .ReturnsAsync(validationResult);

            _languageRepositoryMock.Setup(r => r.GetLanguageByNameAsync(language.LanguageName))
                .ThrowsAsync(new Exception("Database error"));

            // Act
            var result = await _service.SaveLanguageAsync(language);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeFalse();
            result.ErrorMessage.Should().Contain("Database error");
        }

        [Fact]
        public async Task GetLanguagesAsync_ReturnsAllLanguages()
        {
            // Arrange
            var languages = new List<Language>
            {
                new LanguageModel { LanguageName = "English", LanguageCode = "en-US", ProjectKey = "test-project" },
                new LanguageModel { LanguageName = "French", LanguageCode = "fr-FR", ProjectKey = "test-project" }
            };

            _languageRepositoryMock.Setup(r => r.GetAllLanguagesAsync())
                .ReturnsAsync(languages);

            // Act
            var result = await _service.GetLanguagesAsync();

            // Assert
            result.Should().NotBeNull();
            result.Should().HaveCount(2);
            _languageRepositoryMock.Verify(r => r.GetAllLanguagesAsync(), Times.Once);
        }

        [Fact]
        public async Task DeleteAsync_LanguageExists_ReturnsSuccess()
        {
            // Arrange
            var request = new DeleteLanguageRequest { LanguageName = "English" };
            var existingLanguage = new BlocksLanguage
            {
                ItemId = "lang-id",
                LanguageName = "English",
                LanguageCode = "en-US"
            };

            _languageRepositoryMock.Setup(r => r.GetLanguageByNameAsync(request.LanguageName))
                .ReturnsAsync(existingLanguage);

            _languageRepositoryMock.Setup(r => r.DeleteAsync(request.LanguageName))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.DeleteAsysnc(request);

            // Assert
            result.Should().NotBeNull();
            result.IsSuccess.Should().BeTrue();
            _languageRepositoryMock.Verify(r => r.DeleteAsync(request.LanguageName), Times.Once);
        }

        [Fact]
        public async Task DeleteAsync_LanguageNotFound_ReturnsError()
        {
            // Arrange
            var request = new DeleteLanguageRequest { LanguageName = "NonExistent" };

            _languageRepositoryMock.Setup(r => r.GetLanguageByNameAsync(request.LanguageName))
                .ReturnsAsync((BlocksLanguage)null);

            // Act
            var result = await _service.DeleteAsysnc(request);

            // Assert
            result.Should().NotBeNull();
            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("languageName");
            _languageRepositoryMock.Verify(r => r.DeleteAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task SetDefaultLanguage_LanguageExists_SetsAsDefault()
        {
            // Arrange
            var request = new SetDefaultLanguageRequest { LanguageName = "English" };
            var existingLanguage = new BlocksLanguage
            {
                ItemId = "lang-id",
                LanguageName = "English",
                LanguageCode = "en-US",
                IsDefault = false
            };

            _languageRepositoryMock.Setup(r => r.GetLanguageByNameAsync(request.LanguageName))
                .ReturnsAsync(existingLanguage);

            _languageRepositoryMock.Setup(r => r.SaveAsync(It.IsAny<BlocksLanguage>()))
                .Returns(Task.CompletedTask);

            _languageRepositoryMock.Setup(r => r.RemoveDefault(It.IsAny<BlocksLanguage>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.SetDefaultLanguage(request);

            // Assert
            result.Should().NotBeNull();
            result.IsSuccess.Should().BeTrue();
            _languageRepositoryMock.Verify(r => r.SaveAsync(It.Is<BlocksLanguage>(l => l.IsDefault == true)), Times.Once);
            _languageRepositoryMock.Verify(r => r.RemoveDefault(It.IsAny<BlocksLanguage>()), Times.Once);
        }

        [Fact]
        public async Task SetDefaultLanguage_LanguageNotFound_ReturnsError()
        {
            // Arrange
            var request = new SetDefaultLanguageRequest { LanguageName = "NonExistent" };

            _languageRepositoryMock.Setup(r => r.GetLanguageByNameAsync(request.LanguageName))
                .ReturnsAsync((BlocksLanguage)null);

            // Act
            var result = await _service.SetDefaultLanguage(request);

            // Assert
            result.Should().NotBeNull();
            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("languageName");
            _languageRepositoryMock.Verify(r => r.SaveAsync(It.IsAny<BlocksLanguage>()), Times.Never);
        }
    }
}

