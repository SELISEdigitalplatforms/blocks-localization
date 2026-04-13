using Blocks.Genesis;
using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Services.HelperService;
using BlocksTemplate.DomainService.Shared;
using BlocksTemplate.DomainService.Shared.Events;
using FluentAssertions;
using System.Linq;
using FluentValidation;
using Microsoft.Extensions.Logging;
using Moq;
using StorageDriver;
using Xunit;
using KeyModel = BlocksTemplate.DomainService.Services.Key;

namespace BlocksTemplate.XUnitTest
{
    public class KeyManagementServiceUtilityTests
    {
        private readonly KeyManagementService _service;

        public KeyManagementServiceUtilityTests()
        {
            var keyRepositoryMock = new Mock<IKeyRepository>();
            var keyTimelineRepositoryMock = new Mock<IKeyTimelineRepository>();
            var languageFileGenerationHistoryRepositoryMock = new Mock<ILanguageFileGenerationHistoryRepository>();
            var validatorMock = new Mock<IValidator<KeyModel>>();
            var loggerMock = new Mock<ILogger<KeyManagementService>>();
            var languageServiceMock = new Mock<ILanguageManagementService>();
            var moduleServiceMock = new Mock<IModuleManagementService>();
            var messageClientMock = new Mock<IMessageClient>();
            var assistantServiceMock = new Mock<IAssistantService>();
            var storageDriverServiceMock = new Mock<IStorageDriverService>();
            var notificationServiceMock = new Mock<INotificationService>();
            var storageLogger = new Mock<ILogger<StorageHelper>>();
            var storageHelper = new StorageHelper(storageLogger.Object, storageDriverServiceMock.Object);

            _service = new KeyManagementService(
                keyRepositoryMock.Object,
                keyTimelineRepositoryMock.Object,
                languageFileGenerationHistoryRepositoryMock.Object,
                validatorMock.Object,
                loggerMock.Object,
                languageServiceMock.Object,
                moduleServiceMock.Object,
                messageClientMock.Object,
                assistantServiceMock.Object,
                storageDriverServiceMock.Object,
                storageHelper,
                Mock.Of<IServiceProvider>(),
                notificationServiceMock.Object
            );
        }

        [Fact]
        public void ShouldSkipResource_ReturnsTrue_WhenDefaultResourceMissing()
        {
            var shouldSkip = KeyManagementService.ShouldSkipResource(default(Resource)!, "key", new TranslateAllEvent { DefaultLanguage = "en-US" });
            shouldSkip.Should().BeTrue();
        }

        [Fact]
        public void ShouldSkipResource_ReturnsFalse_WhenDefaultResourcePresent()
        {
            var defaultResource = new Resource { Culture = "en-US", Value = "Hello" };
            var shouldSkip = KeyManagementService.ShouldSkipResource(defaultResource, "key", new TranslateAllEvent { DefaultLanguage = "en-US" });
            shouldSkip.Should().BeFalse();
        }

        [Fact]
        public void GetMissingResources_ReturnsEmptyWhenAllPresent()
        {
            var defaultResource = new Resource { Culture = "en-US", Value = "Hello" };
            var resources = new List<Resource>
            {
                defaultResource,
                new Resource { Culture = "fr-FR", Value = "Bonjour" }
            };

            var missing = KeyManagementService.GetMissingResources("welcome", resources, defaultResource, "en-US");
            missing.Should().BeEmpty();
        }

        [Fact]
        public void GetMissingResources_ReturnsCulturesWithEmptyValues()
        {
            var defaultResource = new Resource { Culture = "en-US", Value = "Hello" };
            var resources = new List<Resource>
            {
                defaultResource,
                new Resource { Culture = "fr-FR", Value = "" }
            };

            var missing = KeyManagementService.GetMissingResources("welcome", resources, defaultResource, "en-US");
            missing.Should().HaveCount(1);
            missing.First().Culture.Should().Be("fr-FR");
        }

        [Fact]
        public void CompareAndAddResources_AddsMissingCultures()
        {
            var missing = new List<Resource>();
            var resources = new List<Resource>
            {
                new Resource { Culture = "en-US", Value = "Hello" }
            };
            var languages = new List<Language>
            {
                new Language { LanguageCode = "en-US", LanguageName = "English" },
                new Language { LanguageCode = "de-DE", LanguageName = "German" }
            };

            _service.CompareAndAddResources(missing, resources, languages);

            missing.Should().ContainSingle(r => r.Culture == "de-DE");
        }

        [Fact]
        public void EmptyResourcesThatHasReservedKeywords_ClearsValuesAndTracksResource()
        {
            var resourceKey = new BlocksLanguageKey
            {
                ItemId = "id",
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = "KEY_MISSING" },
                    new Resource { Culture = "fr-FR", Value = "Bonjour" }
                }
            };
            var list = new List<BlocksLanguageKey>();
            var resources = resourceKey.Resources.ToList();

            KeyManagementService.EmptyResourcesThatHasReservedKeywords(list, resourceKey, resources, "en-US");

            list.Should().Contain(resourceKey);
            resources.All(r => string.IsNullOrEmpty(r.Value)).Should().BeTrue();
        }

        [Fact]
        public void HasKeywordValue_DetectsKeyword()
        {
            var resources = new List<Resource>
            {
                new Resource { Culture = "en-US", Value = "KEY_MISSING" }
            };

            KeyManagementService.HasKeywordValue(resources, "en-US").Should().BeTrue();
        }
    }
}

//test