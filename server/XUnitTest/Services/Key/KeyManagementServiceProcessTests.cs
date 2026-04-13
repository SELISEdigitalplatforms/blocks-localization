using Blocks.Genesis;
using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Services.HelperService;
using BlocksTemplate.DomainService.Shared;
using BlocksTemplate.DomainService.Shared.Events;
using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.Logging;
using Moq;
using StorageDriver;
using System.Linq;
using Xunit;
using KeyModel = BlocksTemplate.DomainService.Services.Key;

namespace BlocksTemplate.XUnitTest
{
    public class KeyManagementServiceProcessTests
    {
        private readonly Mock<IKeyRepository> _keyRepositoryMock;
        private readonly Mock<IKeyTimelineRepository> _keyTimelineRepositoryMock;
        private readonly Mock<ILanguageFileGenerationHistoryRepository> _languageFileGenerationHistoryRepositoryMock;
        private readonly Mock<IAssistantService> _assistantServiceMock;
        private readonly Mock<ILanguageManagementService> _languageServiceMock;
        private readonly Mock<IModuleManagementService> _moduleServiceMock;
        private readonly KeyManagementService _service;

        public KeyManagementServiceProcessTests()
        {
            _keyRepositoryMock = new Mock<IKeyRepository>();
            _keyTimelineRepositoryMock = new Mock<IKeyTimelineRepository>();
            _languageFileGenerationHistoryRepositoryMock = new Mock<ILanguageFileGenerationHistoryRepository>();
            var validatorMock = new Mock<IValidator<KeyModel>>();
            var loggerMock = new Mock<ILogger<KeyManagementService>>();
            _languageServiceMock = new Mock<ILanguageManagementService>();
            _moduleServiceMock = new Mock<IModuleManagementService>();
            var messageClientMock = new Mock<IMessageClient>();
            _assistantServiceMock = new Mock<IAssistantService>();
            var storageDriverServiceMock = new Mock<IStorageDriverService>();
            var notificationServiceMock = new Mock<INotificationService>();
            var storageLogger = new Mock<ILogger<StorageHelper>>();
            var storageHelper = new StorageHelper(storageLogger.Object, storageDriverServiceMock.Object);

            _assistantServiceMock.Setup(a => a.SuggestTranslation(It.IsAny<SuggestLanguageRequest>()))
                .ReturnsAsync("Bonjour");

            _service = new KeyManagementService(
                _keyRepositoryMock.Object,
                _keyTimelineRepositoryMock.Object,
                _languageFileGenerationHistoryRepositoryMock.Object,
                validatorMock.Object,
                loggerMock.Object,
                _languageServiceMock.Object,
                _moduleServiceMock.Object,
                messageClientMock.Object,
                _assistantServiceMock.Object,
                storageDriverServiceMock.Object,
                storageHelper,
                Mock.Of<IServiceProvider>(),
                notificationServiceMock.Object
            );
        }

        [Fact]
        public async Task ProcessResourceKey_AddsMissingTranslationAndReturnsEntry()
        {
            var request = new TranslateAllEvent
            {
                DefaultLanguage = "en-US",
                ProjectKey = "proj"
            };

            var languages = new List<Language>
            {
                new Language { LanguageCode = "en-US", LanguageName = "English" },
                new Language { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var resourceKey = new BlocksLanguageKey
            {
                ItemId = "key-1",
                ModuleId = "module-1",
                KeyName = "welcome",
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = "Hello" },
                    new Resource { Culture = "fr-FR", Value = "" }
                }
            };

            var list = new List<BlocksLanguageKey>();

            await _service.ProcessResourceKey(request, resourceKey, languages, list);

            list.Should().Contain(resourceKey);
            resourceKey.Resources.Any(r => r.Culture == "fr-FR" && r.Value == "Bonjour").Should().BeTrue();
        }

        [Fact]
        public async Task ProcessChangeAll_AddsTranslationsForEachKey()
        {
            var request = new TranslateAllEvent
            {
                DefaultLanguage = "en-US",
                ProjectKey = "proj"
            };

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
                    ModuleId = "module-1",
                    KeyName = "welcome",
                    Resources = new[]
                    {
                        new Resource { Culture = "en-US", Value = "Hello" },
                        new Resource { Culture = "fr-FR", Value = "" }
                    }
                },
                new BlocksLanguageKey
                {
                    ItemId = "key-2",
                    ModuleId = "module-1",
                    KeyName = "bye",
                    Resources = new[]
                    {
                        new Resource { Culture = "en-US", Value = "Bye" },
                        new Resource { Culture = "fr-FR", Value = "" }
                    }
                }
            };

            _languageServiceMock.Setup(l => l.GetLanguagesAsync())
                .ReturnsAsync(languages);

            var result = await _service.ProcessChangeAll(request, resourceKeys.AsQueryable(), languages);

            result.Should().HaveCount(2);
            result.All(k => k.Resources.Any(r => r.Culture == "fr-FR" && !string.IsNullOrEmpty(r.Value))).Should().BeTrue();
        }

        [Fact]
        public async Task UpdateResourceKey_CreatesTimelines()
        {
            var resourceKey = new BlocksLanguageKey
            {
                ItemId = "id-1",
                ModuleId = "module-1",
                KeyName = "welcome",
                Resources = new[] { new Resource { Culture = "en-US", Value = "Hello" } }
            };

            _keyRepositoryMock.Setup(r => r.UpdateUilmResourceKeysForChangeAll(It.IsAny<List<BlocksLanguageKey>>()))
                .ReturnsAsync(1);
            _keyTimelineRepositoryMock.Setup(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()))
                .Returns(Task.CompletedTask);

            await _service.UpdateResourceKey(new List<BlocksLanguageKey> { resourceKey }, new TranslateAllEvent(), new Dictionary<string, BlocksLanguageKey>());

            _keyTimelineRepositoryMock.Verify(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()), Times.Once);
        }

        [Fact]
        public async Task ChangeAll_ReturnsTrueWhenNoResources()
        {
            _keyRepositoryMock.Setup(r => r.GetUilmResourceKeysWithPage(It.IsAny<int>(), It.IsAny<int>()))
                .ReturnsAsync(new List<BlocksLanguageKey>().AsQueryable());
            _languageServiceMock.Setup(l => l.GetLanguagesAsync())
                .ReturnsAsync(new List<Language>());

            var result = await _service.ChangeAll(new TranslateAllEvent { DefaultLanguage = "en-US" });

            result.Should().BeTrue();
        }

        [Fact]
        public void ConstructQuery_BuildsRequestWithLanguageNames()
        {
            var request = new TranslateAllEvent
            {
                DefaultLanguage = "en-US",
                ProjectKey = "proj"
            };

            var languageSetting = new List<Language>
            {
                new Language { LanguageCode = "en-US", LanguageName = "English" },
                new Language { LanguageCode = "fr-FR", LanguageName = "French" }
            };

            var resourceKey = new BlocksLanguageKey
            {
                KeyName = "welcome",
                Context = "button"
            };

            var defaultResource = new Resource { Culture = "en-US", Value = "Hello" };
            var missingResource = new Resource { Culture = "fr-FR" };

            var query = KeyManagementService.ConstructQuery(request, resourceKey, defaultResource, missingResource, "French", languageSetting);

            query.DestinationLanguage.Should().Be("French");
            query.CurrentLanguage.Should().Be("English");
            query.ElementDetailContext.Should().Be("button");
            query.SourceText.Should().Be("Hello");
        }
    }
}

