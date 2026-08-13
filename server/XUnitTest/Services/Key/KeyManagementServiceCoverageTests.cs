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
    public class KeyManagementServiceCoverageTests
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
        private readonly Mock<IServiceProvider> _serviceProviderMock;
        private readonly StorageHelper _storageHelper;
        private readonly Mock<INotificationService> _notificationServiceMock;
        private readonly KeyManagementService _service;

        public KeyManagementServiceCoverageTests()
        {
            XUnitTest.Shared.TestBlocksContext.Set("proj");
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
            _serviceProviderMock = new Mock<IServiceProvider>();
            var storageLoggerMock = new Mock<ILogger<StorageHelper>>();
            _storageHelper = new StorageHelper(storageLoggerMock.Object, _storageDriverServiceMock.Object);
            _notificationServiceMock = new Mock<INotificationService>();

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
                _storageHelper,
                _serviceProviderMock.Object,
                _notificationServiceMock.Object,
                Mock.Of<IGlossaryRepository>()
            );
        }

        #region DeleteCollectionsAsync Tests

        [Fact]
        public async Task DeleteCollectionsAsync_NullCollections_ReturnsFailure()
        {
            var request = new DeleteCollectionsRequest { Collections = null };

            var result = await _service.DeleteCollectionsAsync(request);

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("Collections");
        }

        [Fact]
        public async Task DeleteCollectionsAsync_EmptyCollections_ReturnsFailure()
        {
            var request = new DeleteCollectionsRequest { Collections = new List<string>() };

            var result = await _service.DeleteCollectionsAsync(request);

            result.IsSuccess.Should().BeFalse();
            result.Errors["Collections"].Should().Contain("At least one collection");
        }

        [Fact]
        public async Task DeleteCollectionsAsync_InvalidCollections_ReturnsFailure()
        {
            var request = new DeleteCollectionsRequest
            {
                Collections = new List<string> { "InvalidCollection", "AnotherBad" }
            };

            var result = await _service.DeleteCollectionsAsync(request);

            result.IsSuccess.Should().BeFalse();
            result.Errors["Collections"].Should().Contain("Invalid collections specified");
            result.Errors["Collections"].Should().Contain("InvalidCollection");
        }

        [Fact]
        public async Task DeleteCollectionsAsync_ValidCollections_ReturnsSuccess()
        {
            var request = new DeleteCollectionsRequest
            {
                Collections = new List<string> { "BlocksLanguageKeys", "BlocksLanguages" }
            };

            _keyRepositoryMock.Setup(r => r.DeleteCollectionsAsync(request.Collections))
                .ReturnsAsync(new Dictionary<string, long> { { "BlocksLanguageKeys", 10 }, { "BlocksLanguages", 5 } });

            var result = await _service.DeleteCollectionsAsync(request);

            result.IsSuccess.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.DeleteCollectionsAsync(request.Collections), Times.Once);
        }

        [Fact]
        public async Task DeleteCollectionsAsync_AllFourValidCollections_ReturnsSuccess()
        {
            var request = new DeleteCollectionsRequest
            {
                Collections = new List<string> { "BlocksLanguageKeys", "BlocksLanguages", "BlocksLanguageModules", "UilmFiles" }
            };

            _keyRepositoryMock.Setup(r => r.DeleteCollectionsAsync(request.Collections))
                .ReturnsAsync(new Dictionary<string, long> { { "BlocksLanguageKeys", 10 }, { "BlocksLanguages", 5 }, { "BlocksLanguageModules", 3 }, { "UilmFiles", 2 } });

            var result = await _service.DeleteCollectionsAsync(request);

            result.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task DeleteCollectionsAsync_RepositoryThrows_ReturnsFailure()
        {
            var request = new DeleteCollectionsRequest
            {
                Collections = new List<string> { "BlocksLanguageKeys" }
            };

            _keyRepositoryMock.Setup(r => r.DeleteCollectionsAsync(request.Collections))
                .ThrowsAsync(new Exception("DB error"));

            var result = await _service.DeleteCollectionsAsync(request);

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("Operation");
        }

        [Fact]
        public async Task DeleteCollectionsAsync_MixValidAndInvalid_ReturnsFailure()
        {
            var request = new DeleteCollectionsRequest
            {
                Collections = new List<string> { "BlocksLanguageKeys", "BadCollection" }
            };

            var result = await _service.DeleteCollectionsAsync(request);

            result.IsSuccess.Should().BeFalse();
            result.Errors["Collections"].Should().Contain("BadCollection");
        }

        #endregion

        #region RollbackAsync Tests

        [Fact]
        public async Task RollbackAsync_TimelineNotFound_ReturnsFailure()
        {
            var request = new RollbackRequest { ItemId = "item-1" };

            _keyTimelineRepositoryMock.Setup(r => r.GetTimelineByItemIdAsync("item-1"))
                .ReturnsAsync((KeyTimeline)null);

            var result = await _service.RollbackAsync(request);

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("ItemId");
        }

        [Fact]
        public async Task RollbackAsync_NoPreviousData_ReturnsFailure()
        {
            var request = new RollbackRequest { ItemId = "item-1" };

            var timeline = new KeyTimeline
            {
                EntityId = "key-1",
                PreviousData = null
            };

            _keyTimelineRepositoryMock.Setup(r => r.GetTimelineByItemIdAsync("item-1"))
                .ReturnsAsync(timeline);

            var result = await _service.RollbackAsync(request);

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("PreviousData");
        }

        [Fact]
        public async Task RollbackAsync_PreviousDataWithEmptyItemId_ReturnsFailure()
        {
            var request = new RollbackRequest { ItemId = "item-1" };

            var timeline = new KeyTimeline
            {
                EntityId = "key-1",
                PreviousData = new BlocksLanguageKey { ItemId = "" }
            };

            _keyTimelineRepositoryMock.Setup(r => r.GetTimelineByItemIdAsync("item-1"))
                .ReturnsAsync(timeline);

            var result = await _service.RollbackAsync(request);

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("PreviousData");
        }

        [Fact]
        public async Task RollbackAsync_KeyNotFound_ReturnsFailure()
        {
            var request = new RollbackRequest { ItemId = "item-1" };

            var timeline = new KeyTimeline
            {
                EntityId = "key-1",
                PreviousData = new BlocksLanguageKey
                {
                    ItemId = "prev-key-id",
                    KeyName = "test.key",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Old Value" } }
                }
            };

            _keyTimelineRepositoryMock.Setup(r => r.GetTimelineByItemIdAsync("item-1"))
                .ReturnsAsync(timeline);

            _keyRepositoryMock.Setup(r => r.GetUilmResourceKey(It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageKey, bool>>>(), ""))
                .ReturnsAsync((BlocksLanguageKey)null);

            var result = await _service.RollbackAsync(request);

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("Key");
        }

        [Fact]
        public async Task RollbackAsync_Success_UpdatesKeyAndCreatesTimeline()
        {
            var request = new RollbackRequest { ItemId = "item-1" };

            var previousData = new BlocksLanguageKey
            {
                ItemId = "key-1",
                KeyName = "test.key",
                ModuleId = "mod-1",
                Resources = new[] { new Resource { Culture = "en-US", Value = "Old Value" } },
                Routes = new List<string> { "/old" },
                IsPartiallyTranslated = false
            };

            var timeline = new KeyTimeline
            {
                EntityId = "key-1",
                PreviousData = previousData
            };

            var currentKey = new BlocksLanguageKey
            {
                ItemId = "key-1",
                KeyName = "test.key.changed",
                ModuleId = "mod-1",
                Resources = new[] { new Resource { Culture = "en-US", Value = "New Value" } },
                Routes = new List<string> { "/new" },
                IsPartiallyTranslated = true
            };

            _keyTimelineRepositoryMock.Setup(r => r.GetTimelineByItemIdAsync("item-1"))
                .ReturnsAsync(timeline);

            _keyRepositoryMock.Setup(r => r.GetUilmResourceKey(It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageKey, bool>>>(), ""))
                .ReturnsAsync(currentKey);

            _keyRepositoryMock.Setup(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>()))
                .Returns(Task.CompletedTask);

            _keyTimelineRepositoryMock.Setup(r => r.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Returns(Task.CompletedTask);

            var result = await _service.RollbackAsync(request);

            result.IsSuccess.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>()), Times.Once);
            _keyTimelineRepositoryMock.Verify(r => r.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()), Times.Once);
        }

        [Fact]
        public async Task RollbackAsync_RepositoryThrows_ReturnsFailure()
        {
            var request = new RollbackRequest { ItemId = "item-1" };

            _keyTimelineRepositoryMock.Setup(r => r.GetTimelineByItemIdAsync("item-1"))
                .ThrowsAsync(new Exception("DB error"));

            var result = await _service.RollbackAsync(request);

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("Operation");
        }

        #endregion

        #region TranslateBlocksLanguageKey Tests

        [Fact]
        public async Task TranslateBlocksLanguageKey_KeyNotFound_ReturnsFalse()
        {
            var request = new TranslateBlocksLanguageKeyEvent
            {
                KeyId = "missing-key",
                MessageCoRelationId = "corr-1",
                ProjectKey = "proj",
                DefaultLanguage = "en-US"
            };

            _languageManagementServiceMock.Setup(m => m.GetLanguagesAsync())
                .ReturnsAsync(new List<Language> { new Language { LanguageCode = "en-US", LanguageName = "English" } });

            _keyRepositoryMock.Setup(r => r.GetUilmResourceKey(
                    It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageKey, bool>>>(), It.IsAny<string>()))
                .ReturnsAsync((BlocksLanguageKey)null);

            var result = await _service.TranslateBlocksLanguageKey(request);

            result.Should().BeFalse();
        }

        [Fact]
        public async Task TranslateBlocksLanguageKey_KeyFound_TranslatesAndReturnsTrue()
        {
            var request = new TranslateBlocksLanguageKeyEvent
            {
                KeyId = "key-1",
                MessageCoRelationId = "corr-1",
                ProjectKey = "proj",
                DefaultLanguage = "en-US"
            };

            var languages = new List<Language>
            {
                new Language { LanguageCode = "en-US", LanguageName = "English" },
                new Language { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var resourceKey = new BlocksLanguageKey
            {
                ItemId = "key-1",
                KeyName = "welcome",
                ModuleId = "mod-1",
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = "Hello" },
                    new Resource { Culture = "fr-FR", Value = "" }
                }
            };

            _languageManagementServiceMock.Setup(m => m.GetLanguagesAsync())
                .ReturnsAsync(languages);

            _keyRepositoryMock.Setup(r => r.GetUilmResourceKey(
                    It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageKey, bool>>>(), It.IsAny<string>()))
                .ReturnsAsync(resourceKey);

            _assistantServiceMock.Setup(a => a.SuggestTranslation(It.IsAny<SuggestLanguageRequest>()))
                .ReturnsAsync("Bonjour");

            _keyRepositoryMock.Setup(r => r.UpdateUilmResourceKeysForChangeAll(It.IsAny<List<BlocksLanguageKey>>()))
                .ReturnsAsync(1);

            _keyTimelineRepositoryMock.Setup(r => r.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Returns(Task.CompletedTask);

            var result = await _service.TranslateBlocksLanguageKey(request);

            result.Should().BeTrue();
        }

        [Fact]
        public async Task TranslateBlocksLanguageKey_ExceptionThrown_ReturnsFalse()
        {
            var request = new TranslateBlocksLanguageKeyEvent
            {
                KeyId = "key-1",
                MessageCoRelationId = "corr-1",
                ProjectKey = "proj",
                DefaultLanguage = "en-US"
            };

            _languageManagementServiceMock.Setup(m => m.GetLanguagesAsync())
                .ThrowsAsync(new Exception("Language service error"));

            var result = await _service.TranslateBlocksLanguageKey(request);

            result.Should().BeFalse();
        }

        #endregion

        #region PublishNotification Tests

        [Fact]
        public async Task PublishUilmExportNotification_Success_LogsInformation()
        {
            _notificationServiceMock.Setup(n => n.NotifyExportEvent(true, "file-1", "corr-1", "tenant-1"))
                .ReturnsAsync(true);

            await _service.PublishUilmExportNotification(true, "file-1", "corr-1", "tenant-1");

            _notificationServiceMock.Verify(n => n.NotifyExportEvent(true, "file-1", "corr-1", "tenant-1"), Times.Once);
        }

        [Fact]
        public async Task PublishUilmExportNotification_Failure_LogsError()
        {
            _notificationServiceMock.Setup(n => n.NotifyExportEvent(false, "file-1", "corr-1", "tenant-1"))
                .ReturnsAsync(false);

            await _service.PublishUilmExportNotification(false, "file-1", "corr-1", "tenant-1");

            _notificationServiceMock.Verify(n => n.NotifyExportEvent(false, "file-1", "corr-1", "tenant-1"), Times.Once);
        }

        [Fact]
        public async Task PublishTranslateAllNotification_Success_LogsInformation()
        {
            _notificationServiceMock.Setup(n => n.NotifyTranslateAllEvent(true, "corr-1"))
                .ReturnsAsync(true);

            await _service.PublishTranslateAllNotification(true, "corr-1");

            _notificationServiceMock.Verify(n => n.NotifyTranslateAllEvent(true, "corr-1"), Times.Once);
        }

        [Fact]
        public async Task PublishTranslateAllNotification_Failure_LogsError()
        {
            _notificationServiceMock.Setup(n => n.NotifyTranslateAllEvent(true, "corr-1"))
                .ReturnsAsync(false);

            await _service.PublishTranslateAllNotification(true, "corr-1");

            _notificationServiceMock.Verify(n => n.NotifyTranslateAllEvent(true, "corr-1"), Times.Once);
        }

        [Fact]
        public async Task PublishTranslateBlocksLanguageKeyNotification_Success_LogsInformation()
        {
            _notificationServiceMock.Setup(n => n.NotifyTranslateBlocksLanguageKeyEvent(true, "corr-1"))
                .ReturnsAsync(true);

            await _service.PublishTranslateBlocksLanguageKeyNotification(true, "corr-1");

            _notificationServiceMock.Verify(n => n.NotifyTranslateBlocksLanguageKeyEvent(true, "corr-1"), Times.Once);
        }

        [Fact]
        public async Task PublishTranslateBlocksLanguageKeyNotification_Failure_LogsError()
        {
            _notificationServiceMock.Setup(n => n.NotifyTranslateBlocksLanguageKeyEvent(true, "corr-1"))
                .ReturnsAsync(false);

            await _service.PublishTranslateBlocksLanguageKeyNotification(true, "corr-1");

            _notificationServiceMock.Verify(n => n.NotifyTranslateBlocksLanguageKeyEvent(true, "corr-1"), Times.Once);
        }

        [Fact]
        public async Task PublishEnvironmentDataMigrationNotification_Success_LogsInformation()
        {
            _notificationServiceMock.Setup(n => n.NotifyEnvironmentDataMigrationEvent(true, "corr-1", "proj-1", "proj-2"))
                .ReturnsAsync(true);

            await _service.PublishEnvironmentDataMigrationNotification(true, "corr-1", "proj-1", "proj-2");

            _notificationServiceMock.Verify(n => n.NotifyEnvironmentDataMigrationEvent(true, "corr-1", "proj-1", "proj-2"), Times.Once);
        }

        [Fact]
        public async Task PublishEnvironmentDataMigrationNotification_Failure_LogsError()
        {
            _notificationServiceMock.Setup(n => n.NotifyEnvironmentDataMigrationEvent(true, "corr-1", "proj-1", "proj-2"))
                .ReturnsAsync(false);

            await _service.PublishEnvironmentDataMigrationNotification(true, "corr-1", "proj-1", "proj-2");

            _notificationServiceMock.Verify(n => n.NotifyEnvironmentDataMigrationEvent(true, "corr-1", "proj-1", "proj-2"), Times.Once);
        }

        #endregion

        #region CreateBulkKeyTimelineEntriesAsync Tests

        [Fact]
        public async Task CreateBulkKeyTimelineEntriesAsync_EmptyKeys_ReturnsImmediately()
        {
            await _service.CreateBulkKeyTimelineEntriesAsync(new List<BlocksLanguageKey>(), "Migration", "proj");

            _keyTimelineRepositoryMock.Verify(r => r.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task CreateBulkKeyTimelineEntriesAsync_WithKeys_SavesTimelines()
        {
            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey { ItemId = "key-1", KeyName = "k1", ModuleId = "m1" },
                new BlocksLanguageKey { ItemId = "key-2", KeyName = "k2", ModuleId = "m1" }
            };

            _keyTimelineRepositoryMock.Setup(r => r.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), "proj"))
                .Returns(Task.CompletedTask);

            await _service.CreateBulkKeyTimelineEntriesAsync(keys, "Migration", "proj");

            _keyTimelineRepositoryMock.Verify(r => r.BulkSaveKeyTimelinesAsync(
                It.Is<List<KeyTimeline>>(t => t.Count == 2), "proj"), Times.Once);
        }

        [Fact]
        public async Task CreateBulkKeyTimelineEntriesAsync_ExceptionThrown_DoesNotThrow()
        {
            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey { ItemId = "key-1", KeyName = "k1", ModuleId = "m1" }
            };

            _keyTimelineRepositoryMock.Setup(r => r.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), "proj"))
                .ThrowsAsync(new Exception("DB error"));

            var act = async () => await _service.CreateBulkKeyTimelineEntriesAsync(keys, "Migration", "proj");

            await act.Should().NotThrowAsync();
        }

        [Fact]
        public async Task CreateBulkKeyTimelineEntriesAsync_WithPreviousKeys_MapsPreviousData()
        {
            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey { ItemId = "key-1", KeyName = "k1", ModuleId = "m1" },
                new BlocksLanguageKey { ItemId = "key-2", KeyName = "k2", ModuleId = "m1" }
            };

            var previousKeys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey { ItemId = "key-1", KeyName = "k1-old", ModuleId = "m1" }
            };

            List<KeyTimeline> capturedTimelines = null;
            _keyTimelineRepositoryMock.Setup(r => r.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), "proj"))
                .Callback<List<KeyTimeline>, string>((t, _) => capturedTimelines = t)
                .Returns(Task.CompletedTask);

            await _service.CreateBulkKeyTimelineEntriesAsync(keys, previousKeys, "Migration", "proj");

            capturedTimelines.Should().HaveCount(2);
            capturedTimelines[0].PreviousData.Should().NotBeNull();
            capturedTimelines[1].PreviousData.Should().BeNull();
        }

        [Fact]
        public async Task CreateBulkKeyTimelineEntriesAsync_WithPreviousKeys_EmptyKeys_ReturnsImmediately()
        {
            await _service.CreateBulkKeyTimelineEntriesAsync(
                new List<BlocksLanguageKey>(), new List<BlocksLanguageKey>(), "Migration", "proj");

            _keyTimelineRepositoryMock.Verify(r => r.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task CreateBulkKeyTimelineEntriesAsync_WithPreviousKeys_ExceptionThrown_DoesNotThrow()
        {
            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey { ItemId = "key-1", KeyName = "k1", ModuleId = "m1" }
            };

            _keyTimelineRepositoryMock.Setup(r => r.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), "proj"))
                .ThrowsAsync(new Exception("DB error"));

            var act = async () => await _service.CreateBulkKeyTimelineEntriesAsync(keys, new List<BlocksLanguageKey>(), "Migration", "proj");

            await act.Should().NotThrowAsync();
        }

        #endregion

        #region SendTranslateBlocksLanguageKeyEvent Tests

        [Fact]
        public async Task SendTranslateBlocksLanguageKeyEvent_PublishesToQueue()
        {
            var request = new TranslateBlocksLanguageKeyRequest
            {
                KeyId = "key-1",
                MessageCoRelationId = "corr-1",
              
                DefaultLanguage = "en-US"
            };

            _messageClientMock.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<TranslateBlocksLanguageKeyEvent>>()))
                .Returns(Task.CompletedTask);

            await _service.SendTranslateBlocksLanguageKeyEvent(request);

            _messageClientMock.Verify(m => m.SendToConsumerAsync(
                It.Is<ConsumerMessage<TranslateBlocksLanguageKeyEvent>>(msg =>
                    msg.Payload.KeyId == "key-1" &&
                    msg.Payload.MessageCoRelationId == "corr-1" &&
                    msg.Payload.ProjectKey == "proj" &&
                    msg.Payload.DefaultLanguage == "en-US"
                )), Times.Once);
        }

        #endregion

        #region SendUilmImportEvent Tests

        [Fact]
        public async Task SendUilmImportEvent_PublishesToQueue()
        {
            var request = new UilmImportRequest
            {
                FileId = "file-1",
                MessageCoRelationId = "corr-1"
               
            };

            _messageClientMock.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<UilmImportEvent>>()))
                .Returns(Task.CompletedTask);

            await _service.SendUilmImportEvent(request);

            _messageClientMock.Verify(m => m.SendToConsumerAsync(
                It.Is<ConsumerMessage<UilmImportEvent>>(msg =>
                    msg.Payload.FileId == "file-1" &&
                    msg.Payload.MessageCoRelationId == "corr-1" &&
                    msg.Payload.ProjectKey == "proj"
                )), Times.Once);
        }

        #endregion

        #region GetUilmFile Tests

        [Fact]
        public async Task GetUilmFile_ReturnsContent()
        {
            var request = new GetUilmFileRequest();
            var uilmFile = new UilmFile { Content = "{\"key\":\"value\"}" };

            _keyRepositoryMock.Setup(r => r.GetUilmFile(request))
                .ReturnsAsync(uilmFile);

            var result = await _service.GetUilmFile(request);

            result.Should().Be("{\"key\":\"value\"}");
        }

        [Fact]
        public async Task GetUilmFile_ReturnsNullWhenNotFound()
        {
            var request = new GetUilmFileRequest();

            _keyRepositoryMock.Setup(r => r.GetUilmFile(request))
                .ReturnsAsync((UilmFile)null);

            var result = await _service.GetUilmFile(request);

            result.Should().BeNull();
        }

        #endregion

        #region SaveUniqeFiles Tests

        [Fact]
        public async Task SaveUniqeFiles_DeletesOldAndSavesNew()
        {
            var uilmFiles = new List<UilmFile>
            {
                new UilmFile { Id = "1", Language = "en-US", ModuleName = "auth", Content = "{}" }
            };

            _keyRepositoryMock.Setup(r => r.DeleteOldUilmFiles(uilmFiles))
                .ReturnsAsync(1L);
            _keyRepositoryMock.Setup(r => r.SaveNewUilmFiles(uilmFiles))
                .ReturnsAsync(true);

            var result = await _service.SaveUniqeFiles(uilmFiles);

            result.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.DeleteOldUilmFiles(uilmFiles), Times.Once);
            _keyRepositoryMock.Verify(r => r.SaveNewUilmFiles(uilmFiles), Times.Once);
        }

        #endregion

        #region ProcessUilmFile Tests

        [Fact]
        public void ProcessUilmFile_GeneratesFilesPerLanguage()
        {
            var command = new GenerateUilmFilesEvent { ModuleId = "mod-1", ProjectKey = "proj" };

            var languages = new List<Language>
            {
                new Language { LanguageCode = "en-US", LanguageName = "English" },
                new Language { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var resourceKeys = new List<KeyModel>
            {
                new KeyModel
                {
                    ItemId = "key-1",
                    KeyName = "welcome",
                    ModuleId = "mod-1",
                    Resources = new[]
                    {
                        new Resource { Culture = "en-US", Value = "Hello" },
                        new Resource { Culture = "fr-FR", Value = "Bonjour" }
                    }
                }
            };

            var application = new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" };

            var result = _service.ProcessUilmFile(command, languages, resourceKeys, application);

            // 2 languages + 1 key language = 3 files
            result.Should().HaveCount(3);
            result.All(f => f.ModuleName == "auth").Should().BeTrue();
        }

        [Fact]
        public void ProcessUilmFile_IncludesKeyLanguage()
        {
            var command = new GenerateUilmFilesEvent { ModuleId = "mod-1", ProjectKey = "proj" };
            var languages = new List<Language>
            {
                new Language { LanguageCode = "en-US", LanguageName = "English" }
            };
            var resourceKeys = new List<KeyModel>
            {
                new KeyModel
                {
                    KeyName = "welcome",
                    ModuleId = "mod-1",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Hi" } }
                }
            };
            var application = new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" };

            var result = _service.ProcessUilmFile(command, languages, resourceKeys, application);

            result.Should().Contain(f => f.Language == "key");
        }

        #endregion

        #region GetUilmExportedFilesAsync Tests

        [Fact]
        public async Task GetUilmExportedFilesAsync_DelegatesToRepository()
        {
            var request = new GetUilmExportedFilesRequest {  PageSize = 10, PageNumber = 0 };
            var expected = new GetUilmExportedFilesQueryResponse { TotalCount = 5 };

            _keyRepositoryMock.Setup(r => r.GetUilmExportedFilesAsync(request))
                .ReturnsAsync(expected);

            var result = await _service.GetUilmExportedFilesAsync(request);

            result.TotalCount.Should().Be(5);
            _keyRepositoryMock.Verify(r => r.GetUilmExportedFilesAsync(request), Times.Once);
        }

        #endregion

        #region ChangeAll Tests

        [Fact]
        public async Task ChangeAll_NoResourceKeys_ReturnsTrue()
        {
            _languageManagementServiceMock.Setup(m => m.GetLanguagesAsync())
                .ReturnsAsync(new List<Language> { new Language { LanguageCode = "en-US", LanguageName = "English" } });

            _keyRepositoryMock.Setup(r => r.GetUilmResourceKeysWithPage(0, 1000))
                .ReturnsAsync(new List<BlocksLanguageKey>().AsQueryable());

            var request = new TranslateAllEvent { DefaultLanguage = "en-US", ProjectKey = "proj" };

            var result = await _service.ChangeAll(request);

            result.Should().BeTrue();
        }

        [Fact]
        public async Task ChangeAll_WithResources_ProcessesAndUpdates()
        {
            var languages = new List<Language>
            {
                new Language { LanguageCode = "en-US", LanguageName = "English" },
                new Language { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var resourceKeys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "key-1",
                    KeyName = "welcome",
                    ModuleId = "mod-1",
                    Resources = new[]
                    {
                        new Resource { Culture = "en-US", Value = "Hello" },
                        new Resource { Culture = "fr-FR", Value = "" }
                    }
                }
            };

            _languageManagementServiceMock.Setup(m => m.GetLanguagesAsync())
                .ReturnsAsync(languages);

            _keyRepositoryMock.SetupSequence(r => r.GetUilmResourceKeysWithPage(It.IsAny<int>(), 1000))
                .ReturnsAsync(resourceKeys.AsQueryable())
                .ReturnsAsync(new List<BlocksLanguageKey>().AsQueryable());

            _assistantServiceMock.Setup(a => a.SuggestTranslation(It.IsAny<SuggestLanguageRequest>()))
                .ReturnsAsync("Bonjour");

            _keyRepositoryMock.Setup(r => r.UpdateUilmResourceKeysForChangeAll(It.IsAny<List<BlocksLanguageKey>>()))
                .ReturnsAsync(1);

            _keyTimelineRepositoryMock.Setup(r => r.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Returns(Task.CompletedTask);

            var request = new TranslateAllEvent { DefaultLanguage = "en-US", ProjectKey = "proj" };

            var result = await _service.ChangeAll(request);

            result.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.UpdateUilmResourceKeysForChangeAll(It.IsAny<List<BlocksLanguageKey>>()), Times.Once);
        }

        #endregion

        #region SaveKeyAsync Additional Edge Cases

        [Fact]
        public async Task SaveKeyAsync_RepositoryThrows_ReturnsError()
        {
            var key = new KeyModel
            {
                KeyName = "test.key",
                ModuleId = "mod-1",
                Resources = new[] { new Resource { Culture = "en-US", Value = "Test" } }
            };

            _validatorMock.Setup(v => v.ValidateAsync(key, default))
                .ReturnsAsync(new FluentValidation.Results.ValidationResult());

            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync(key.KeyName, key.ModuleId))
                .ThrowsAsync(new Exception("DB error"));

            var result = await _service.SaveKeyAsync(key);

            result.Success.Should().BeFalse();
        }

        #endregion

        #region SaveKeysAsync Additional Edge Cases

        [Fact]
        public async Task SaveKeysAsync_NullList_ReturnsError()
        {
            var result = await _service.SaveKeysAsync(null);

            result.Success.Should().BeFalse();
        }

        [Fact]
        public async Task SaveKeysAsync_OneKeyThrows_ContinuesWithOthers()
        {
            var keys = new List<KeyModel>
            {
                new KeyModel { KeyName = "key1", ModuleId = "mod-1", Resources = new[] { new Resource { Culture = "en-US", Value = "V1" } }},
                new KeyModel { KeyName = "key2", ModuleId = "mod-1", Resources = new[] { new Resource { Culture = "en-US", Value = "V2" } } }
            };

            _validatorMock.Setup(v => v.ValidateAsync(It.IsAny<KeyModel>(), default))
                .ReturnsAsync(new FluentValidation.Results.ValidationResult());

            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync("key1", "mod-1"))
                .ThrowsAsync(new Exception("Timeout"));
            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync("key2", "mod-1"))
                .ReturnsAsync((BlocksLanguageKey)null);
            _keyRepositoryMock.Setup(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>()))
                .Returns(Task.CompletedTask);
            _keyTimelineRepositoryMock.Setup(r => r.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Returns(Task.CompletedTask);

            var result = await _service.SaveKeysAsync(keys);

            result.Success.Should().BeFalse();
            result.ErrorMessage.Should().Contain("1 errors");
        }

        [Fact]
        public async Task SaveKeysAsync_WithShouldPublish_SendsGenerateEvent()
        {
            var keys = new List<KeyModel>
            {
                new KeyModel
                {
                    KeyName = "key1",
                    ModuleId = "mod-1",
                    ItemId = "id-1",
                    ShouldPublish = true,
                    Resources = new[] { new Resource { Culture = "en-US", Value = "V1" } },
                   
                }
            };

            _validatorMock.Setup(v => v.ValidateAsync(It.IsAny<KeyModel>(), default))
                .ReturnsAsync(new FluentValidation.Results.ValidationResult());
            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync("key1", "mod-1"))
                .ReturnsAsync((BlocksLanguageKey)null);
            _keyRepositoryMock.Setup(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>()))
                .Returns(Task.CompletedTask);
            _messageClientMock.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<GenerateUilmFilesEvent>>()))
                .Returns(Task.CompletedTask);
            _keyTimelineRepositoryMock.Setup(r => r.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Returns(Task.CompletedTask);

            var result = await _service.SaveKeysAsync(keys);

            result.Success.Should().BeTrue();
            _messageClientMock.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<GenerateUilmFilesEvent>>()), Times.Once);
        }

        [Fact]
        public async Task SaveKeysAsync_ExistingKey_CreatesUpdateTimeline()
        {
            var keys = new List<KeyModel>
            {
                new KeyModel
                {
                    KeyName = "key1",
                    ModuleId = "mod-1",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "V1" } },
                    
                }
            };

            var existingKey = new BlocksLanguageKey
            {
                ItemId = "existing-id",
                KeyName = "key1",
                ModuleId = "mod-1",
                CreateDate = DateTime.UtcNow.AddDays(-1)
            };

            _validatorMock.Setup(v => v.ValidateAsync(It.IsAny<KeyModel>(), default))
                .ReturnsAsync(new FluentValidation.Results.ValidationResult());
            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync("key1", "mod-1"))
                .ReturnsAsync(existingKey);
            _keyRepositoryMock.Setup(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>()))
                .Returns(Task.CompletedTask);
            _keyTimelineRepositoryMock.Setup(r => r.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Returns(Task.CompletedTask);

            var result = await _service.SaveKeysAsync(keys);

            result.Success.Should().BeTrue();
            _keyTimelineRepositoryMock.Verify(r => r.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()), Times.Once);
        }

        #endregion

        #region GenerateAsync Additional Tests

        [Fact]
        public async Task GenerateAsync_WithNoModule_GeneratesForAllModules()
        {
            var languages = new List<Language>
            {
                new Language { LanguageCode = "en-US", LanguageName = "English" }
            };
            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "auth" }
            };
            var keys = new List<KeyModel>
            {
                new KeyModel
                {
                    KeyName = "welcome",
                    ModuleId = "mod-1",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Hello" } }
                }
            };

            _languageManagementServiceMock.Setup(m => m.GetLanguagesAsync()).ReturnsAsync(languages);
            _moduleManagementServiceMock.Setup(m => m.GetModulesAsync((string?)null)).ReturnsAsync(modules);
            _keyRepositoryMock.Setup(r => r.GetAllKeysByModuleAsync("mod-1")).ReturnsAsync(keys);
            _keyRepositoryMock.Setup(r => r.DeleteOldUilmFiles(It.IsAny<List<UilmFile>>())).ReturnsAsync(0L);
            _keyRepositoryMock.Setup(r => r.SaveNewUilmFiles(It.IsAny<List<UilmFile>>())).ReturnsAsync(true);
            _languageFileGenerationHistoryRepositoryMock.Setup(r => r.GetLatestLanguageFileGenerationHistory(It.IsAny<string>()))
                .ReturnsAsync((LanguageFileGenerationHistory)null);
            _languageFileGenerationHistoryRepositoryMock.Setup(r => r.SaveAsync(It.IsAny<LanguageFileGenerationHistory>()))
                .Returns(Task.CompletedTask);

            var command = new GenerateUilmFilesEvent { ProjectKey = "proj" };

            var result = await _service.GenerateAsync(command);

            result.Should().BeTrue();
            _moduleManagementServiceMock.Verify(m => m.GetModulesAsync((string?)null), Times.Once);
            _languageFileGenerationHistoryRepositoryMock.Verify(r => r.SaveAsync(It.IsAny<LanguageFileGenerationHistory>()), Times.Once);
        }

        #endregion

        #region ExportUilmFile Tests

        [Fact]
        public async Task ExportUilmFile_DefaultOutputType_ReturnsFalse()
        {
            var request = new UilmExportEvent
            {
                FileId = "file-1",
                OutputType = OutputType.Xml,
                ProjectKey = "proj"
            };

            _keyRepositoryMock.Setup(r => r.GetLanguageSettingAsync(It.IsAny<string>()))
                .ReturnsAsync(new BlocksLanguage { LanguageCode = "en-US" });
            _keyRepositoryMock.Setup(r => r.GetUilmApplications<BlocksLanguageModule>(It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageModule, bool>>>()))
                .ReturnsAsync(new List<BlocksLanguageModule>());
            _keyRepositoryMock.Setup(r => r.GetUilmResourceKeys(It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageKey, bool>>>(), It.IsAny<string>()))
                .ReturnsAsync(new List<BlocksLanguageKey>());

            var result = await _service.ExportUilmFile(request);

            result.Should().BeFalse();
        }

        [Fact]
        public async Task ExportUilmFile_TextOutputType_ReturnsFalse()
        {
            var request = new UilmExportEvent
            {
                FileId = "file-1",
                OutputType = OutputType.Text,
                ProjectKey = "proj"
            };

            _keyRepositoryMock.Setup(r => r.GetLanguageSettingAsync(It.IsAny<string>()))
                .ReturnsAsync(new BlocksLanguage { LanguageCode = "en-US" });
            _keyRepositoryMock.Setup(r => r.GetUilmApplications<BlocksLanguageModule>(It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageModule, bool>>>()))
                .ReturnsAsync(new List<BlocksLanguageModule>());
            _keyRepositoryMock.Setup(r => r.GetUilmResourceKeys(It.IsAny<System.Linq.Expressions.Expression<Func<BlocksLanguageKey, bool>>>(), It.IsAny<string>()))
                .ReturnsAsync(new List<BlocksLanguageKey>());

            var result = await _service.ExportUilmFile(request);

            result.Should().BeFalse();
        }

        #endregion

        #region ProcessMissingResource Tests

        [Fact]
        public async Task ProcessMissingResource_NoLanguageName_DoesNotTranslate()
        {
            var request = new TranslateAllEvent { DefaultLanguage = "en-US", ProjectKey = "proj" };
            var resourceKey = new BlocksLanguageKey { KeyName = "test", ModuleId = "m1" };
            var defaultResource = new Resource { Culture = "en-US", Value = "Hello" };
            var missingResource = new Resource { Culture = "unknown-LANG" };
            var resources = new List<Resource> { defaultResource, missingResource };
            var languages = new List<Language> { new Language { LanguageCode = "en-US", LanguageName = "English" } };

            await _service.ProcessMissingResource(request, resourceKey, defaultResource, missingResource, resources, languages);

            _assistantServiceMock.Verify(a => a.SuggestTranslation(It.IsAny<SuggestLanguageRequest>()), Times.Never);
        }

        #endregion

        #region DeleteAsync Additional Tests

        [Fact]
        public async Task DeleteAsync_TimelineCreationFails_StillDeletes()
        {
            var request = new DeleteKeyRequest { ItemId = "key-id" };

            _keyRepositoryMock.Setup(r => r.GetByIdAsync("key-id"))
                .ReturnsAsync(new KeyModel { ItemId = "key-id", KeyName = "test", ModuleId = "mod-1" });
            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync("test", "mod-1"))
                .ThrowsAsync(new Exception("Timeline error"));
            _keyRepositoryMock.Setup(r => r.DeleteAsync("key-id"))
                .Returns(Task.CompletedTask);

            var result = await _service.DeleteAsync(request);

            result.IsSuccess.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.DeleteAsync("key-id"), Times.Once);
        }

        #endregion
    }
}
