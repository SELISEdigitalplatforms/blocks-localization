using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared;
using Eurolm.DomainService.Shared.Utilities;
using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.Logging;
using Moq;
using StorageDriver;
using Xunit;
using KeyModel = Eurolm.DomainService.Services.Key;
using GlossaryModel = Eurolm.DomainService.Services.Glossary;

namespace XUnitTest
{
    public class GetSuggestedGlossariesTests
    {
        private readonly Mock<IKeyRepository> _keyRepositoryMock;
        private readonly Mock<IGlossaryRepository> _glossaryRepositoryMock;
        private readonly KeyManagementService _service;

        public GetSuggestedGlossariesTests()
        {
            _keyRepositoryMock = new Mock<IKeyRepository>();
            _glossaryRepositoryMock = new Mock<IGlossaryRepository>();

            var loggerMock = new Mock<ILogger<KeyManagementService>>();
            var validatorMock = new Mock<IValidator<KeyModel>>();
            var storageDriverServiceMock = new Mock<IStorageDriverService>();
            var storageLoggerMock = new Mock<ILogger<StorageHelper>>();
            var storageHelper = new StorageHelper(storageLoggerMock.Object, storageDriverServiceMock.Object);

            _service = new KeyManagementService(
                _keyRepositoryMock.Object,
                Mock.Of<IKeyTimelineRepository>(),
                Mock.Of<ILanguageFileGenerationHistoryRepository>(),
                validatorMock.Object,
                loggerMock.Object,
                Mock.Of<ILanguageManagementService>(),
                Mock.Of<IModuleManagementService>(),
                Mock.Of<IMessageClient>(),
                Mock.Of<IAssistantService>(),
                storageDriverServiceMock.Object,
                storageHelper,
                Mock.Of<IServiceProvider>(),
                Mock.Of<INotificationService>(),
                _glossaryRepositoryMock.Object
            );
        }

        [Fact]
        public async Task GetSuggestedGlossariesAsync_WithMatchingName_ReturnsSuggestions()
        {
            // Arrange
            var key = new KeyModel
            {
                ItemId = "key-1",
                KeyName = "welcome.message",
                ModuleId = "mod-1",
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = "Welcome to the API portal" },
                    new Resource { Culture = "fr-FR", Value = "Bienvenue sur le portail API" }
                }
            };

            var glossaries = new GetGlossariesResponse
            {
                Items = new List<GlossaryModel>
                {
                    new GlossaryModel { ItemId = "g1", Name = "API", Context = "Application Programming Interface" },
                    new GlossaryModel { ItemId = "g2", Name = "SDK", Context = "Software Development Kit" },
                    new GlossaryModel { ItemId = "g3", Name = "portal", Context = "Web portal" }
                },
                TotalCount = 3
            };

            _keyRepositoryMock.Setup(r => r.GetByIdAsync("key-1")).ReturnsAsync(key);
            _glossaryRepositoryMock.Setup(r => r.GetAllAsync(It.IsAny<GetGlossariesRequest>())).ReturnsAsync(glossaries);

            var request = new GetSuggestedGlossariesRequest { ItemId = "key-1", MaxResults = 5 };

            // Act
            var result = await _service.GetSuggestedGlossariesAsync(request);

            // Assert
            result.SuggestedGlossaries.Should().HaveCount(2);
            result.SuggestedGlossaries.Should().Contain(g => g.Name == "API");
            result.SuggestedGlossaries.Should().Contain(g => g.Name == "portal");
            result.SuggestedGlossaries.Should().NotContain(g => g.Name == "SDK");
        }






        //    // Assert
        //    result.SuggestedGlossaries.Should().HaveCount(2);
        //    result.SuggestedGlossaries.Should().Contain(g => g.Name == "SDK");
        //}

        [Fact]
        public async Task GetSuggestedGlossariesAsync_KeyNotFound_ReturnsEmptyList()
        {
            // Arrange
            _keyRepositoryMock.Setup(r => r.GetByIdAsync("nonexistent")).ReturnsAsync((KeyModel)null);

            var request = new GetSuggestedGlossariesRequest { ItemId = "nonexistent", MaxResults = 5 };

            // Act
            var result = await _service.GetSuggestedGlossariesAsync(request);

            // Assert
            result.SuggestedGlossaries.Should().BeEmpty();
        }

        [Fact]
        public async Task GetSuggestedGlossariesAsync_NoGlossaries_ReturnsEmptyList()
        {
            // Arrange
            var key = new KeyModel
            {
                ItemId = "key-3",
                Resources = new[] { new Resource { Culture = "en-US", Value = "Hello" } }
            };

            _keyRepositoryMock.Setup(r => r.GetByIdAsync("key-3")).ReturnsAsync(key);
            _glossaryRepositoryMock.Setup(r => r.GetAllAsync(It.IsAny<GetGlossariesRequest>()))
                .ReturnsAsync(new GetGlossariesResponse { Items = new List<GlossaryModel>(), TotalCount = 0 });

            var request = new GetSuggestedGlossariesRequest { ItemId = "key-3", MaxResults = 5 };

            // Act
            var result = await _service.GetSuggestedGlossariesAsync(request);

            // Assert
            result.SuggestedGlossaries.Should().BeEmpty();
        }

        [Fact]
        public async Task GetSuggestedGlossariesAsync_RespectsMaxResults()
        {
            // Arrange
            var key = new KeyModel
            {
                ItemId = "key-4",
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = "API SDK URL CLI REST" }
                }
            };

            var glossaries = new GetGlossariesResponse
            {
                Items = new List<GlossaryModel>
                {
                    new GlossaryModel { ItemId = "g1", Name = "API" },
                    new GlossaryModel { ItemId = "g2", Name = "SDK" },
                    new GlossaryModel { ItemId = "g3", Name = "URL" },
                    new GlossaryModel { ItemId = "g4", Name = "CLI" },
                    new GlossaryModel { ItemId = "g5", Name = "REST" }
                },
                TotalCount = 5
            };

            _keyRepositoryMock.Setup(r => r.GetByIdAsync("key-4")).ReturnsAsync(key);
            _glossaryRepositoryMock.Setup(r => r.GetAllAsync(It.IsAny<GetGlossariesRequest>())).ReturnsAsync(glossaries);

            var request = new GetSuggestedGlossariesRequest { ItemId = "key-4", MaxResults = 3 };

            // Act
            var result = await _service.GetSuggestedGlossariesAsync(request);

            // Assert
            result.SuggestedGlossaries.Should().HaveCount(3);
        }

        [Fact]
        public async Task GetSuggestedGlossariesAsync_NoMatches_ReturnsEmptyList()
        {
            // Arrange
            var key = new KeyModel
            {
                ItemId = "key-5",
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = "Hello World" }
                }
            };

            var glossaries = new GetGlossariesResponse
            {
                Items = new List<GlossaryModel>
                {
                    new GlossaryModel { ItemId = "g1", Name = "API", Context = "endpoint" },
                    new GlossaryModel { ItemId = "g2", Name = "SDK", Context = "library" }
                },
                TotalCount = 2
            };

            _keyRepositoryMock.Setup(r => r.GetByIdAsync("key-5")).ReturnsAsync(key);
            _glossaryRepositoryMock.Setup(r => r.GetAllAsync(It.IsAny<GetGlossariesRequest>())).ReturnsAsync(glossaries);

            var request = new GetSuggestedGlossariesRequest { ItemId = "key-5", MaxResults = 5 };

            // Act
            var result = await _service.GetSuggestedGlossariesAsync(request);

            // Assert
            result.SuggestedGlossaries.Should().BeEmpty();
        }

        [Fact]
        public async Task GetSuggestedGlossariesAsync_CaseInsensitiveMatch_ReturnsSuggestions()
        {
            // Arrange
            var key = new KeyModel
            {
                ItemId = "key-6",
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = "use the api to fetch data" }
                }
            };

            var glossaries = new GetGlossariesResponse
            {
                Items = new List<GlossaryModel>
                {
                    new GlossaryModel { ItemId = "g1", Name = "API" }
                },
                TotalCount = 1
            };

            _keyRepositoryMock.Setup(r => r.GetByIdAsync("key-6")).ReturnsAsync(key);
            _glossaryRepositoryMock.Setup(r => r.GetAllAsync(It.IsAny<GetGlossariesRequest>())).ReturnsAsync(glossaries);

            var request = new GetSuggestedGlossariesRequest { ItemId = "key-6", MaxResults = 5 };

            // Act
            var result = await _service.GetSuggestedGlossariesAsync(request);

            // Assert
            result.SuggestedGlossaries.Should().HaveCount(1);
            result.SuggestedGlossaries[0].Name.Should().Be("API");
        }

        [Fact]
        public async Task GetSuggestedGlossariesAsync_EmptyResources_ReturnsEmptyList()
        {
            // Arrange
            var key = new KeyModel
            {
                ItemId = "key-7",
                Resources = Array.Empty<Resource>()
            };

            _keyRepositoryMock.Setup(r => r.GetByIdAsync("key-7")).ReturnsAsync(key);

            var request = new GetSuggestedGlossariesRequest { ItemId = "key-7", MaxResults = 5 };

            // Act
            var result = await _service.GetSuggestedGlossariesAsync(request);

            // Assert
            result.SuggestedGlossaries.Should().BeEmpty();
            _glossaryRepositoryMock.Verify(r => r.GetAllAsync(It.IsAny<GetGlossariesRequest>()), Times.Never);
        }
    }
}
