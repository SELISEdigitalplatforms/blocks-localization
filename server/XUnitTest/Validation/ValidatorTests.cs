using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using FluentValidation;
using Moq;
using Xunit;
using BlocksLanguageKey = Eurolm.DomainService.Repositories.BlocksLanguageKey;
using BlocksLanguageModule = Eurolm.DomainService.Repositories.BlocksLanguageModule;

namespace XUnitTest
{
    public class KeyValidatorTests
    {
        private readonly Mock<IKeyRepository> _keyRepositoryMock;
        private readonly KeyValidator _validator;

        public KeyValidatorTests()
        {
            _keyRepositoryMock = new Mock<IKeyRepository>();
            _validator = new KeyValidator(_keyRepositoryMock.Object);
        }

        [Fact]
        public async Task Validate_ValidKey_ReturnsSuccess()
        {
            // Arrange
            var key = new Key
            {
                KeyName = "welcome.message",
                ModuleId = "auth-module",
                IsNewKey = false,
                ProjectKey = "test-project"
            };

            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync(key.KeyName, key.ModuleId))
                .ReturnsAsync((BlocksLanguageKey)null);

            // Act
            var result = await _validator.ValidateAsync(key);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_EmptyKeyName_ReturnsError()
        {
            // Arrange
            var key = new Key
            {
                KeyName = "",
                ModuleId = "auth-module",
                ProjectKey = "test-project"
            };

            // Act
            var result = await _validator.ValidateAsync(key);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == "KeyName");
        }

        [Fact]
        public async Task Validate_KeyNameTooShort_ReturnsError()
        {
            // Arrange
            var key = new Key
            {
                KeyName = "a",
                ModuleId = "auth-module",
                ProjectKey = "test-project"
            };

            // Act
            var result = await _validator.ValidateAsync(key);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == "KeyName");
        }

        [Fact]
        public async Task Validate_KeyNameTooLong_ReturnsError()
        {
            // Arrange
            var key = new Key
            {
                KeyName = new string('a', 101),
                ModuleId = "auth-module",
                ProjectKey = "test-project"
            };

            // Act
            var result = await _validator.ValidateAsync(key);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == "KeyName");
        }

        [Fact]
        public async Task Validate_EmptyModuleId_ReturnsError()
        {
            // Arrange
            var key = new Key
            {
                KeyName = "welcome.message",
                ModuleId = "",
                ProjectKey = "test-project"
            };

            // Act
            var result = await _validator.ValidateAsync(key);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == "ModuleId");
        }

        [Fact]
        public async Task Validate_ModuleIdTooShort_ReturnsError()
        {
            // Arrange
            var key = new Key
            {
                KeyName = "welcome.message",
                ModuleId = "a",
                ProjectKey = "test-project"
            };

            // Act
            var result = await _validator.ValidateAsync(key);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == "ModuleId");
        }

        [Fact]
        public async Task Validate_IsNewKeyButKeyExists_ReturnsError()
        {
            // Arrange
            var key = new Key
            {
                KeyName = "welcome.message",
                ModuleId = "auth-module",
                IsNewKey = true,
                ProjectKey = "test-project"
            };

            var existingKey = new BlocksLanguageKey
            {
                ItemId = "existing-id",
                KeyName = "welcome.message",
                ModuleId = "auth-module"
            };

            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync(key.KeyName, key.ModuleId))
                .ReturnsAsync(existingKey);

            // Act
            var result = await _validator.ValidateAsync(key);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == "IsNewKey");
        }
    }

    public class LanguageValidatorTests
    {
        private readonly LanguageValidator _validator;

        public LanguageValidatorTests()
        {
            _validator = new LanguageValidator();
        }

        [Fact]
        public async Task Validate_ValidLanguage_ReturnsSuccess()
        {
            // Arrange
            var language = new Language
            {
                LanguageName = "English",
                LanguageCode = "en-US",
                ProjectKey = "test-project"
            };

            // Act
            var result = await _validator.ValidateAsync(language);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_EmptyLanguageName_ReturnsError()
        {
            // Arrange
            var language = new Language
            {
                LanguageName = "",
                LanguageCode = "en-US",
                ProjectKey = "test-project"
            };

            // Act
            var result = await _validator.ValidateAsync(language);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == "LanguageName");
        }

        [Fact]
        public async Task Validate_LanguageNameTooShort_ReturnsError()
        {
            // Arrange
            var language = new Language
            {
                LanguageName = "E",
                LanguageCode = "en-US",
                ProjectKey = "test-project"
            };

            // Act
            var result = await _validator.ValidateAsync(language);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == "LanguageName");
        }

        [Fact]
        public async Task Validate_EmptyLanguageCode_ReturnsError()
        {
            // Arrange
            var language = new Language
            {
                LanguageName = "English",
                LanguageCode = "",
                ProjectKey = "test-project"
            };

            // Act
            var result = await _validator.ValidateAsync(language);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == "LanguageCode");
        }

        [Fact]
        public async Task Validate_InvalidLanguageCodeFormat_ReturnsError()
        {
            // Arrange
            var language = new Language
            {
                LanguageName = "English",
                LanguageCode = "en",
                ProjectKey = "test-project"
            };

            // Act
            var result = await _validator.ValidateAsync(language);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == "LanguageCode");
        }

        [Fact]
        public async Task Validate_ValidLanguageCodeFormat_ReturnsSuccess()
        {
            // Arrange
            var language = new Language
            {
                LanguageName = "English",
                LanguageCode = "en-US",
                ProjectKey = "test-project"
            };

            // Act
            var result = await _validator.ValidateAsync(language);

            // Assert
            result.IsValid.Should().BeTrue();
        }
        
        [Fact]
        public async Task Validate_PrivateUseSubtagLanguageCode_ReturnsSuccess()
        {
            // Arrange
            var language = new Language
            {
                LanguageName = "Caveman En",
                LanguageCode = "en-x-C",
                ProjectKey = "test-project"
            };

            // Act
            var result = await _validator.ValidateAsync(language);

            // Assert
            result.IsValid.Should().BeTrue();
        }
    }

    public class ModuleValidatorTests
    {
        private readonly Mock<IModuleRepository> _moduleRepositoryMock;
        private readonly ModuleValidator _validator;

        public ModuleValidatorTests()
        {
            _moduleRepositoryMock = new Mock<IModuleRepository>();
            _validator = new ModuleValidator(_moduleRepositoryMock.Object);
        }

        [Fact]
        public async Task Validate_ValidModule_ReturnsSuccess()
        {
            // Arrange
            var module = new Module
            {
                ModuleName = "authentication"
            };

            _moduleRepositoryMock.Setup(r => r.GetByNameAsync(module.ModuleName))
                .ReturnsAsync((BlocksLanguageModule)null);

            // Act
            var result = await _validator.ValidateAsync(module);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_EmptyModuleName_ReturnsError()
        {
            // Arrange
            var module = new Module
            {
                ModuleName = ""
            };

            // Act
            var result = await _validator.ValidateAsync(module);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == "ModuleName");
        }

        [Fact]
        public async Task Validate_ModuleNameTooShort_ReturnsError()
        {
            // Arrange
            var module = new Module
            {
                ModuleName = "ab"
            };

            // Act
            var result = await _validator.ValidateAsync(module);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == "ModuleName");
        }

        [Fact]
        public async Task Validate_DuplicateModuleName_ReturnsError()
        {
            // Arrange
            var module = new Module
            {
                ModuleName = "authentication"
            };

            var existingModule = new BlocksLanguageModule
            {
                ItemId = "existing-id",
                ModuleName = "authentication"
            };

            _moduleRepositoryMock.Setup(r => r.GetByNameAsync(module.ModuleName))
                .ReturnsAsync(existingModule);

            // Act
            var result = await _validator.ValidateAsync(module);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == "ModuleName");
        }
    }
}

