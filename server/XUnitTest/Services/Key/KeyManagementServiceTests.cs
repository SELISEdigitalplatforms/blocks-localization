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
    public class KeyManagementServiceTests
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
        private readonly Mock<IGlossaryRepository> _glossaryRepositoryMock;
        private readonly KeyManagementService _service;

        public KeyManagementServiceTests()
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
            _serviceProviderMock = new Mock<IServiceProvider>();
            var storageLoggerMock = new Mock<ILogger<StorageHelper>>();
            _storageHelper = new StorageHelper(storageLoggerMock.Object, _storageDriverServiceMock.Object);
            _notificationServiceMock = new Mock<INotificationService>();
            _glossaryRepositoryMock = new Mock<IGlossaryRepository>();

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
                _glossaryRepositoryMock.Object
            );
        }

        [Fact]
        public async Task SaveKeyAsync_ValidKey_ReturnsSuccess()
        {
            // Arrange
            var key = new KeyModel
            {
                KeyName = "welcome.message",
                ModuleId = "auth-module",
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = "Welcome" }
                }
            };

            var validationResult = new FluentValidation.Results.ValidationResult();
            _validatorMock.Setup(v => v.ValidateAsync(key, default))
                .ReturnsAsync(validationResult);

            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync(key.KeyName, key.ModuleId))
                .ReturnsAsync((BlocksLanguageKey)null);

            _keyRepositoryMock.Setup(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>()))
                .Returns(Task.CompletedTask);

            _keyTimelineRepositoryMock.Setup(r => r.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.SaveKeyAsync(key);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>()), Times.Once);
        }

        [Fact]
        public async Task GenerateAsync_WithModule_GeneratesFilesAndNotifies()
        {
            var languages = new List<Language>
            {
                new Language { LanguageCode = "en-US", LanguageName = "English" }
            };
            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "module-id", ModuleName = "auth" }
            };
            var keys = new List<Key>
            {
                new KeyModel
                {
                    ItemId = "key-id",
                    KeyName = "welcome",
                    ModuleId = "module-id",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Welcome" } }
                }
            };

            _languageManagementServiceMock.Setup(m => m.GetLanguagesAsync())
                .ReturnsAsync(languages);
            _moduleManagementServiceMock.Setup(m => m.GetModulesAsync(It.IsAny<string>()))
                .ReturnsAsync(modules);
            _keyRepositoryMock.Setup(r => r.GetAllKeysByModuleAsync("module-id"))
                .ReturnsAsync(keys);
            _keyRepositoryMock.Setup(r => r.DeleteOldUilmFiles(It.IsAny<List<UilmFile>>()))
                .ReturnsAsync(0L);
            _keyRepositoryMock.Setup(r => r.SaveNewUilmFiles(It.IsAny<List<UilmFile>>()))
                .ReturnsAsync(true);
            _notificationServiceMock.Setup(n => n.NotifyExtensionEvent(true, It.IsAny<string>()))
                .ReturnsAsync(true);

            var command = new GenerateUilmFilesEvent
            {
                ModuleId = "module-id",
                ProjectKey = "proj"
            };

            var result = await _service.GenerateAsync(command);

            result.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.SaveNewUilmFiles(It.IsAny<List<UilmFile>>()), Times.AtLeastOnce);
            _notificationServiceMock.Verify(n => n.NotifyExtensionEvent(true, "proj"), Times.Once);
        }

        [Fact]
        public async Task SendTranslateAllEvent_PublishesToQueue()
        {
            var request = new TranslateAllRequest
            {
                MessageCoRelationId = "corr",
         
                DefaultLanguage = "en-US"
            };

            await _service.SendTranslateAllEvent(request);

            _messageClientMock.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<TranslateAllEvent>>()), Times.Once);
        }

        [Fact]
        public async Task SendGenerateUilmFilesEvent_PublishesToQueue()
        {
            var request = new GenerateUilmFilesRequest
            {
                Guid = "guid",
                ProjectKey = "proj",
                ModuleId = "module"
            };

            await _service.SendGenerateUilmFilesEvent(request);

            _messageClientMock.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<GenerateUilmFilesEvent>>()), Times.Once);
        }

        [Fact]
        public async Task SendUilmExportEvent_PublishesToQueueWithFileId()
        {
            ConsumerMessage<UilmExportEvent>? captured = null;
            _messageClientMock.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<UilmExportEvent>>()))
                .Callback<ConsumerMessage<UilmExportEvent>>(msg => captured = msg)
                .Returns(Task.CompletedTask);

            var request = new UilmExportRequest
            {
                
                AppIds = new List<string> { "module" },
                Languages = new List<string> { "en-US" },
                OutputType = OutputType.Json
            };

            await _service.SendUilmExportEvent(request);

            captured.Should().NotBeNull();
            captured!.Payload.FileId.Should().NotBeNullOrEmpty();
            _messageClientMock.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<UilmExportEvent>>()), Times.Once);
        }

        [Fact]
        public async Task SaveKeyAsync_InvalidKey_ReturnsValidationError()
        {
            // Arrange
            var key = new KeyModel
            {
                KeyName = "",
                ModuleId = "auth-module"
            };

            var validationResult = new FluentValidation.Results.ValidationResult();
            validationResult.Errors.Add(new FluentValidation.Results.ValidationFailure("KeyName", "KeyName is required."));
            
            _validatorMock.Setup(v => v.ValidateAsync(key, default))
                .ReturnsAsync(validationResult);

            // Act
            var result = await _service.SaveKeyAsync(key);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeFalse();
            _keyRepositoryMock.Verify(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>()), Times.Never);
        }

        [Fact]
        public async Task SaveKeyAsync_ExistingKey_UpdatesKey()
        {
            // Arrange
            var key = new KeyModel
            {
                KeyName = "welcome.message",
                ModuleId = "auth-module",
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = "Welcome Updated" }
                }
            };

            var existingKey = new BlocksLanguageKey
            {
                ItemId = "existing-id",
                KeyName = "welcome.message",
                ModuleId = "auth-module",
                CreateDate = DateTime.UtcNow.AddDays(-1)
            };

            var validationResult = new FluentValidation.Results.ValidationResult();
            _validatorMock.Setup(v => v.ValidateAsync(key, default))
                .ReturnsAsync(validationResult);

            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync(key.KeyName, key.ModuleId))
                .ReturnsAsync(existingKey);

            _keyRepositoryMock.Setup(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>()))
                .Returns(Task.CompletedTask);

            _keyTimelineRepositoryMock.Setup(r => r.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.SaveKeyAsync(key);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>()), Times.Once);
        }

        [Fact]
        public async Task SaveKeyAsync_WithShouldPublish_TriggersUilmGeneration()
        {
            // Arrange
            var key = new KeyModel
            {
                KeyName = "welcome.message",
                ModuleId = "auth-module",
                ItemId = "key-id",
                ShouldPublish = true,
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = "Welcome" }
                }
            };

            var validationResult = new FluentValidation.Results.ValidationResult();
            _validatorMock.Setup(v => v.ValidateAsync(key, default))
                .ReturnsAsync(validationResult);

            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync(key.KeyName, key.ModuleId))
                .ReturnsAsync((BlocksLanguageKey)null);

            _keyRepositoryMock.Setup(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>()))
                .Returns(Task.CompletedTask);

            _messageClientMock.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<GenerateUilmFilesEvent>>()))
                .Returns(Task.CompletedTask);

            _keyTimelineRepositoryMock.Setup(r => r.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.SaveKeyAsync(key);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            _messageClientMock.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<GenerateUilmFilesEvent>>()), Times.Once);
        }

        [Fact]
        public async Task SaveKeysAsync_MultipleKeys_ProcessesAll()
        {
            // Arrange
            var keys = new List<Key>
            {
                new KeyModel
                {
                    KeyName = "key1",
                    ModuleId = "module1",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Value1" } }
                },
                new KeyModel
                {
                    KeyName = "key2",
                    ModuleId = "module1",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Value2" } }
                }
            };

            var validationResult = new FluentValidation.Results.ValidationResult();
            _validatorMock.Setup(v => v.ValidateAsync(It.IsAny<Key>(), default))
                .ReturnsAsync(validationResult);

            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync(It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync((BlocksLanguageKey)null);

            _keyRepositoryMock.Setup(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>()))
                .Returns(Task.CompletedTask);

            _keyTimelineRepositoryMock.Setup(r => r.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.SaveKeysAsync(keys);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>()), Times.Exactly(2));
        }

        [Fact]
        public async Task SaveKeysAsync_EmptyList_ReturnsError()
        {
            // Arrange
            var keys = new List<Key>();

            // Act
            var result = await _service.SaveKeysAsync(keys);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeFalse();
            result.ErrorMessage.Should().Contain("cannot be null or empty");
        }

        [Fact]
        public async Task SaveKeysAsync_SomeKeysInvalid_ContinuesProcessing()
        {
            // Arrange
            var keys = new List<Key>
            {
                new KeyModel
                {
                    KeyName = "valid-key",
                    ModuleId = "module1",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Value" } }
                },
                new KeyModel
                {
                    KeyName = "",
                    ModuleId = "module1"
                }
            };

            var validResult = new FluentValidation.Results.ValidationResult();
            var invalidResult = new FluentValidation.Results.ValidationResult();
            invalidResult.Errors.Add(new FluentValidation.Results.ValidationFailure("KeyName", "KeyName is required."));

            _validatorMock.Setup(v => v.ValidateAsync(keys[0], default))
                .ReturnsAsync(validResult);
            _validatorMock.Setup(v => v.ValidateAsync(keys[1], default))
                .ReturnsAsync(invalidResult);

            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync(keys[0].KeyName, keys[0].ModuleId))
                .ReturnsAsync((BlocksLanguageKey)null);

            _keyRepositoryMock.Setup(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>()))
                .Returns(Task.CompletedTask);

            _keyTimelineRepositoryMock.Setup(r => r.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.SaveKeysAsync(keys);

            // Assert
            result.Should().NotBeNull();
            _keyRepositoryMock.Verify(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>()), Times.Once);
        }

        [Fact]
        public async Task GetAsync_KeyExists_ReturnsKey()
        {
            // Arrange
            var request = new GetKeyRequest { ItemId = "key-id" };
            var key = new KeyModel
            {
                ItemId = "key-id",
                KeyName = "welcome.message",
                ModuleId = "auth-module"
            };

            _keyRepositoryMock.Setup(r => r.GetByIdAsync(request.ItemId))
                .ReturnsAsync(key);

            // Act
            var result = await _service.GetAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.ItemId.Should().Be("key-id");
            _keyRepositoryMock.Verify(r => r.GetByIdAsync(request.ItemId), Times.Once);
        }

        [Fact]
        public async Task GetAsync_KeyNotFound_ReturnsNull()
        {
            // Arrange
            var request = new GetKeyRequest { ItemId = "non-existent" };

            _keyRepositoryMock.Setup(r => r.GetByIdAsync(request.ItemId))
                .ReturnsAsync((Key)null);

            // Act
            var result = await _service.GetAsync(request);

            // Assert
            result.Should().BeNull();
        }

        [Fact]
        public async Task DeleteAsync_KeyExists_ReturnsSuccess()
        {
            // Arrange
            var request = new DeleteKeyRequest { ItemId = "key-id" };
            var repoKey = new BlocksLanguageKey
            {
                ItemId = "key-id",
                KeyName = "welcome.message",
                ModuleId = "auth-module"
            };

            _keyRepositoryMock.Setup(r => r.GetByIdAsync(request.ItemId))
                .ReturnsAsync(new KeyModel { ItemId = "key-id", KeyName = "welcome.message", ModuleId = "auth-module" });

            _keyRepositoryMock.Setup(r => r.GetKeyByNameAsync(repoKey.KeyName, repoKey.ModuleId))
                .ReturnsAsync(repoKey);

            _keyRepositoryMock.Setup(r => r.DeleteAsync(request.ItemId))
                .Returns(Task.CompletedTask);

            _keyTimelineRepositoryMock.Setup(r => r.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.DeleteAsysnc(request);

            // Assert
            result.Should().NotBeNull();
            result.IsSuccess.Should().BeTrue();
            _keyRepositoryMock.Verify(r => r.DeleteAsync(request.ItemId), Times.Once);
        }

        [Fact]
        public async Task DeleteAsync_KeyNotFound_ReturnsError()
        {
            // Arrange
            var request = new DeleteKeyRequest { ItemId = "non-existent" };

            _keyRepositoryMock.Setup(r => r.GetByIdAsync(request.ItemId))
                .ReturnsAsync((Key)null);

            // Act
            var result = await _service.DeleteAsysnc(request);

            // Assert
            result.Should().NotBeNull();
            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("ItemId");
            _keyRepositoryMock.Verify(r => r.DeleteAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task GetKeysAsync_ReturnsQueryResponse()
        {
            // Arrange
            var request = new GetKeysRequest {  };
            var response = new GetKeysQueryResponse
            {
                Keys = new List<Key>(),
                TotalCount = 0
            };

            _keyRepositoryMock.Setup(r => r.GetAllKeysAsync(request))
                .ReturnsAsync(response);

            // Act
            var result = await _service.GetKeysAsync(request);

            // Assert
            result.Should().NotBeNull();
            _keyRepositoryMock.Verify(r => r.GetAllKeysAsync(request), Times.Once);
        }

        [Fact]
        public async Task GetKeysAsync_WithResourceSearchFilters_PassesFiltersToRepository()
        {
            // Arrange
            var request = new GetKeysRequest
            {
                
                ResourceSearchFilters = new[]
                {
                    new ResourceSearchFilter { Culture = "en", SearchText = "hello" },
                    new ResourceSearchFilter { Culture = "fr", SearchText = "bonjour" }
                }
            };
            var response = new GetKeysQueryResponse
            {
                Keys = new List<Key>
                {
                    new Key
                    {
                        KeyName = "GREETING",
                        Resources = new[]
                        {
                            new Resource { Culture = "en", Value = "Hello World" },
                            new Resource { Culture = "fr", Value = "Bonjour le monde" }
                        }
                    }
                },
                TotalCount = 1
            };

            _keyRepositoryMock.Setup(r => r.GetAllKeysAsync(request))
                .ReturnsAsync(response);

            // Act
            var result = await _service.GetKeysAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.Keys.Should().HaveCount(1);
            result.TotalCount.Should().Be(1);
            _keyRepositoryMock.Verify(r => r.GetAllKeysAsync(It.Is<GetKeysRequest>(
                q => q.ResourceSearchFilters != null && q.ResourceSearchFilters.Length == 2)), Times.Once);
        }

        [Fact]
        public async Task GetKeysAsync_WithKeySearchTextAndResourceSearchFilters_PassesBothToRepository()
        {
            // Arrange
            var request = new GetKeysRequest
            {
                
                KeySearchText = "GREET",
                ResourceSearchFilters = new[]
                {
                    new ResourceSearchFilter { Culture = "en", SearchText = "hello" }
                }
            };
            var response = new GetKeysQueryResponse
            {
                Keys = new List<Key>(),
                TotalCount = 0
            };

            _keyRepositoryMock.Setup(r => r.GetAllKeysAsync(request))
                .ReturnsAsync(response);

            // Act
            var result = await _service.GetKeysAsync(request);

            // Assert
            result.Should().NotBeNull();
            _keyRepositoryMock.Verify(r => r.GetAllKeysAsync(It.Is<GetKeysRequest>(
                q => q.KeySearchText == "GREET" 
                    && q.ResourceSearchFilters != null 
                    && q.ResourceSearchFilters.Length == 1
                    && q.ResourceSearchFilters[0].Culture == "en"
                    && q.ResourceSearchFilters[0].SearchText == "hello")), Times.Once);
        }

        [Fact]
        public async Task GetKeysAsync_WithNullResourceSearchFilters_PassesNullToRepository()
        {
            // Arrange
            var request = new GetKeysRequest
            {
                
                ResourceSearchFilters = null
            };
            var response = new GetKeysQueryResponse
            {
                Keys = new List<Key>(),
                TotalCount = 0
            };

            _keyRepositoryMock.Setup(r => r.GetAllKeysAsync(request))
                .ReturnsAsync(response);

            // Act
            var result = await _service.GetKeysAsync(request);

            // Assert
            result.Should().NotBeNull();
            _keyRepositoryMock.Verify(r => r.GetAllKeysAsync(It.Is<GetKeysRequest>(
                q => q.ResourceSearchFilters == null)), Times.Once);
        }

        [Fact]
        public async Task GetKeysAsync_WithLastUpdateDateRange_PassesRangeToRepository()
        {
            // Arrange
            var request = new GetKeysRequest
            {
               
                LastUpdateDateRange = new DateRange
                {
                    StartDate = new DateTime(2025, 1, 1),
                    EndDate = new DateTime(2025, 12, 31)
                }
            };
            var response = new GetKeysQueryResponse
            {
                Keys = new List<Key>(),
                TotalCount = 0
            };

            _keyRepositoryMock.Setup(r => r.GetAllKeysAsync(request))
                .ReturnsAsync(response);

            // Act
            var result = await _service.GetKeysAsync(request);

            // Assert
            result.Should().NotBeNull();
            _keyRepositoryMock.Verify(r => r.GetAllKeysAsync(It.Is<GetKeysRequest>(
                q => q.LastUpdateDateRange != null
                    && q.LastUpdateDateRange.StartDate == new DateTime(2025, 1, 1)
                    && q.LastUpdateDateRange.EndDate == new DateTime(2025, 12, 31))), Times.Once);
        }

        [Fact]
        public async Task GetKeysAsync_WithBothDateRanges_PassesBothToRepository()
        {
            // Arrange
            var request = new GetKeysRequest
            {
                
                CreateDateRange = new DateRange
                {
                    StartDate = new DateTime(2024, 1, 1),
                    EndDate = new DateTime(2024, 12, 31)
                },
                LastUpdateDateRange = new DateRange
                {
                    StartDate = new DateTime(2025, 1, 1),
                    EndDate = new DateTime(2025, 6, 30)
                }
            };
            var response = new GetKeysQueryResponse
            {
                Keys = new List<Key>(),
                TotalCount = 0
            };

            _keyRepositoryMock.Setup(r => r.GetAllKeysAsync(request))
                .ReturnsAsync(response);

            // Act
            var result = await _service.GetKeysAsync(request);

            // Assert
            result.Should().NotBeNull();
            _keyRepositoryMock.Verify(r => r.GetAllKeysAsync(It.Is<GetKeysRequest>(
                q => q.CreateDateRange != null && q.LastUpdateDateRange != null)), Times.Once);
        }

        [Fact]
        public async Task GetKeyTimelineAsync_ReturnsTimelineResponse()
        {
            // Arrange
            var request = new GetKeyTimelineRequest { };
            var response = new GetKeyTimelineQueryResponse
            {
                Timelines = new List<KeyTimeline>(),
                TotalCount = 0
            };

            _keyTimelineRepositoryMock.Setup(r => r.GetKeyTimelineAsync(request))
                .ReturnsAsync(response);

            // Act
            var result = await _service.GetKeyTimelineAsync(request);

            // Assert
            result.Should().NotBeNull();
            _keyTimelineRepositoryMock.Verify(r => r.GetKeyTimelineAsync(request), Times.Once);
        }

        #region GetLanguageFileGenerationHistoryAsync Tests

        [Fact]
        public async Task GetLanguageFileGenerationHistoryAsync_WithValidRequest_ReturnsExpectedResponse()
        {
            // Arrange
            var request = new GetLanguageFileGenerationHistoryRequest
            {
                
                PageNumber = 0,
                PageSize = 10
            };

            var expectedResponse = new GetLanguageFileGenerationHistoryResponse
            {
                TotalCount = 3,
                Items = new List<LanguageFileGenerationHistory>
                {
                    new LanguageFileGenerationHistory
                    {
                        ItemId = "history-1",
                        CreateDate = DateTime.UtcNow,
                        Version = 1,
                        ModuleId = "module-1",
                        ProjectKey = "test-project"
                    },
                    new LanguageFileGenerationHistory
                    {
                        ItemId = "history-2",
                        CreateDate = DateTime.UtcNow.AddHours(-1),
                        Version = 2,
                        ModuleId = "module-2",
                        ProjectKey = "test-project"
                    },
                    new LanguageFileGenerationHistory
                    {
                        ItemId = "history-3",
                        CreateDate = DateTime.UtcNow.AddHours(-2),
                        Version = 3,
                        ModuleId = null,
                        ProjectKey = "test-project"
                    }
                }
            };

            _languageFileGenerationHistoryRepositoryMock.Setup(r => r.GetPaginatedAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _service.GetLanguageFileGenerationHistoryAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.TotalCount.Should().Be(3);
            result.Items.Should().HaveCount(3);
            result.Items[0].ItemId.Should().Be("history-1");
            result.Items[0].Version.Should().Be(1);
            result.Items[1].ModuleId.Should().Be("module-2");
            result.Items[2].ModuleId.Should().BeNull();
            _languageFileGenerationHistoryRepositoryMock.Verify(r => r.GetPaginatedAsync(request), Times.Once);
        }

        [Fact]
        public async Task GetLanguageFileGenerationHistoryAsync_WithEmptyHistory_ReturnsEmptyResponse()
        {
            // Arrange
            var request = new GetLanguageFileGenerationHistoryRequest
            {
                
                PageNumber = 0,
                PageSize = 10
            };

            var expectedResponse = new GetLanguageFileGenerationHistoryResponse
            {
                TotalCount = 0,
                Items = new List<LanguageFileGenerationHistory>()
            };

            _languageFileGenerationHistoryRepositoryMock.Setup(r => r.GetPaginatedAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _service.GetLanguageFileGenerationHistoryAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.TotalCount.Should().Be(0);
            result.Items.Should().BeEmpty();
            _languageFileGenerationHistoryRepositoryMock.Verify(r => r.GetPaginatedAsync(request), Times.Once);
        }

        [Fact]
        public async Task GetLanguageFileGenerationHistoryAsync_WithPagination_ReturnsCorrectPage()
        {
            // Arrange
            var request = new GetLanguageFileGenerationHistoryRequest
            {
               
                PageNumber = 2,
                PageSize = 5
            };

            var expectedResponse = new GetLanguageFileGenerationHistoryResponse
            {
                TotalCount = 20,
                Items = new List<LanguageFileGenerationHistory>
                {
                    new LanguageFileGenerationHistory
                    {
                        ItemId = "history-11",
                        CreateDate = DateTime.UtcNow.AddDays(-11),
                        Version = 11,
                        ModuleId = "module-1",
                        ProjectKey = "test-project"
                    }
                }
            };

            _languageFileGenerationHistoryRepositoryMock.Setup(r => r.GetPaginatedAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _service.GetLanguageFileGenerationHistoryAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.TotalCount.Should().Be(20);
            result.Items.Should().HaveCount(1);
            _languageFileGenerationHistoryRepositoryMock.Verify(r => r.GetPaginatedAsync(request), Times.Once);
        }

        [Fact]
        public async Task GetLanguageFileGenerationHistoryAsync_WithCustomPageSize_ReturnsCorrectNumberOfItems()
        {
            // Arrange
            var request = new GetLanguageFileGenerationHistoryRequest
            {
               
                PageNumber = 0,
                PageSize = 25
            };

            var items = new List<LanguageFileGenerationHistory>();
            for (int i = 0; i < 25; i++)
            {
                items.Add(new LanguageFileGenerationHistory
                {
                    ItemId = $"history-{i}",
                    CreateDate = DateTime.UtcNow.AddHours(-i),
                    Version = i + 1,
                    ModuleId = $"module-{i % 3}",
                    ProjectKey = "test-project"
                });
            }

            var expectedResponse = new GetLanguageFileGenerationHistoryResponse
            {
                TotalCount = 100,
                Items = items
            };

            _languageFileGenerationHistoryRepositoryMock.Setup(r => r.GetPaginatedAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _service.GetLanguageFileGenerationHistoryAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.TotalCount.Should().Be(100);
            result.Items.Should().HaveCount(25);
            _languageFileGenerationHistoryRepositoryMock.Verify(r => r.GetPaginatedAsync(request), Times.Once);
        }

        [Fact]
        public async Task GetLanguageFileGenerationHistoryAsync_CallsRepositoryWithSameRequest()
        {
            // Arrange
            var request = new GetLanguageFileGenerationHistoryRequest
            {
                
                PageNumber = 1,
                PageSize = 15
            };

            var expectedResponse = new GetLanguageFileGenerationHistoryResponse
            {
                TotalCount = 0,
                Items = new List<LanguageFileGenerationHistory>()
            };

            _languageFileGenerationHistoryRepositoryMock.Setup(r => r.GetPaginatedAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _service.GetLanguageFileGenerationHistoryAsync(request);

            // Assert
            result.Should().NotBeNull();
            _languageFileGenerationHistoryRepositoryMock.Verify(
                r => r.GetPaginatedAsync(It.Is<GetLanguageFileGenerationHistoryRequest>(
                    req => 
                         req.PageNumber == request.PageNumber 
                        && req.PageSize == request.PageSize
                )), 
                Times.Once
            );
        }

        #endregion

        #region GetKeysByKeyNamesAsync Tests

        [Fact]
        public async Task GetKeysByKeyNamesAsync_ValidKeyNames_ReturnsMatchingKeys()
        {
            // Arrange
            var keyNames = new[] { "welcome.message", "login.title" };
            var expectedKeys = new List<Key>
            {
                new KeyModel { KeyName = "welcome.message", ModuleId = "auth-module", Resources = new[] { new Resource { Culture = "en-US", Value = "Welcome" } } },
                new KeyModel { KeyName = "login.title", ModuleId = "auth-module", Resources = new[] { new Resource { Culture = "en-US", Value = "Login" } } }
            };

            _keyRepositoryMock
                .Setup(r => r.GetKeysByKeyNamesAsync(keyNames, null))
                .ReturnsAsync(expectedKeys);

            var request = new GetKeysByKeyNamesRequest { KeyNames = keyNames };

            // Act
            var result = await _service.GetKeysByKeyNamesAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.Keys.Should().HaveCount(2);
            result.Keys[0].KeyName.Should().Be("welcome.message");
            result.Keys[1].KeyName.Should().Be("login.title");
            result.ErrorMessage.Should().BeNull();
            _keyRepositoryMock.Verify(r => r.GetKeysByKeyNamesAsync(keyNames, null), Times.Once);
        }

        [Fact]
        public async Task GetKeysByKeyNamesAsync_EmptyKeyNames_ReturnsErrorMessage()
        {
            // Arrange
            var request = new GetKeysByKeyNamesRequest { KeyNames = Array.Empty<string>() };

            // Act
            var result = await _service.GetKeysByKeyNamesAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.Keys.Should().BeEmpty();
            result.ErrorMessage.Should().Be("KeyNames must not be empty.");
            _keyRepositoryMock.Verify(r => r.GetKeysByKeyNamesAsync(It.IsAny<string[]>(), It.IsAny<string?>()), Times.Never);
        }

        [Fact]
        public async Task GetKeysByKeyNamesAsync_NullKeyNames_ReturnsErrorMessage()
        {
            // Arrange
            var request = new GetKeysByKeyNamesRequest { KeyNames = null };

            // Act
            var result = await _service.GetKeysByKeyNamesAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.Keys.Should().BeEmpty();
            result.ErrorMessage.Should().Be("KeyNames must not be empty.");
            _keyRepositoryMock.Verify(r => r.GetKeysByKeyNamesAsync(It.IsAny<string[]>(), It.IsAny<string?>()), Times.Never);
        }

        [Fact]
        public async Task GetKeysByKeyNamesAsync_RepositoryThrowsException_ReturnsErrorMessage()
        {
            // Arrange
            var keyNames = new[] { "some.key" };
            _keyRepositoryMock
                .Setup(r => r.GetKeysByKeyNamesAsync(keyNames, null))
                .ThrowsAsync(new Exception("Database connection failed"));

            var request = new GetKeysByKeyNamesRequest { KeyNames = keyNames };

            // Act
            var result = await _service.GetKeysByKeyNamesAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.Keys.Should().BeEmpty();
            result.ErrorMessage.Should().Be("An error occurred while retrieving keys.");
        }

        [Fact]
        public async Task GetKeysByKeyNamesAsync_WithModuleId_PassesModuleIdToRepository()
        {
            // Arrange
            var keyNames = new[] { "welcome.message" };
            var expectedKeys = new List<Key>
            {
                new KeyModel { KeyName = "welcome.message", ModuleId = "auth-module", Resources = new[] { new Resource { Culture = "en-US", Value = "Welcome" } } }
            };

            _keyRepositoryMock
                .Setup(r => r.GetKeysByKeyNamesAsync(keyNames, "auth-module"))
                .ReturnsAsync(expectedKeys);

            var request = new GetKeysByKeyNamesRequest { KeyNames = keyNames, ModuleId = "auth-module" };

            // Act
            var result = await _service.GetKeysByKeyNamesAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.Keys.Should().HaveCount(1);
            result.Keys[0].ModuleId.Should().Be("auth-module");
            result.ErrorMessage.Should().BeNull();
            _keyRepositoryMock.Verify(r => r.GetKeysByKeyNamesAsync(keyNames, "auth-module"), Times.Once);
        }

        #endregion

        #region HasResourceChanges Tests

        [Fact]
        public void HasResourceChanges_NoPreviousPublishEntry_ReturnsTrue()
        {
            var currentKey = new BlocksLanguageKey
            {
                ItemId = "key-1",
                Resources = new[] { new Resource { Culture = "en-US", Value = "Hello" } }
            };
            var previousTimelines = new Dictionary<string, KeyTimeline>();

            var result = KeyManagementService.HasResourceChanges(currentKey, previousTimelines);

            result.Should().BeTrue();
        }

        [Fact]
        public void HasResourceChanges_PreviousEntryHasNullCurrentData_ReturnsTrue()
        {
            var currentKey = new BlocksLanguageKey
            {
                ItemId = "key-1",
                Resources = new[] { new Resource { Culture = "en-US", Value = "Hello" } }
            };
            var previousTimelines = new Dictionary<string, KeyTimeline>
            {
                ["key-1"] = new KeyTimeline { CurrentData = null }
            };

            var result = KeyManagementService.HasResourceChanges(currentKey, previousTimelines);

            result.Should().BeTrue();
        }

        [Fact]
        public void HasResourceChanges_IdenticalResources_ReturnsFalse()
        {
            var currentKey = new BlocksLanguageKey
            {
                ItemId = "key-1",
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = "Hello" },
                    new Resource { Culture = "fr-FR", Value = "Bonjour" }
                }
            };
            var previousTimelines = new Dictionary<string, KeyTimeline>
            {
                ["key-1"] = new KeyTimeline
                {
                    CurrentData = new BlocksLanguageKey
                    {
                        ItemId = "key-1",
                        Resources = new[]
                        {
                            new Resource { Culture = "en-US", Value = "Hello" },
                            new Resource { Culture = "fr-FR", Value = "Bonjour" }
                        }
                    }
                }
            };

            var result = KeyManagementService.HasResourceChanges(currentKey, previousTimelines);

            result.Should().BeFalse();
        }

        [Fact]
        public void HasResourceChanges_ResourceValueChanged_ReturnsTrue()
        {
            var currentKey = new BlocksLanguageKey
            {
                ItemId = "key-1",
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = "Hello World" },
                    new Resource { Culture = "fr-FR", Value = "Bonjour" }
                }
            };
            var previousTimelines = new Dictionary<string, KeyTimeline>
            {
                ["key-1"] = new KeyTimeline
                {
                    CurrentData = new BlocksLanguageKey
                    {
                        ItemId = "key-1",
                        Resources = new[]
                        {
                            new Resource { Culture = "en-US", Value = "Hello" },
                            new Resource { Culture = "fr-FR", Value = "Bonjour" }
                        }
                    }
                }
            };

            var result = KeyManagementService.HasResourceChanges(currentKey, previousTimelines);

            result.Should().BeTrue();
        }

        [Fact]
        public void HasResourceChanges_NewCultureAdded_ReturnsTrue()
        {
            var currentKey = new BlocksLanguageKey
            {
                ItemId = "key-1",
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = "Hello" },
                    new Resource { Culture = "fr-FR", Value = "Bonjour" },
                    new Resource { Culture = "de-DE", Value = "Hallo" }
                }
            };
            var previousTimelines = new Dictionary<string, KeyTimeline>
            {
                ["key-1"] = new KeyTimeline
                {
                    CurrentData = new BlocksLanguageKey
                    {
                        ItemId = "key-1",
                        Resources = new[]
                        {
                            new Resource { Culture = "en-US", Value = "Hello" },
                            new Resource { Culture = "fr-FR", Value = "Bonjour" }
                        }
                    }
                }
            };

            var result = KeyManagementService.HasResourceChanges(currentKey, previousTimelines);

            result.Should().BeTrue();
        }

        [Fact]
        public void HasResourceChanges_CultureRemoved_ReturnsTrue()
        {
            var currentKey = new BlocksLanguageKey
            {
                ItemId = "key-1",
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = "Hello" }
                }
            };
            var previousTimelines = new Dictionary<string, KeyTimeline>
            {
                ["key-1"] = new KeyTimeline
                {
                    CurrentData = new BlocksLanguageKey
                    {
                        ItemId = "key-1",
                        Resources = new[]
                        {
                            new Resource { Culture = "en-US", Value = "Hello" },
                            new Resource { Culture = "fr-FR", Value = "Bonjour" }
                        }
                    }
                }
            };

            var result = KeyManagementService.HasResourceChanges(currentKey, previousTimelines);

            result.Should().BeTrue();
        }

        [Fact]
        public void HasResourceChanges_BothResourcesNull_ReturnsFalse()
        {
            var currentKey = new BlocksLanguageKey
            {
                ItemId = "key-1",
                Resources = null
            };
            var previousTimelines = new Dictionary<string, KeyTimeline>
            {
                ["key-1"] = new KeyTimeline
                {
                    CurrentData = new BlocksLanguageKey
                    {
                        ItemId = "key-1",
                        Resources = null
                    }
                }
            };

            var result = KeyManagementService.HasResourceChanges(currentKey, previousTimelines);

            result.Should().BeFalse();
        }

        [Fact]
        public void HasResourceChanges_CurrentResourcesNull_PreviousNotNull_ReturnsTrue()
        {
            var currentKey = new BlocksLanguageKey
            {
                ItemId = "key-1",
                Resources = null
            };
            var previousTimelines = new Dictionary<string, KeyTimeline>
            {
                ["key-1"] = new KeyTimeline
                {
                    CurrentData = new BlocksLanguageKey
                    {
                        ItemId = "key-1",
                        Resources = new[] { new Resource { Culture = "en-US", Value = "Hello" } }
                    }
                }
            };

            var result = KeyManagementService.HasResourceChanges(currentKey, previousTimelines);

            result.Should().BeTrue();
        }

        [Fact]
        public void HasResourceChanges_PreviousResourcesNull_CurrentNotNull_ReturnsTrue()
        {
            var currentKey = new BlocksLanguageKey
            {
                ItemId = "key-1",
                Resources = new[] { new Resource { Culture = "en-US", Value = "Hello" } }
            };
            var previousTimelines = new Dictionary<string, KeyTimeline>
            {
                ["key-1"] = new KeyTimeline
                {
                    CurrentData = new BlocksLanguageKey
                    {
                        ItemId = "key-1",
                        Resources = null
                    }
                }
            };

            var result = KeyManagementService.HasResourceChanges(currentKey, previousTimelines);

            result.Should().BeTrue();
        }

        [Fact]
        public void HasResourceChanges_EmptyResources_BothEmpty_ReturnsFalse()
        {
            var currentKey = new BlocksLanguageKey
            {
                ItemId = "key-1",
                Resources = Array.Empty<Resource>()
            };
            var previousTimelines = new Dictionary<string, KeyTimeline>
            {
                ["key-1"] = new KeyTimeline
                {
                    CurrentData = new BlocksLanguageKey
                    {
                        ItemId = "key-1",
                        Resources = Array.Empty<Resource>()
                    }
                }
            };

            var result = KeyManagementService.HasResourceChanges(currentKey, previousTimelines);

            result.Should().BeFalse();
        }

        [Fact]
        public void HasResourceChanges_NullValues_TreatedAsEmpty_ReturnsFalse()
        {
            var currentKey = new BlocksLanguageKey
            {
                ItemId = "key-1",
                Resources = new[] { new Resource { Culture = "en-US", Value = null } }
            };
            var previousTimelines = new Dictionary<string, KeyTimeline>
            {
                ["key-1"] = new KeyTimeline
                {
                    CurrentData = new BlocksLanguageKey
                    {
                        ItemId = "key-1",
                        Resources = new[] { new Resource { Culture = "en-US", Value = null } }
                    }
                }
            };

            var result = KeyManagementService.HasResourceChanges(currentKey, previousTimelines);

            result.Should().BeFalse();
        }

        #endregion

        #region GenerateAsync Publish Timeline Tests

        [Fact]
        public async Task GenerateAsync_PublishedKeys_SkipsUnchangedKeys()
        {
            // Arrange
            var languages = new List<Language>
            {
                new Language { LanguageCode = "en-US", LanguageName = "English" }
            };
            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "module-id", ModuleName = "auth" }
            };
            var keys = new List<Key>
            {
                new KeyModel
                {
                    ItemId = "key-1",
                    KeyName = "welcome",
                    ModuleId = "module-id",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Hello" } }
                }
            };

            _languageManagementServiceMock.Setup(m => m.GetLanguagesAsync()).ReturnsAsync(languages);
            _moduleManagementServiceMock.Setup(m => m.GetModulesAsync(It.IsAny<string>())).ReturnsAsync(modules);
            _keyRepositoryMock.Setup(r => r.GetAllKeysByModuleAsync("module-id")).ReturnsAsync(keys);
            _keyRepositoryMock.Setup(r => r.DeleteOldUilmFiles(It.IsAny<List<UilmFile>>())).ReturnsAsync(0L);
            _keyRepositoryMock.Setup(r => r.SaveNewUilmFiles(It.IsAny<List<UilmFile>>())).ReturnsAsync(true);
            _notificationServiceMock.Setup(n => n.NotifyExtensionEvent(true, It.IsAny<string>())).ReturnsAsync(true);

            // Previous publish has identical resources — should be skipped
            var previousTimelines = new Dictionary<string, KeyTimeline>
            {
                ["key-1"] = new KeyTimeline
                {
                    CurrentData = new BlocksLanguageKey
                    {
                        ItemId = "key-1",
                        Resources = new[] { new Resource { Culture = "en-US", Value = "Hello" } }
                    }
                }
            };
            _keyTimelineRepositoryMock.Setup(r => r.GetLatestPublishTimelinesAsync(
                It.IsAny<List<string>>(), It.IsAny<string>())).ReturnsAsync(previousTimelines);

            var command = new GenerateUilmFilesEvent { ModuleId = "module-id", ProjectKey = "proj" };

            // Act
            var result = await _service.GenerateAsync(command);

            // Assert
            result.Should().BeTrue();
            // A single no-change publish timeline entry should be created
            _keyTimelineRepositoryMock.Verify(r => r.BulkSaveKeyTimelinesAsync(
                It.Is<List<KeyTimeline>>(t =>
                    t.Count == 1 &&
                    t[0].EntityId == null &&
                    t[0].CurrentData == null &&
                    t[0].PreviousData == null &&
                    t[0].LogFrom == LogFromConstants.Published),
                "proj"), Times.Once);
        }

        [Fact]
        public async Task GenerateAsync_PublishedKeys_CreatesTimelineForChangedKeys()
        {
            // Arrange
            var languages = new List<Language>
            {
                new Language { LanguageCode = "en-US", LanguageName = "English" }
            };
            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "module-id", ModuleName = "auth" }
            };
            var keys = new List<Key>
            {
                new KeyModel
                {
                    ItemId = "key-1",
                    KeyName = "welcome",
                    ModuleId = "module-id",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Hello World" } }
                }
            };

            _languageManagementServiceMock.Setup(m => m.GetLanguagesAsync()).ReturnsAsync(languages);
            _moduleManagementServiceMock.Setup(m => m.GetModulesAsync(It.IsAny<string>())).ReturnsAsync(modules);
            _keyRepositoryMock.Setup(r => r.GetAllKeysByModuleAsync("module-id")).ReturnsAsync(keys);
            _keyRepositoryMock.Setup(r => r.DeleteOldUilmFiles(It.IsAny<List<UilmFile>>())).ReturnsAsync(0L);
            _keyRepositoryMock.Setup(r => r.SaveNewUilmFiles(It.IsAny<List<UilmFile>>())).ReturnsAsync(true);
            _notificationServiceMock.Setup(n => n.NotifyExtensionEvent(true, It.IsAny<string>())).ReturnsAsync(true);

            // Previous publish has different value — should create timeline
            var previousTimelines = new Dictionary<string, KeyTimeline>
            {
                ["key-1"] = new KeyTimeline
                {
                    CurrentData = new BlocksLanguageKey
                    {
                        ItemId = "key-1",
                        Resources = new[] { new Resource { Culture = "en-US", Value = "Hello" } }
                    }
                }
            };
            _keyTimelineRepositoryMock.Setup(r => r.GetLatestPublishTimelinesAsync(
                It.IsAny<List<string>>(), It.IsAny<string>())).ReturnsAsync(previousTimelines);

            var command = new GenerateUilmFilesEvent { ModuleId = "module-id", ProjectKey = "proj" };

            // Act
            var result = await _service.GenerateAsync(command);

            // Assert
            result.Should().BeTrue();
            _keyTimelineRepositoryMock.Verify(r => r.BulkSaveKeyTimelinesAsync(
                It.Is<List<KeyTimeline>>(t =>
                    t.Count == 1 &&
                    t[0].EntityId == "key-1" &&
                    t[0].PreviousData != null &&
                    t[0].PreviousData.ItemId == "key-1" &&
                    t[0].LogFrom == LogFromConstants.Published),
                "proj"), Times.Once);
        }

        [Fact]
        public async Task GenerateAsync_NewKeys_CreatesTimelineWithNoPreviousData()
        {
            // Arrange
            var languages = new List<Language>
            {
                new Language { LanguageCode = "en-US", LanguageName = "English" }
            };
            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "module-id", ModuleName = "auth" }
            };
            var keys = new List<Key>
            {
                new KeyModel
                {
                    ItemId = "key-new",
                    KeyName = "new.key",
                    ModuleId = "module-id",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "New" } }
                }
            };

            _languageManagementServiceMock.Setup(m => m.GetLanguagesAsync()).ReturnsAsync(languages);
            _moduleManagementServiceMock.Setup(m => m.GetModulesAsync(It.IsAny<string>())).ReturnsAsync(modules);
            _keyRepositoryMock.Setup(r => r.GetAllKeysByModuleAsync("module-id")).ReturnsAsync(keys);
            _keyRepositoryMock.Setup(r => r.DeleteOldUilmFiles(It.IsAny<List<UilmFile>>())).ReturnsAsync(0L);
            _keyRepositoryMock.Setup(r => r.SaveNewUilmFiles(It.IsAny<List<UilmFile>>())).ReturnsAsync(true);
            _notificationServiceMock.Setup(n => n.NotifyExtensionEvent(true, It.IsAny<string>())).ReturnsAsync(true);

            // No previous publish entries
            _keyTimelineRepositoryMock.Setup(r => r.GetLatestPublishTimelinesAsync(
                It.IsAny<List<string>>(), It.IsAny<string>())).ReturnsAsync(new Dictionary<string, KeyTimeline>());

            var command = new GenerateUilmFilesEvent { ModuleId = "module-id", ProjectKey = "proj" };

            // Act
            var result = await _service.GenerateAsync(command);

            // Assert
            result.Should().BeTrue();
            _keyTimelineRepositoryMock.Verify(r => r.BulkSaveKeyTimelinesAsync(
                It.Is<List<KeyTimeline>>(t =>
                    t.Count == 1 &&
                    t[0].EntityId == "key-new" &&
                    t[0].PreviousData == null &&
                    t[0].LogFrom == LogFromConstants.Published),
                "proj"), Times.Once);
        }

        [Fact]
        public async Task GenerateAsync_MixedChangedAndUnchangedKeys_OnlyCreatesTimelineForChanged()
        {
            // Arrange
            var languages = new List<Language>
            {
                new Language { LanguageCode = "en-US", LanguageName = "English" }
            };
            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "module-id", ModuleName = "auth" }
            };
            var keys = new List<Key>
            {
                new KeyModel
                {
                    ItemId = "key-changed",
                    KeyName = "changed.key",
                    ModuleId = "module-id",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Updated" } }
                },
                new KeyModel
                {
                    ItemId = "key-unchanged",
                    KeyName = "unchanged.key",
                    ModuleId = "module-id",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Same" } }
                }
            };

            _languageManagementServiceMock.Setup(m => m.GetLanguagesAsync()).ReturnsAsync(languages);
            _moduleManagementServiceMock.Setup(m => m.GetModulesAsync(It.IsAny<string>())).ReturnsAsync(modules);
            _keyRepositoryMock.Setup(r => r.GetAllKeysByModuleAsync("module-id")).ReturnsAsync(keys);
            _keyRepositoryMock.Setup(r => r.DeleteOldUilmFiles(It.IsAny<List<UilmFile>>())).ReturnsAsync(0L);
            _keyRepositoryMock.Setup(r => r.SaveNewUilmFiles(It.IsAny<List<UilmFile>>())).ReturnsAsync(true);
            _notificationServiceMock.Setup(n => n.NotifyExtensionEvent(true, It.IsAny<string>())).ReturnsAsync(true);

            var previousTimelines = new Dictionary<string, KeyTimeline>
            {
                ["key-changed"] = new KeyTimeline
                {
                    CurrentData = new BlocksLanguageKey
                    {
                        ItemId = "key-changed",
                        Resources = new[] { new Resource { Culture = "en-US", Value = "Original" } }
                    }
                },
                ["key-unchanged"] = new KeyTimeline
                {
                    CurrentData = new BlocksLanguageKey
                    {
                        ItemId = "key-unchanged",
                        Resources = new[] { new Resource { Culture = "en-US", Value = "Same" } }
                    }
                }
            };
            _keyTimelineRepositoryMock.Setup(r => r.GetLatestPublishTimelinesAsync(
                It.IsAny<List<string>>(), It.IsAny<string>())).ReturnsAsync(previousTimelines);

            var command = new GenerateUilmFilesEvent { ModuleId = "module-id", ProjectKey = "proj" };

            // Act
            var result = await _service.GenerateAsync(command);

            // Assert
            result.Should().BeTrue();
            _keyTimelineRepositoryMock.Verify(r => r.BulkSaveKeyTimelinesAsync(
                It.Is<List<KeyTimeline>>(t =>
                    t.Count == 1 &&
                    t[0].EntityId == "key-changed"),
                "proj"), Times.Once);
        }

        [Fact]
        public async Task CreateNoChangePublishTimelineEntryAsync_CreatesEntryWithNullData()
        {
            // Arrange
            _keyTimelineRepositoryMock.Setup(r => r.BulkSaveKeyTimelinesAsync(
                It.IsAny<List<KeyTimeline>>(), It.IsAny<string>())).Returns(Task.CompletedTask);

            // Act
            await _service.CreateNoChangePublishTimelineEntryAsync(LogFromConstants.Published, "proj");

            // Assert
            _keyTimelineRepositoryMock.Verify(r => r.BulkSaveKeyTimelinesAsync(
                It.Is<List<KeyTimeline>>(t =>
                    t.Count == 1 &&
                    t[0].EntityId == null &&
                    t[0].CurrentData == null &&
                    t[0].PreviousData == null &&
                    t[0].LogFrom == LogFromConstants.Published &&
                    t[0].OperationId != null),
                "proj"), Times.Once);
        }

        [Fact]
        public async Task CreateNoChangePublishTimelineEntryAsync_DoesNotThrowOnError()
        {
            // Arrange
            _keyTimelineRepositoryMock.Setup(r => r.BulkSaveKeyTimelinesAsync(
                It.IsAny<List<KeyTimeline>>(), It.IsAny<string>()))
                .ThrowsAsync(new Exception("DB error"));

            // Act & Assert — should not throw
            await _service.Invoking(s => s.CreateNoChangePublishTimelineEntryAsync(LogFromConstants.Published, "proj"))
                .Should().NotThrowAsync();
        }

        [Fact]
        public async Task GenerateAsync_AllUnchangedKeys_CreatesSingleNoChangeEntry()
        {
            // Arrange — two keys, both unchanged
            var languages = new List<Language>
            {
                new Language { LanguageCode = "en-US", LanguageName = "English" }
            };
            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "module-id", ModuleName = "auth" }
            };
            var keys = new List<Key>
            {
                new KeyModel
                {
                    ItemId = "key-1",
                    KeyName = "key.one",
                    ModuleId = "module-id",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "Hello" } }
                },
                new KeyModel
                {
                    ItemId = "key-2",
                    KeyName = "key.two",
                    ModuleId = "module-id",
                    Resources = new[] { new Resource { Culture = "en-US", Value = "World" } }
                }
            };

            _languageManagementServiceMock.Setup(m => m.GetLanguagesAsync()).ReturnsAsync(languages);
            _moduleManagementServiceMock.Setup(m => m.GetModulesAsync(It.IsAny<string>())).ReturnsAsync(modules);
            _keyRepositoryMock.Setup(r => r.GetAllKeysByModuleAsync("module-id")).ReturnsAsync(keys);
            _keyRepositoryMock.Setup(r => r.DeleteOldUilmFiles(It.IsAny<List<UilmFile>>())).ReturnsAsync(0L);
            _keyRepositoryMock.Setup(r => r.SaveNewUilmFiles(It.IsAny<List<UilmFile>>())).ReturnsAsync(true);
            _notificationServiceMock.Setup(n => n.NotifyExtensionEvent(true, It.IsAny<string>())).ReturnsAsync(true);

            var previousTimelines = new Dictionary<string, KeyTimeline>
            {
                ["key-1"] = new KeyTimeline
                {
                    CurrentData = new BlocksLanguageKey
                    {
                        ItemId = "key-1",
                        Resources = new[] { new Resource { Culture = "en-US", Value = "Hello" } }
                    }
                },
                ["key-2"] = new KeyTimeline
                {
                    CurrentData = new BlocksLanguageKey
                    {
                        ItemId = "key-2",
                        Resources = new[] { new Resource { Culture = "en-US", Value = "World" } }
                    }
                }
            };
            _keyTimelineRepositoryMock.Setup(r => r.GetLatestPublishTimelinesAsync(
                It.IsAny<List<string>>(), It.IsAny<string>())).ReturnsAsync(previousTimelines);

            var command = new GenerateUilmFilesEvent { ModuleId = "module-id", ProjectKey = "proj" };

            // Act
            var result = await _service.GenerateAsync(command);

            // Assert
            result.Should().BeTrue();
            // Should create exactly one no-change entry
            _keyTimelineRepositoryMock.Verify(r => r.BulkSaveKeyTimelinesAsync(
                It.Is<List<KeyTimeline>>(t =>
                    t.Count == 1 &&
                    t[0].EntityId == null &&
                    t[0].CurrentData == null &&
                    t[0].PreviousData == null &&
                    t[0].LogFrom == LogFromConstants.Published),
                "proj"), Times.Once);
        }

        #endregion
    }
}

