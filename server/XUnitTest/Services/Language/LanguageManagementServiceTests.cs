using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.Logging;
using Moq;
using System.Text.Json;
using Xunit;
using BlocksLanguage = Eurolm.DomainService.Repositories.BlocksLanguage;
using LanguageModel = Eurolm.DomainService.Services.Language;

namespace XUnitTest
{
    public class LanguageManagementServiceTests
    {
        private readonly Mock<ILogger<LanguageManagementService>> _loggerMock;
        private readonly Mock<ILanguageRepository> _languageRepositoryMock;
        private readonly Mock<IValidator<LanguageModel>> _validatorMock;
        private readonly Mock<IActionPublisher> _actions = new();
        private readonly List<(string Action, string Json)> _published = new();
        private readonly LanguageManagementService _service;

        public LanguageManagementServiceTests()
        {
            XUnitTest.Shared.TestBlocksContext.Set();
            _loggerMock = new Mock<ILogger<LanguageManagementService>>();
            _languageRepositoryMock = new Mock<ILanguageRepository>();
            _validatorMock = new Mock<IValidator<LanguageModel>>();
            _actions.Setup(a => a.PublishAsync(It.IsAny<string>(), It.IsAny<object?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
                .Callback<string, object?, string?, CancellationToken>((name, data, _, _) => _published.Add((name, JsonSerializer.Serialize(data))))
                .Returns(Task.CompletedTask);
            
            _service = new LanguageManagementService(
                _validatorMock.Object,
                _loggerMock.Object,
                _languageRepositoryMock.Object,
                _actions.Object
            );
        }

        [Fact]
        public async Task SaveLanguageAsync_ReusedSingleton_UsesEachRequestsTenant()
        {
            var saved = new List<BlocksLanguage>();
            _validatorMock.Setup(v => v.ValidateAsync(It.IsAny<LanguageModel>(), default))
                .ReturnsAsync(new FluentValidation.Results.ValidationResult());
            _languageRepositoryMock.Setup(r => r.SaveAsync(It.IsAny<BlocksLanguage>()))
                .Callback<BlocksLanguage>(saved.Add).Returns(Task.CompletedTask);

            XUnitTest.Shared.TestBlocksContext.Set("dev");
            await _service.SaveLanguageAsync(new LanguageModel { LanguageName = "English" });
            XUnitTest.Shared.TestBlocksContext.Set("other");
            await _service.SaveLanguageAsync(new LanguageModel { LanguageName = "French" });

            saved.Select(x => x.TenantId).Should().Equal("dev", "other");
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
                new LanguageModel { LanguageName = "English", LanguageCode = "en-US",  },
                new LanguageModel { LanguageName = "French", LanguageCode = "fr-FR",  }
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
            var result = await _service.DeleteAsync(request);

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
            var result = await _service.DeleteAsync(request);

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

        private string Tenant => Blocks.Genesis.BlocksContext.GetContext()!.TenantId;

        [Fact]
        public async Task SaveLanguageAsync_NewLanguage_PublishesAddedOnce()
        {
            var language = new LanguageModel { LanguageName = "German", LanguageCode = "de-DE" };
            _validatorMock.Setup(v => v.ValidateAsync(language, default)).ReturnsAsync(new FluentValidation.Results.ValidationResult());
            _languageRepositoryMock.Setup(r => r.GetLanguageByNameAsync("German")).ReturnsAsync((BlocksLanguage)null);
            _languageRepositoryMock.Setup(r => r.SaveAsync(It.IsAny<BlocksLanguage>())).Returns(Task.CompletedTask);

            await _service.SaveLanguageAsync(language);

            _published.Should().ContainSingle().Which.Should().Be(("localization.language.changed",
                $"{{\"projectKey\":\"{Tenant}\",\"language\":\"de-DE\",\"change\":\"added\"}}"));
        }

        [Fact]
        public async Task SaveLanguageAsync_ExistingLanguage_PublishesNothing()
        {
            var language = new LanguageModel { LanguageName = "German", LanguageCode = "de-DE" };
            _validatorMock.Setup(v => v.ValidateAsync(language, default)).ReturnsAsync(new FluentValidation.Results.ValidationResult());
            _languageRepositoryMock.Setup(r => r.GetLanguageByNameAsync("German"))
                .ReturnsAsync(new BlocksLanguage { ItemId = "id", LanguageName = "German", LanguageCode = "de-DE" });
            _languageRepositoryMock.Setup(r => r.SaveAsync(It.IsAny<BlocksLanguage>())).Returns(Task.CompletedTask);

            await _service.SaveLanguageAsync(language);

            _published.Should().BeEmpty();
        }

        [Fact]
        public async Task SaveLanguageAsync_InvalidOrSaveFails_PublishesNothing()
        {
            var invalid = new LanguageModel { LanguageName = "", LanguageCode = "x" };
            var failures = new FluentValidation.Results.ValidationResult();
            failures.Errors.Add(new FluentValidation.Results.ValidationFailure("LanguageName", "required"));
            _validatorMock.Setup(v => v.ValidateAsync(invalid, default)).ReturnsAsync(failures);
            await _service.SaveLanguageAsync(invalid);

            var valid = new LanguageModel { LanguageName = "German", LanguageCode = "de-DE" };
            _validatorMock.Setup(v => v.ValidateAsync(valid, default)).ReturnsAsync(new FluentValidation.Results.ValidationResult());
            _languageRepositoryMock.Setup(r => r.GetLanguageByNameAsync("German")).ReturnsAsync((BlocksLanguage)null);
            _languageRepositoryMock.Setup(r => r.SaveAsync(It.IsAny<BlocksLanguage>())).ThrowsAsync(new Exception("db"));
            await _service.SaveLanguageAsync(valid);

            _published.Should().BeEmpty();
        }

        [Fact]
        public async Task DeleteAsync_Success_PublishesRemovedOnce()
        {
            _languageRepositoryMock.Setup(r => r.GetLanguageByNameAsync("German"))
                .ReturnsAsync(new BlocksLanguage { LanguageName = "German", LanguageCode = "de-DE" });
            _languageRepositoryMock.Setup(r => r.DeleteAsync("German")).Returns(Task.CompletedTask);

            await _service.DeleteAsync(new DeleteLanguageRequest { LanguageName = "German" });

            _published.Should().ContainSingle().Which.Should().Be(("localization.language.changed",
                $"{{\"projectKey\":\"{Tenant}\",\"language\":\"de-DE\",\"change\":\"removed\"}}"));
        }

        [Fact]
        public async Task DeleteAsync_NotFound_PublishesNothing()
        {
            _languageRepositoryMock.Setup(r => r.GetLanguageByNameAsync("x")).ReturnsAsync((BlocksLanguage)null);

            await _service.DeleteAsync(new DeleteLanguageRequest { LanguageName = "x" });

            _published.Should().BeEmpty();
        }

        [Fact]
        public async Task SetDefaultLanguage_Success_PublishesDefaultOnce()
        {
            _languageRepositoryMock.Setup(r => r.GetLanguageByNameAsync("German"))
                .ReturnsAsync(new BlocksLanguage { LanguageName = "German", LanguageCode = "de-DE" });
            _languageRepositoryMock.Setup(r => r.SaveAsync(It.IsAny<BlocksLanguage>())).Returns(Task.CompletedTask);
            _languageRepositoryMock.Setup(r => r.RemoveDefault(It.IsAny<BlocksLanguage>())).Returns(Task.CompletedTask);

            await _service.SetDefaultLanguage(new SetDefaultLanguageRequest { LanguageName = "German" });

            _published.Should().ContainSingle().Which.Should().Be(("localization.language.changed",
                $"{{\"projectKey\":\"{Tenant}\",\"language\":\"de-DE\",\"change\":\"default\"}}"));
        }

        [Fact]
        public async Task SetDefaultLanguage_NotFound_PublishesNothing()
        {
            _languageRepositoryMock.Setup(r => r.GetLanguageByNameAsync("x")).ReturnsAsync((BlocksLanguage)null);

            await _service.SetDefaultLanguage(new SetDefaultLanguageRequest { LanguageName = "x" });

            _published.Should().BeEmpty();
        }
    }
}
