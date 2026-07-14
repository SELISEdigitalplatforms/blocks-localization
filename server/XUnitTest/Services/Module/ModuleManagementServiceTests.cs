using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using BlocksLanguageModule = Eurolm.DomainService.Repositories.BlocksLanguageModule;
using ModuleModel = Eurolm.DomainService.Services.Module;

namespace XUnitTest
{
    public class ModuleManagementServiceTests
    {
        private readonly Mock<ILogger<ModuleManagementService>> _loggerMock;
        private readonly Mock<IModuleRepository> _moduleRepositoryMock;
        private readonly Mock<IGlossaryRepository> _glossaryRepositoryMock;
        private readonly Mock<IValidator<ModuleModel>> _validatorMock;
        private readonly ModuleManagementService _service;

        public ModuleManagementServiceTests()
        {
            _loggerMock = new Mock<ILogger<ModuleManagementService>>();
            _moduleRepositoryMock = new Mock<IModuleRepository>();
            _glossaryRepositoryMock = new Mock<IGlossaryRepository>();
            _validatorMock = new Mock<IValidator<ModuleModel>>();
            
            _service = new ModuleManagementService(
                _validatorMock.Object,
                _moduleRepositoryMock.Object,
                _loggerMock.Object,
                _glossaryRepositoryMock.Object
            );
        }

        [Fact]
        public async Task SaveModuleAsync_ValidModule_ReturnsSuccess()
        {
            // Arrange
            var module = new SaveModuleRequest
            {
                ModuleName = "authentication",
               
            };

            var validationResult = new FluentValidation.Results.ValidationResult();
            _validatorMock.Setup(v => v.ValidateAsync(module, default))
                .ReturnsAsync(validationResult);

            _moduleRepositoryMock.Setup(r => r.GetByNameAsync(module.ModuleName))
                .ReturnsAsync((BlocksLanguageModule)null);

            _moduleRepositoryMock.Setup(r => r.SaveAsync(It.IsAny<BlocksLanguageModule>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.SaveModuleAsync(module);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            _moduleRepositoryMock.Verify(r => r.SaveAsync(It.IsAny<BlocksLanguageModule>()), Times.Once);
        }

        [Fact]
        public async Task SaveModuleAsync_InvalidModule_ReturnsValidationError()
        {
            // Arrange
            var module = new SaveModuleRequest
            {
                ModuleName = "",
                
            };

            var validationResult = new FluentValidation.Results.ValidationResult();
            validationResult.Errors.Add(new FluentValidation.Results.ValidationFailure("ModuleName", "Module name is required."));
            
            _validatorMock.Setup(v => v.ValidateAsync(module, default))
                .ReturnsAsync(validationResult);

            // Act
            var result = await _service.SaveModuleAsync(module);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeFalse();
            _moduleRepositoryMock.Verify(r => r.SaveAsync(It.IsAny<BlocksLanguageModule>()), Times.Never);
        }

        [Fact]
        public async Task SaveModuleAsync_ExistingModule_UpdatesModule()
        {
            // Arrange
            var module = new SaveModuleRequest
            {
                ModuleName = "authentication",
               
            };

            var existingModule = new BlocksLanguageModule
            {
                ItemId = "existing-id",
                ModuleName = "authentication",
                CreateDate = DateTime.UtcNow.AddDays(-1)
            };

            var validationResult = new FluentValidation.Results.ValidationResult();
            _validatorMock.Setup(v => v.ValidateAsync(module, default))
                .ReturnsAsync(validationResult);

            _moduleRepositoryMock.Setup(r => r.GetByNameAsync(module.ModuleName))
                .ReturnsAsync(existingModule);

            _moduleRepositoryMock.Setup(r => r.SaveAsync(It.IsAny<BlocksLanguageModule>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.SaveModuleAsync(module);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            _moduleRepositoryMock.Verify(r => r.SaveAsync(It.Is<BlocksLanguageModule>(m => 
                m.ItemId == existingModule.ItemId)), Times.Once);
        }

        [Fact]
        public async Task SaveModuleAsync_ExceptionThrown_ReturnsError()
        {
            // Arrange
            var module = new SaveModuleRequest
            {
                ModuleName = "authentication",
                
            };

            var validationResult = new FluentValidation.Results.ValidationResult();
            _validatorMock.Setup(v => v.ValidateAsync(module, default))
                .ReturnsAsync(validationResult);

            _moduleRepositoryMock.Setup(r => r.GetByNameAsync(module.ModuleName))
                .ThrowsAsync(new Exception("Database error"));

            // Act
            var result = await _service.SaveModuleAsync(module);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeFalse();
            result.ErrorMessage.Should().Contain("Database error");
        }

        [Fact]
        public async Task GetModulesAsync_NoModuleId_ReturnsAllModules()
        {
            // Arrange
            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "1", ModuleName = "auth" },
                new BlocksLanguageModule { ItemId = "2", ModuleName = "common" }
            };

            _moduleRepositoryMock.Setup(r => r.GetAllAsync())
                .ReturnsAsync(modules);

            // Act
            var result = await _service.GetModulesAsync();

            // Assert
            result.Should().NotBeNull();
            result.Should().HaveCount(2);
            _moduleRepositoryMock.Verify(r => r.GetAllAsync(), Times.Once);
            _moduleRepositoryMock.Verify(r => r.GetByIdAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task GetModulesAsync_WithModuleId_ReturnsSpecificModule()
        {
            // Arrange
            var moduleId = "module-id";
            var module = new BlocksLanguageModule
            {
                ItemId = moduleId,
                ModuleName = "authentication"
            };

            _moduleRepositoryMock.Setup(r => r.GetByIdAsync(moduleId))
                .ReturnsAsync(module);

            // Act
            var result = await _service.GetModulesAsync(moduleId);

            // Assert
            result.Should().NotBeNull();
            result.Should().HaveCount(1);
            result.First().ItemId.Should().Be(moduleId);
            _moduleRepositoryMock.Verify(r => r.GetByIdAsync(moduleId), Times.Once);
        }

        [Fact]
        public async Task GetModulesAsync_WithModuleId_ModuleNotFound_ReturnsEmptyList()
        {
            // Arrange
            var moduleId = "non-existent-id";

            _moduleRepositoryMock.Setup(r => r.GetByIdAsync(moduleId))
                .ReturnsAsync((BlocksLanguageModule)null);

            // Act
            var result = await _service.GetModulesAsync(moduleId);

            // Assert
            result.Should().NotBeNull();
            result.Should().BeEmpty();
            _moduleRepositoryMock.Verify(r => r.GetByIdAsync(moduleId), Times.Once);
        }
    }
}

