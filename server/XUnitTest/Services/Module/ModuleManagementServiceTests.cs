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
        private readonly Mock<IKeyRepository> _keyRepositoryMock;
        private readonly Mock<IValidator<ModuleModel>> _validatorMock;
        private readonly ModuleManagementService _service;

        public ModuleManagementServiceTests()
        {
            XUnitTest.Shared.TestBlocksContext.Set("mod-tenant");
            _loggerMock = new Mock<ILogger<ModuleManagementService>>();
            _moduleRepositoryMock = new Mock<IModuleRepository>();
            _glossaryRepositoryMock = new Mock<IGlossaryRepository>();
            _keyRepositoryMock = new Mock<IKeyRepository>();
            _validatorMock = new Mock<IValidator<ModuleModel>>();
            
            _service = new ModuleManagementService(
                _validatorMock.Object,
                _moduleRepositoryMock.Object,
                _loggerMock.Object,
                _glossaryRepositoryMock.Object,
                _keyRepositoryMock.Object
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

        [Fact]
        public async Task GetModulesAsync_ProjectKeyOverload_NoModuleId_ReturnsAll()
        {
            var modules = new List<BlocksLanguageModule> { new BlocksLanguageModule { ItemId = "1", ModuleName = "auth" } };
            _moduleRepositoryMock.Setup(r => r.GetAllAsync("proj-1")).ReturnsAsync(modules);

            var result = await _service.GetModulesAsync("proj-1", null);

            result.Should().HaveCount(1);
            _moduleRepositoryMock.Verify(r => r.GetAllAsync("proj-1"), Times.Once);
        }

        [Fact]
        public async Task GetModulesAsync_ProjectKeyOverload_WithModuleId_ReturnsSpecific()
        {
            var module = new BlocksLanguageModule { ItemId = "m1", ModuleName = "auth" };
            _moduleRepositoryMock.Setup(r => r.GetByIdAsync("proj-1", "m1")).ReturnsAsync(module);

            var result = await _service.GetModulesAsync("proj-1", "m1");

            result.Should().HaveCount(1);
            result[0].ItemId.Should().Be("m1");
        }

        [Fact]
        public async Task GetModulesAsync_ProjectKeyOverload_WithModuleId_NotFound_ReturnsEmpty()
        {
            _moduleRepositoryMock.Setup(r => r.GetByIdAsync("proj-1", "m1")).ReturnsAsync((BlocksLanguageModule)null);

            var result = await _service.GetModulesAsync("proj-1", "m1");

            result.Should().BeEmpty();
        }

        [Fact]
        public async Task SaveModuleAsync_WithExistingItemId_UpdatesById()
        {
            var module = new SaveModuleRequest { ItemId = "existing-id", ModuleName = "auth" };
            _validatorMock.Setup(v => v.ValidateAsync(module, default)).ReturnsAsync(new FluentValidation.Results.ValidationResult());
            _moduleRepositoryMock.Setup(r => r.GetByIdAsync("existing-id"))
                .ReturnsAsync(new BlocksLanguageModule { ItemId = "existing-id", ModuleName = "auth" });
            _moduleRepositoryMock.Setup(r => r.SaveAsync(It.IsAny<BlocksLanguageModule>())).Returns(Task.CompletedTask);

            var result = await _service.SaveModuleAsync(module);

            result.Success.Should().BeTrue();
            _moduleRepositoryMock.Verify(r => r.GetByIdAsync("existing-id"), Times.Once);
            _moduleRepositoryMock.Verify(r => r.SaveAsync(It.Is<BlocksLanguageModule>(m => m.ItemId == "existing-id")), Times.Once);
        }

        [Fact]
        public async Task TagGlossaryAsync_RemovesUntaggedAndAddsNew_ReturnsSuccess()
        {
            var request = new TagGlossaryRequest { ModuleId = "mod-1", GlossaryIds = new List<string> { "g-new" } };

            // Currently tagged: g-old (should be untagged) and g-new (already tagged, kept).
            _glossaryRepositoryMock.Setup(r => r.GetByModuleIdAsync("mod-tenant", "mod-1"))
                .ReturnsAsync(new List<Glossary>
                {
                    new Glossary { ItemId = "g-old", Name = "Old", ModuleIds = new List<string> { "mod-1" } },
                    new Glossary { ItemId = "g-new", Name = "New", ModuleIds = new List<string> { "mod-1" } }
                });
            // Target glossaries to (re)tag.
            _glossaryRepositoryMock.Setup(r => r.GetByIdsAsync(request.GlossaryIds))
                .ReturnsAsync(new List<Glossary>
                {
                    new Glossary { ItemId = "g-new", Name = "New", ModuleIds = new List<string>() }
                });
            _glossaryRepositoryMock.Setup(r => r.SaveAsync(It.IsAny<BlocksGlossary>())).Returns(Task.CompletedTask);

            var result = await _service.TagGlossaryAsync(request);

            result.IsSuccess.Should().BeTrue();
            // g-old removed from module -> saved; g-new added -> saved. 2 saves total.
            _glossaryRepositoryMock.Verify(r => r.SaveAsync(It.IsAny<BlocksGlossary>()), Times.Exactly(2));
        }

        [Fact]
        public async Task TagGlossaryAsync_WithEmptyGlossaryIds_OnlyUntags()
        {
            var request = new TagGlossaryRequest { ModuleId = "mod-1", GlossaryIds = new List<string>() };
            _glossaryRepositoryMock.Setup(r => r.GetByModuleIdAsync("mod-tenant", "mod-1"))
                .ReturnsAsync(new List<Glossary>
                {
                    new Glossary { ItemId = "g-old", Name = "Old", ModuleIds = new List<string> { "mod-1" } }
                });
            _glossaryRepositoryMock.Setup(r => r.SaveAsync(It.IsAny<BlocksGlossary>())).Returns(Task.CompletedTask);

            var result = await _service.TagGlossaryAsync(request);

            result.IsSuccess.Should().BeTrue();
            _glossaryRepositoryMock.Verify(r => r.SaveAsync(It.IsAny<BlocksGlossary>()), Times.Once);
            _glossaryRepositoryMock.Verify(r => r.GetByIdsAsync(It.IsAny<List<string>>()), Times.Never);
        }

        [Fact]
        public async Task TagGlossaryAsync_WhenRepositoryThrows_ReturnsFailure()
        {
            var request = new TagGlossaryRequest { ModuleId = "mod-1", GlossaryIds = new List<string> { "g1" } };
            _glossaryRepositoryMock.Setup(r => r.GetByModuleIdAsync(It.IsAny<string>(), It.IsAny<string>()))
                .ThrowsAsync(new Exception("db down"));

            var result = await _service.TagGlossaryAsync(request);

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("Error");
        }

        private const string ModuleHasKeysMessage =
            "Module has keys. Please delete or move all keys to another module before deleting it.";

        private void SetupModuleExists(string itemId) =>
            _moduleRepositoryMock.Setup(r => r.GetByIdAsync(itemId))
                .ReturnsAsync(new BlocksLanguageModule { ItemId = itemId, ModuleName = itemId });

        private void SetupModuleHasKeys(string itemId, bool hasKeys) =>
            _keyRepositoryMock.Setup(r => r.HasKeysInModuleAsync(itemId)).ReturnsAsync(hasKeys);

        [Fact]
        public async Task DeleteModuleAsync_EmptyModule_DeletesModule()
        {
            SetupModuleExists("m1");
            SetupModuleHasKeys("m1", false);
            _moduleRepositoryMock.Setup(r => r.DeleteAsync("m1")).Returns(Task.CompletedTask);

            var result = await _service.DeleteModuleAsync(new DeleteModuleRequest { ItemId = "m1" });

            result.IsSuccess.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.HasKeysInModuleAsync("m1"), Times.Once);
            _moduleRepositoryMock.Verify(r => r.DeleteAsync("m1"), Times.Once);
        }

        [Fact]
        public async Task DeleteModuleAsync_ModuleWithKeys_ReturnsErrorWithoutDeleting()
        {
            SetupModuleExists("m1");
            SetupModuleHasKeys("m1", true);

            var result = await _service.DeleteModuleAsync(new DeleteModuleRequest { ItemId = "m1" });

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("ItemId").WhoseValue.Should().Be(ModuleHasKeysMessage);
            _moduleRepositoryMock.Verify(r => r.DeleteAsync(It.IsAny<string>()), Times.Never);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public async Task DeleteModuleAsync_WithEmptyItemId_ReturnsFailureWithoutLookup(string? itemId)
        {
            var result = await _service.DeleteModuleAsync(new DeleteModuleRequest { ItemId = itemId! });

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().BeNullOrEmpty();
            _moduleRepositoryMock.Verify(r => r.GetByIdAsync(It.IsAny<string>()), Times.Never);
            _keyRepositoryMock.Verify(r => r.HasKeysInModuleAsync(It.IsAny<string>()), Times.Never);
            _moduleRepositoryMock.Verify(r => r.DeleteAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task DeleteModuleAsync_WithNullRequest_ReturnsFailure()
        {
            var result = await _service.DeleteModuleAsync(null!);

            result.IsSuccess.Should().BeFalse();
            _moduleRepositoryMock.Verify(r => r.DeleteAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task DeleteModuleAsync_ModuleNotFound_ReturnsModuleNotFoundWithoutKeyCheck()
        {
            _moduleRepositoryMock.Setup(r => r.GetByIdAsync("missing")).ReturnsAsync((BlocksLanguageModule)null!);

            var result = await _service.DeleteModuleAsync(new DeleteModuleRequest { ItemId = "missing" });

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("ItemId").WhoseValue.Should().Be("Module not found");
            _keyRepositoryMock.Verify(r => r.HasKeysInModuleAsync(It.IsAny<string>()), Times.Never);
            _moduleRepositoryMock.Verify(r => r.DeleteAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task DeleteModuleAsync_WhenKeyCheckThrows_DoesNotDeleteModuleAndReturnsGenericError()
        {
            SetupModuleExists("m1");
            _keyRepositoryMock.Setup(r => r.HasKeysInModuleAsync("m1")).ThrowsAsync(new InvalidOperationException("mongo secret detail"));

            var result = await _service.DeleteModuleAsync(new DeleteModuleRequest { ItemId = "m1" });

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("Error").WhoseValue.Should().Be("An unexpected error occurred");
            result.Errors.Values.Should().NotContain(v => v.Contains("mongo secret detail"));
            _moduleRepositoryMock.Verify(r => r.DeleteAsync(It.IsAny<string>()), Times.Never);
            _loggerMock.Verify(l => l.Log(
                LogLevel.Error,
                It.IsAny<EventId>(),
                It.IsAny<It.IsAnyType>(),
                It.IsAny<Exception?>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()), Times.Once);
        }

        [Fact]
        public async Task DeleteModuleAsync_WhenModuleDeleteThrows_ReturnsGenericError()
        {
            SetupModuleExists("m1");
            SetupModuleHasKeys("m1", false);
            _moduleRepositoryMock.Setup(r => r.DeleteAsync("m1")).ThrowsAsync(new InvalidOperationException("db down"));

            var result = await _service.DeleteModuleAsync(new DeleteModuleRequest { ItemId = "m1" });

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("Error").WhoseValue.Should().Be("An unexpected error occurred");
        }

    }
}

