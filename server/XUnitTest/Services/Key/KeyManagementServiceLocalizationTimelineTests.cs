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
    public class KeyManagementServiceLocalizationTimelineTests
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

        public KeyManagementServiceLocalizationTimelineTests()
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

        #region GetLocalizationTimelineAsync

        [Fact]
        public async Task GetLocalizationTimelineAsync_DelegatesToRepository()
        {
            var request = new GetLocalizationTimelineRequest { PageNumber = 1, PageSize = 10 };
            var expectedResponse = new GetLocalizationTimelineResponse
            {
                TotalCount = 2,
                Operations = new List<LocalizationTimelineEntry>
                {
                    new LocalizationTimelineEntry { OperationId = "op1", LogFrom = LogFromConstants.TranslateAll, AffectedKeysCount = 5 },
                    new LocalizationTimelineEntry { OperationId = "op2", LogFrom = LogFromConstants.KeyCreate, AffectedKeysCount = 1 }
                }
            };

            _keyTimelineRepositoryMock.Setup(r => r.GetLocalizationTimelineAsync(request))
                .ReturnsAsync(expectedResponse);

            var result = await _service.GetLocalizationTimelineAsync(request);

            result.Should().NotBeNull();
            result.TotalCount.Should().Be(2);
            result.Operations.Should().HaveCount(2);
            _keyTimelineRepositoryMock.Verify(r => r.GetLocalizationTimelineAsync(request), Times.Once);
        }

        [Fact]
        public async Task GetLocalizationTimelineAsync_EmptyResult_ReturnsEmptyList()
        {
            var request = new GetLocalizationTimelineRequest { PageNumber = 1, PageSize = 10 };
            var expectedResponse = new GetLocalizationTimelineResponse { TotalCount = 0, Operations = new List<LocalizationTimelineEntry>() };

            _keyTimelineRepositoryMock.Setup(r => r.GetLocalizationTimelineAsync(request))
                .ReturnsAsync(expectedResponse);

            var result = await _service.GetLocalizationTimelineAsync(request);

            result.TotalCount.Should().Be(0);
            result.Operations.Should().BeEmpty();
        }

        #endregion

        #region GetTimelineByOperationIdAsync

        [Fact]
        public async Task GetTimelineByOperationIdAsync_DelegatesToRepository()
        {
            var request = new GetTimelineByOperationIdRequest { OperationId = "op1", PageNumber = 1, PageSize = 10 };
            var expectedResponse = new GetKeyTimelineQueryResponse
            {
                TotalCount = 3,
                Timelines = new List<KeyTimeline>
                {
                    new KeyTimeline { ItemId = "t1", OperationId = "op1", EntityId = "e1" },
                    new KeyTimeline { ItemId = "t2", OperationId = "op1", EntityId = "e2" },
                    new KeyTimeline { ItemId = "t3", OperationId = "op1", EntityId = "e3" }
                }
            };

            _keyTimelineRepositoryMock.Setup(r => r.GetTimelineByOperationIdAsync(request))
                .ReturnsAsync(expectedResponse);

            var result = await _service.GetTimelineByOperationIdAsync(request);

            result.Should().NotBeNull();
            result.TotalCount.Should().Be(3);
            result.Timelines.Should().HaveCount(3);
            _keyTimelineRepositoryMock.Verify(r => r.GetTimelineByOperationIdAsync(request), Times.Once);
        }

        [Fact]
        public async Task GetTimelineByOperationIdAsync_EmptyResult_ReturnsEmptyList()
        {
            var request = new GetTimelineByOperationIdRequest { OperationId = "nonexistent", PageNumber = 1, PageSize = 10 };
            var expectedResponse = new GetKeyTimelineQueryResponse { TotalCount = 0, Timelines = new List<KeyTimeline>() };

            _keyTimelineRepositoryMock.Setup(r => r.GetTimelineByOperationIdAsync(request))
                .ReturnsAsync(expectedResponse);

            var result = await _service.GetTimelineByOperationIdAsync(request);

            result.TotalCount.Should().Be(0);
            result.Timelines.Should().BeEmpty();
        }

        #endregion

        #region OperationId in BulkKeyTimelineEntries

        [Fact]
        public async Task CreateBulkKeyTimelineEntriesAsync_SetsSharedOperationId()
        {
            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey { ItemId = "k1", KeyName = "key1", ModuleId = "m1" },
                new BlocksLanguageKey { ItemId = "k2", KeyName = "key2", ModuleId = "m1" }
            };

            List<KeyTimeline> capturedTimelines = null;
            _keyTimelineRepositoryMock.Setup(r => r.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), It.IsAny<string>()))
                .Callback<List<KeyTimeline>, string>((timelines, pk) => capturedTimelines = timelines)
                .Returns(Task.CompletedTask);

            await _service.CreateBulkKeyTimelineEntriesAsync(keys, LogFromConstants.Published, "test-project");

            capturedTimelines.Should().NotBeNull();
            capturedTimelines.Should().HaveCount(2);
            capturedTimelines[0].OperationId.Should().NotBeNullOrWhiteSpace();
            capturedTimelines[0].OperationId.Should().Be(capturedTimelines[1].OperationId);
        }

        [Fact]
        public async Task CreateBulkKeyTimelineEntriesAsync_WithPreviousKeys_SetsSharedOperationId()
        {
            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey { ItemId = "k1", KeyName = "key1", ModuleId = "m1" },
                new BlocksLanguageKey { ItemId = "k2", KeyName = "key2", ModuleId = "m1" }
            };
            var previousKeys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey { ItemId = "k1", KeyName = "key1_old", ModuleId = "m1" }
            };

            List<KeyTimeline> capturedTimelines = null;
            _keyTimelineRepositoryMock.Setup(r => r.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), It.IsAny<string>()))
                .Callback<List<KeyTimeline>, string>((timelines, pk) => capturedTimelines = timelines)
                .Returns(Task.CompletedTask);

            await _service.CreateBulkKeyTimelineEntriesAsync(keys, previousKeys, LogFromConstants.EnvironmentDataMigration, "test-project");

            capturedTimelines.Should().NotBeNull();
            capturedTimelines.Should().HaveCount(2);
            // All entries share the same OperationId
            capturedTimelines[0].OperationId.Should().Be(capturedTimelines[1].OperationId);
            // First key has previous data
            capturedTimelines[0].PreviousData.Should().NotBeNull();
            // Second key has no previous data (not in previousKeys)
            capturedTimelines[1].PreviousData.Should().BeNull();
        }

        [Fact]
        public async Task CreateBulkKeyTimelineEntriesAsync_EmptyList_DoesNotCallRepository()
        {
            await _service.CreateBulkKeyTimelineEntriesAsync(new List<BlocksLanguageKey>(), LogFromConstants.Published, "test-project");

            _keyTimelineRepositoryMock.Verify(r => r.BulkSaveKeyTimelinesAsync(It.IsAny<List<KeyTimeline>>(), It.IsAny<string>()), Times.Never);
        }

        #endregion

        #region LogFromConstants Usage

        [Fact]
        public void LogFromConstants_TranslateKey_HasCorrectValue()
        {
            LogFromConstants.TranslateKey.Should().Be("TranslateKey");
        }

        [Fact]
        public void LogFromConstants_TranslateAll_HasCorrectValue()
        {
            LogFromConstants.TranslateAll.Should().Be("TranslateAll");
        }

        [Fact]
        public void LogFromConstants_AllConstantsAreDefined()
        {
            LogFromConstants.KeyCreate.Should().NotBeNullOrWhiteSpace();
            LogFromConstants.KeySave.Should().NotBeNullOrWhiteSpace();
            LogFromConstants.KeyBulkCreate.Should().NotBeNullOrWhiteSpace();
            LogFromConstants.KeyBulkSave.Should().NotBeNullOrWhiteSpace();
            LogFromConstants.KeyDelete.Should().NotBeNullOrWhiteSpace();
            LogFromConstants.TranslateAll.Should().NotBeNullOrWhiteSpace();
            LogFromConstants.TranslateKey.Should().NotBeNullOrWhiteSpace();
            LogFromConstants.UilmImportUpdate.Should().NotBeNullOrWhiteSpace();
            LogFromConstants.UilmImportInsert.Should().NotBeNullOrWhiteSpace();
            LogFromConstants.Rollback.Should().NotBeNullOrWhiteSpace();
            LogFromConstants.Published.Should().NotBeNullOrWhiteSpace();
            LogFromConstants.PublishFailed.Should().NotBeNullOrWhiteSpace();
            LogFromConstants.EnvironmentDataMigration.Should().NotBeNullOrWhiteSpace();
        }

        #endregion

        #region DTO Tests

        [Fact]
        public void GetLocalizationTimelineRequest_HasCorrectDefaults()
        {
            var request = new GetLocalizationTimelineRequest();

            request.PageSize.Should().Be(10);
            request.PageNumber.Should().Be(1);
            request.SortProperty.Should().Be("CreateDate");
            request.IsDescending.Should().BeTrue();
            request.UserId.Should().BeNull();
            request.LogFrom.Should().BeNull();
            request.CreateDateRange.Should().BeNull();

        }

        [Fact]
        public void GetTimelineByOperationIdRequest_HasCorrectDefaults()
        {
            var request = new GetTimelineByOperationIdRequest();

            request.PageSize.Should().Be(10);
            request.PageNumber.Should().Be(1);
            request.OperationId.Should().Be(string.Empty);
           
        }

        [Fact]
        public void LocalizationTimelineEntry_HasCorrectDefaults()
        {
            var entry = new LocalizationTimelineEntry();

            entry.OperationId.Should().Be(string.Empty);
            entry.AffectedKeysCount.Should().Be(0);
            entry.CurrentData.Should().BeNull();
            entry.PreviousData.Should().BeNull();
        }

        [Fact]
        public void GetLocalizationTimelineResponse_HasCorrectDefaults()
        {
            var response = new GetLocalizationTimelineResponse();

            response.TotalCount.Should().Be(0);
            response.Operations.Should().NotBeNull();
            response.Operations.Should().BeEmpty();
        }

        [Fact]
        public void KeyTimeline_HasOperationIdProperty()
        {
            var timeline = new KeyTimeline
            {
                OperationId = "test-op-id",
                UserName = "Test User"
            };

            timeline.OperationId.Should().Be("test-op-id");
            timeline.UserName.Should().Be("Test User");
        }

        #endregion

        #region DeleteAsync Timeline Behavior

        [Fact]
        public async Task DeleteAsync_CreatesTimelineAfterDeletion_WithNullCurrentData()
        {
            // Arrange
            var key = new KeyModel { ItemId = "k1", KeyName = "testKey", ModuleId = "m1" };
            var repoKey = new BlocksLanguageKey { ItemId = "k1", KeyName = "testKey", ModuleId = "m1" };

            _keyRepositoryMock.Setup(r => r.GetByIdAsync("k1")).ReturnsAsync(key);
            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync("testKey", "m1")).ReturnsAsync(repoKey);
            _keyRepositoryMock.Setup(r => r.DeleteAsync("k1")).Returns(Task.CompletedTask);

            KeyTimeline? capturedTimeline = null;
            _keyTimelineRepositoryMock.Setup(r => r.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Callback<KeyTimeline>(t => capturedTimeline = t)
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.DeleteAsync(new DeleteKeyRequest { ItemId = "k1" });

            // Assert
            result.IsSuccess.Should().BeTrue();
            capturedTimeline.Should().NotBeNull();
            capturedTimeline!.CurrentData.Should().BeNull("the key is deleted so CurrentData should be empty");
            capturedTimeline.PreviousData.Should().NotBeNull("PreviousData should contain the key before deletion");
            capturedTimeline.PreviousData!.KeyName.Should().Be("testKey");
            capturedTimeline.LogFrom.Should().Be(LogFromConstants.KeyDelete);
            capturedTimeline.EntityId.Should().Be("k1");
        }

        [Fact]
        public async Task DeleteAsync_DeleteIsCalledBeforeTimelineCreation()
        {
            // Arrange — verify that DeleteAsync is called before SaveKeyTimelineAsync
            var key = new KeyModel { ItemId = "k1", KeyName = "testKey", ModuleId = "m1" };
            var repoKey = new BlocksLanguageKey { ItemId = "k1", KeyName = "testKey", ModuleId = "m1" };

            _keyRepositoryMock.Setup(r => r.GetByIdAsync("k1")).ReturnsAsync(key);
            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync("testKey", "m1")).ReturnsAsync(repoKey);

            var callOrder = new List<string>();
            _keyRepositoryMock.Setup(r => r.DeleteAsync("k1"))
                .Callback(() => callOrder.Add("delete"))
                .Returns(Task.CompletedTask);
            _keyTimelineRepositoryMock.Setup(r => r.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Callback<KeyTimeline>(_ => callOrder.Add("timeline"))
                .Returns(Task.CompletedTask);

            // Act
            await _service.DeleteAsync(new DeleteKeyRequest { ItemId = "k1" });

            // Assert
            callOrder.Should().ContainInOrder("delete", "timeline");
        }

        [Fact]
        public async Task DeleteAsync_TimelineSaveFails_StillReturnsSuccess()
        {
            // Arrange — timeline save failure should not break the delete operation
            var key = new KeyModel { ItemId = "k1", KeyName = "testKey", ModuleId = "m1" };
            var repoKey = new BlocksLanguageKey { ItemId = "k1", KeyName = "testKey", ModuleId = "m1" };

            _keyRepositoryMock.Setup(r => r.GetByIdAsync("k1")).ReturnsAsync(key);
            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync("testKey", "m1")).ReturnsAsync(repoKey);
            _keyRepositoryMock.Setup(r => r.DeleteAsync("k1")).Returns(Task.CompletedTask);
            _keyTimelineRepositoryMock.Setup(r => r.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .ThrowsAsync(new Exception("timeline save failed"));

            // Act
            var result = await _service.DeleteAsync(new DeleteKeyRequest { ItemId = "k1" });

            // Assert
            result.IsSuccess.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.DeleteAsync("k1"), Times.Once);
        }

        [Fact]
        public async Task DeleteAsync_RepoKeyNotFound_StillDeletesWithoutTimeline()
        {
            // Arrange — if GetKeyByNameAsync returns null, still delete but skip timeline
            var key = new KeyModel { ItemId = "k1", KeyName = "testKey", ModuleId = "m1" };

            _keyRepositoryMock.Setup(r => r.GetByIdAsync("k1")).ReturnsAsync(key);
            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync("testKey", "m1")).ReturnsAsync((BlocksLanguageKey?)null);
            _keyRepositoryMock.Setup(r => r.DeleteAsync("k1")).Returns(Task.CompletedTask);

            // Act
            var result = await _service.DeleteAsync(new DeleteKeyRequest { ItemId = "k1" });

            // Assert
            result.IsSuccess.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.DeleteAsync("k1"), Times.Once);
            _keyTimelineRepositoryMock.Verify(r => r.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()), Times.Never);
        }

        [Fact]
        public async Task DeleteAsync_GetKeyByNameThrows_StillDeletesAndReturnsSuccess()
        {
            // Arrange — if getting key data fails, should still delete
            var key = new KeyModel { ItemId = "k1", KeyName = "testKey", ModuleId = "m1" };

            _keyRepositoryMock.Setup(r => r.GetByIdAsync("k1")).ReturnsAsync(key);
            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync("testKey", "m1"))
                .ThrowsAsync(new Exception("db error"));
            _keyRepositoryMock.Setup(r => r.DeleteAsync("k1")).Returns(Task.CompletedTask);

            // Act
            var result = await _service.DeleteAsync(new DeleteKeyRequest { ItemId = "k1" });

            // Assert
            result.IsSuccess.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.DeleteAsync("k1"), Times.Once);
        }

        [Fact]
        public async Task DeleteAsync_TimelineHasOperationId()
        {
            // Arrange — verify the timeline entry gets an OperationId
            var key = new KeyModel { ItemId = "k1", KeyName = "testKey", ModuleId = "m1" };
            var repoKey = new BlocksLanguageKey { ItemId = "k1", KeyName = "testKey", ModuleId = "m1" };

            _keyRepositoryMock.Setup(r => r.GetByIdAsync("k1")).ReturnsAsync(key);
            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync("testKey", "m1")).ReturnsAsync(repoKey);
            _keyRepositoryMock.Setup(r => r.DeleteAsync("k1")).Returns(Task.CompletedTask);

            KeyTimeline? capturedTimeline = null;
            _keyTimelineRepositoryMock.Setup(r => r.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Callback<KeyTimeline>(t => capturedTimeline = t)
                .Returns(Task.CompletedTask);

            // Act
            await _service.DeleteAsync(new DeleteKeyRequest { ItemId = "k1" });

            // Assert
            capturedTimeline.Should().NotBeNull();
            capturedTimeline!.OperationId.Should().NotBeNullOrWhiteSpace();
        }

        #endregion
    }
}
