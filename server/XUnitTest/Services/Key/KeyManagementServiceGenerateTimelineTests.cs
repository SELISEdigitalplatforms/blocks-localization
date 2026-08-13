using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared;
using Eurolm.DomainService.Shared.Events;
using Eurolm.DomainService.Shared.Utilities;
using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.Logging;
using Moq;
using StorageDriver;
using Xunit;
using BlocksLanguageKey = Eurolm.DomainService.Repositories.BlocksLanguageKey;
using KeyModel = Eurolm.DomainService.Services.Key;
using KeyTimeline = Eurolm.DomainService.Services.KeyTimeline;

namespace XUnitTest
{
    public class KeyManagementServiceGenerateTimelineTests
    {
        private readonly Mock<ILogger<KeyManagementService>> _loggerMock;
        private readonly Mock<IKeyRepository> _keyRepositoryMock;
        private readonly Mock<IKeyTimelineRepository> _keyTimelineRepositoryMock;
        private readonly Mock<ILanguageFileGenerationHistoryRepository> _languageFileGenerationHistoryRepositoryMock;
        private readonly Mock<IValidator<KeyModel>> _validatorMock;
        private readonly Mock<ILanguageManagementService> _languageManagementServiceMock;
        private readonly Mock<IModuleManagementService> _moduleManagementServiceMock;
        private readonly Mock<IMessageClient> _messageClientMock;
        private readonly Mock<IAssistantService> _assistantServiceMock;
        private readonly Mock<IStorageDriverService> _storageDriverServiceMock;
        private readonly Mock<INotificationService> _notificationServiceMock;
        private readonly KeyManagementService _service;

        public KeyManagementServiceGenerateTimelineTests()
        {
            _loggerMock = new Mock<ILogger<KeyManagementService>>();
            _keyRepositoryMock = new Mock<IKeyRepository>();
            _keyTimelineRepositoryMock = new Mock<IKeyTimelineRepository>();
            _languageFileGenerationHistoryRepositoryMock = new Mock<ILanguageFileGenerationHistoryRepository>();
            _validatorMock = new Mock<IValidator<KeyModel>>();
            _languageManagementServiceMock = new Mock<ILanguageManagementService>();
            _moduleManagementServiceMock = new Mock<IModuleManagementService>();
            _messageClientMock = new Mock<IMessageClient>();
            _assistantServiceMock = new Mock<IAssistantService>();
            _storageDriverServiceMock = new Mock<IStorageDriverService>();
            _notificationServiceMock = new Mock<INotificationService>();
            var storageLoggerMock = new Mock<ILogger<StorageHelper>>();
            var storageHelper = new StorageHelper(storageLoggerMock.Object, _storageDriverServiceMock.Object);

            _service = new KeyManagementService(
                _keyRepositoryMock.Object,
                _keyTimelineRepositoryMock.Object,
                _languageFileGenerationHistoryRepositoryMock.Object,
                _validatorMock.Object,
                _loggerMock.Object,
                _languageManagementServiceMock.Object,
                _moduleManagementServiceMock.Object,
                _messageClientMock.Object,
                _assistantServiceMock.Object,
                _storageDriverServiceMock.Object,
                storageHelper,
                Mock.Of<IServiceProvider>(),
                _notificationServiceMock.Object,
                Mock.Of<IGlossaryRepository>()
            );
        }

        private void SetupCommonMocks(List<BlocksLanguageModule> modules, Dictionary<string, List<Key>> keysByModule)
        {
            _languageManagementServiceMock.Setup(m => m.GetLanguagesAsync())
                .ReturnsAsync(new List<Language>
                {
                    new Language { LanguageCode = "en-US", LanguageName = "English" }
                });

            _moduleManagementServiceMock.Setup(m => m.GetModulesAsync(It.IsAny<string>()))
                .ReturnsAsync(modules);

            foreach (var kvp in keysByModule)
            {
                _keyRepositoryMock.Setup(r => r.GetAllKeysByModuleAsync(kvp.Key))
                    .ReturnsAsync(kvp.Value);
            }

            _keyRepositoryMock.Setup(r => r.DeleteOldUilmFiles(It.IsAny<List<UilmFile>>()))
                .ReturnsAsync(0L);
            _keyRepositoryMock.Setup(r => r.SaveNewUilmFiles(It.IsAny<List<UilmFile>>()))
                .ReturnsAsync(true);

            _keyTimelineRepositoryMock.Setup(r => r.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), It.IsAny<string>()))
                .Returns(Task.CompletedTask);
        }

        [Fact]
        public async Task GenerateAsync_SuccessfulPublish_CreatesPublishedTimelineEntries()
        {
            // Arrange
            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" }
            };
            var keys = new List<Key>
            {
                new KeyModel
                {
                    ItemId = "key-1",
                    KeyName = "welcome",
                    ModuleId = "mod-1",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Welcome" } }
                },
                new KeyModel
                {
                    ItemId = "key-2",
                    KeyName = "goodbye",
                    ModuleId = "mod-1",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Goodbye" } }
                }
            };

            SetupCommonMocks(modules, new Dictionary<string, List<Key>> { { "mod-1", keys } });

            var command = new GenerateUilmFilesEvent
            {
                Guid = "g-1",
                ModuleId = "mod-1",
                ProjectKey = "tenant-1"
            };

            // Act
            var result = await _service.GenerateAsync(command);

            // Assert
            result.Should().BeTrue();
            _keyTimelineRepositoryMock.Verify(
                r => r.BulkSaveKeyTimelinesAsync(
                    It.Is<List<KeyTimeline>>(timelines =>
                        timelines.Count == 2 &&
                        timelines.All(t => t.LogFrom == "Published") &&
                        timelines.All(t => t.PreviousData == null) &&
                        timelines.All(t => t.CurrentData != null)),
                    "tenant-1"),
                Times.Once);
        }

        [Fact]
        public async Task GenerateAsync_SuccessfulPublish_TimelineEntriesHaveCorrectEntityIds()
        {
            // Arrange
            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" }
            };
            var keys = new List<Key>
            {
                new KeyModel
                {
                    ItemId = "key-1",
                    KeyName = "welcome",
                    ModuleId = "mod-1",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Welcome" } }
                }
            };

            SetupCommonMocks(modules, new Dictionary<string, List<Key>> { { "mod-1", keys } });

            var command = new GenerateUilmFilesEvent
            {
                Guid = "g-1",
                ModuleId = "mod-1",
                ProjectKey = "tenant-1"
            };

            // Act
            await _service.GenerateAsync(command);

            // Assert
            _keyTimelineRepositoryMock.Verify(
                r => r.BulkSaveKeyTimelinesAsync(
                    It.Is<List<KeyTimeline>>(timelines =>
                        timelines[0].EntityId == "key-1" &&
                        timelines[0].CurrentData.KeyName == "welcome"),
                    "tenant-1"),
                Times.Once);
        }

        [Fact]
        public async Task GenerateAsync_ModuleProcessingFails_CreatesPublishFailedTimeline()
        {
            // Arrange
            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" }
            };
            var keys = new List<Key>
            {
                new KeyModel
                {
                    ItemId = "key-1",
                    KeyName = "welcome",
                    ModuleId = "mod-1",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Welcome" } }
                }
            };

            _languageManagementServiceMock.Setup(m => m.GetLanguagesAsync())
                .ReturnsAsync(new List<Language>
                {
                    new Language { LanguageCode = "en-US", LanguageName = "English" }
                });

            _moduleManagementServiceMock.Setup(m => m.GetModulesAsync(It.IsAny<string>()))
                .ReturnsAsync(modules);

            _keyRepositoryMock.Setup(r => r.GetAllKeysByModuleAsync("mod-1"))
                .ReturnsAsync(keys);

            // Make SaveNewUilmFiles throw to simulate failure
            _keyRepositoryMock.Setup(r => r.DeleteOldUilmFiles(It.IsAny<List<UilmFile>>()))
                .ReturnsAsync(0L);
            _keyRepositoryMock.Setup(r => r.SaveNewUilmFiles(It.IsAny<List<UilmFile>>()))
                .ThrowsAsync(new Exception("Storage failure"));

            _keyTimelineRepositoryMock.Setup(r => r.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), It.IsAny<string>()))
                .Returns(Task.CompletedTask);

            var command = new GenerateUilmFilesEvent
            {
                Guid = "g-1",
                ModuleId = "mod-1",
                ProjectKey = "tenant-1"
            };

            // Act
            var result = await _service.GenerateAsync(command);

            // Assert
            result.Should().BeTrue();
            _keyTimelineRepositoryMock.Verify(
                r => r.BulkSaveKeyTimelinesAsync(
                    It.Is<List<KeyTimeline>>(timelines =>
                        timelines.Count == 1 &&
                        timelines.All(t => t.LogFrom == "PublishFailed")),
                    "tenant-1"),
                Times.Once);

            // Published should NOT be called
            _keyTimelineRepositoryMock.Verify(
                r => r.BulkSaveKeyTimelinesAsync(
                    It.Is<List<KeyTimeline>>(timelines =>
                        timelines.Any(t => t.LogFrom == "Published")),
                    It.IsAny<string>()),
                Times.Never);
        }

        [Fact]
        public async Task GenerateAsync_MixedModules_SuccessAndFailure_CreatesBothTimelineTypes()
        {
            // Arrange
            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" },
                new BlocksLanguageModule { ItemId = "mod-2", ModuleName = "dashboard" }
            };
            var keysModule1 = new List<Key>
            {
                new KeyModel
                {
                    ItemId = "key-1",
                    KeyName = "welcome",
                    ModuleId = "mod-1",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Welcome" } }
                }
            };
            var keysModule2 = new List<Key>
            {
                new KeyModel
                {
                    ItemId = "key-2",
                    KeyName = "dashboard.title",
                    ModuleId = "mod-2",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Dashboard" } }
                }
            };

            _languageManagementServiceMock.Setup(m => m.GetLanguagesAsync())
                .ReturnsAsync(new List<Language>
                {
                    new Language { LanguageCode = "en-US", LanguageName = "English" }
                });

            // No ModuleId on command → GetModulesAsync(null)
            _moduleManagementServiceMock.Setup(m => m.GetModulesAsync((string?)null))
                .ReturnsAsync(modules);

            _keyRepositoryMock.Setup(r => r.GetAllKeysByModuleAsync("mod-1"))
                .ReturnsAsync(keysModule1);
            _keyRepositoryMock.Setup(r => r.GetAllKeysByModuleAsync("mod-2"))
                .ReturnsAsync(keysModule2);

            // Module 1 succeeds
            var callCount = 0;
            _keyRepositoryMock.Setup(r => r.DeleteOldUilmFiles(It.IsAny<List<UilmFile>>()))
                .ReturnsAsync(0L);
            _keyRepositoryMock.Setup(r => r.SaveNewUilmFiles(It.IsAny<List<UilmFile>>()))
                .Returns(() =>
                {
                    callCount++;
                    // Fail on second call (module 2)
                    if (callCount > 1)
                        throw new Exception("Storage failure");
                    return Task.FromResult(true);
                });

            _keyTimelineRepositoryMock.Setup(r => r.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), It.IsAny<string>()))
                .Returns(Task.CompletedTask);

            var command = new GenerateUilmFilesEvent
            {
                Guid = "g-1",
                ProjectKey = "tenant-1"
            };

            // Act
            var result = await _service.GenerateAsync(command);

            // Assert
            result.Should().BeTrue();

            // Published timeline for module 1 keys
            _keyTimelineRepositoryMock.Verify(
                r => r.BulkSaveKeyTimelinesAsync(
                    It.Is<List<KeyTimeline>>(timelines =>
                        timelines.Count == 1 &&
                        timelines[0].LogFrom == "Published"),
                    "tenant-1"),
                Times.Once);

            // PublishFailed timeline for module 2 keys
            _keyTimelineRepositoryMock.Verify(
                r => r.BulkSaveKeyTimelinesAsync(
                    It.Is<List<KeyTimeline>>(timelines =>
                        timelines.Count == 1 &&
                        timelines[0].LogFrom == "PublishFailed"),
                    "tenant-1"),
                Times.Once);
        }

        [Fact]
        public async Task GenerateAsync_NoKeysInModule_DoesNotCreateTimelineEntries()
        {
            // Arrange
            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "empty-module" }
            };

            SetupCommonMocks(modules, new Dictionary<string, List<Key>> { { "mod-1", new List<Key>() } });

            var command = new GenerateUilmFilesEvent
            {
                Guid = "g-1",
                ModuleId = "mod-1",
                ProjectKey = "tenant-1"
            };

            // Act
            var result = await _service.GenerateAsync(command);

            // Assert
            result.Should().BeTrue();
            _keyTimelineRepositoryMock.Verify(
                r => r.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), It.IsAny<string>()),
                Times.Never);
        }

        [Fact]
        public async Task GenerateAsync_PublishedTimeline_HasNoPreviousData()
        {
            // Arrange
            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" }
            };
            var keys = new List<Key>
            {
                new KeyModel
                {
                    ItemId = "key-1",
                    KeyName = "welcome",
                    ModuleId = "mod-1",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Welcome" } }
                }
            };

            SetupCommonMocks(modules, new Dictionary<string, List<Key>> { { "mod-1", keys } });

            var command = new GenerateUilmFilesEvent
            {
                Guid = "g-1",
                ModuleId = "mod-1",
                ProjectKey = "tenant-1"
            };

            // Act
            await _service.GenerateAsync(command);

            // Assert — PreviousData must be null (ensures no revert in FE)
            _keyTimelineRepositoryMock.Verify(
                r => r.BulkSaveKeyTimelinesAsync(
                    It.Is<List<KeyTimeline>>(timelines =>
                        timelines.All(t => t.PreviousData == null)),
                    It.IsAny<string>()),
                Times.Once);
        }

        [Fact]
        public async Task GenerateAsync_TimelineInsertedAfterHistoryAndNotification()
        {
            // Arrange
            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" }
            };
            var keys = new List<Key>
            {
                new KeyModel
                {
                    ItemId = "key-1",
                    KeyName = "welcome",
                    ModuleId = "mod-1",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Welcome" } }
                }
            };

            SetupCommonMocks(modules, new Dictionary<string, List<Key>> { { "mod-1", keys } });
            _notificationServiceMock.Setup(n => n.NotifyExtensionEvent(true, It.IsAny<string>()))
                .ReturnsAsync(true);

            var callOrder = new List<string>();

            _languageFileGenerationHistoryRepositoryMock.Setup(r => r.SaveAsync(It.IsAny<LanguageFileGenerationHistory>()))
                .Callback(() => callOrder.Add("history"))
                .Returns(Task.CompletedTask);

            _notificationServiceMock.Setup(n => n.NotifyExtensionEvent(true, "tenant-1"))
                .Callback(() => callOrder.Add("notification"))
                .ReturnsAsync(true);

            _keyTimelineRepositoryMock.Setup(r => r.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), It.IsAny<string>()))
                .Callback(() => callOrder.Add("timeline"))
                .Returns(Task.CompletedTask);

            var command = new GenerateUilmFilesEvent
            {
                Guid = "g-1",
                ModuleId = "mod-1",
                ProjectKey = "tenant-1"
            };

            // Act
            await _service.GenerateAsync(command);

            // Assert — timeline must come after history and notification
            callOrder.Should().ContainInOrder("history", "notification", "timeline");
        }

        [Fact]
        public async Task GenerateAsync_MultipleKeysInModule_AllGetPublishedTimeline()
        {
            // Arrange
            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" }
            };
            var keys = new List<Key>
            {
                new KeyModel { ItemId = "k1", KeyName = "key1", ModuleId = "mod-1", Resources = new[] { new Resource { Culture = "en-US", Value = "V1" } } },
                new KeyModel { ItemId = "k2", KeyName = "key2", ModuleId = "mod-1", Resources = new[] { new Resource { Culture = "en-US", Value = "V2" } } },
                new KeyModel { ItemId = "k3", KeyName = "key3", ModuleId = "mod-1", Resources = new[] { new Resource { Culture = "en-US", Value = "V3" } } }
            };

            SetupCommonMocks(modules, new Dictionary<string, List<Key>> { { "mod-1", keys } });

            var command = new GenerateUilmFilesEvent
            {
                Guid = "g-1",
                ModuleId = "mod-1",
                ProjectKey = "tenant-1"
            };

            // Act
            await _service.GenerateAsync(command);

            // Assert
            _keyTimelineRepositoryMock.Verify(
                r => r.BulkSaveKeyTimelinesAsync(
                    It.Is<List<KeyTimeline>>(timelines =>
                        timelines.Count == 3 &&
                        timelines.Select(t => t.EntityId).OrderBy(id => id).SequenceEqual(new[] { "k1", "k2", "k3" })),
                    "tenant-1"),
                Times.Once);
        }
    }
}
