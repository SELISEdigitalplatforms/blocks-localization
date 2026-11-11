using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared;
using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using StorageDriver;
using Xunit;
using KeyModel = Eurolm.DomainService.Services.Key;
using GlossaryModel = Eurolm.DomainService.Services.Glossary;

namespace XUnitTest
{
    /// <summary>SPEC6 H14: suggestions come from the matcher over every glossary, not the 100 newest.</summary>
    public class GetSuggestedGlossariesTests
    {
        private readonly Mock<IKeyRepository> _keyRepositoryMock = new();
        private readonly Mock<IGlossaryRepository> _glossaryRepositoryMock = new();
        private readonly Mock<IServiceProvider> _serviceProvider = new();
        private readonly List<BlocksGlossary> _glossaries = new();
        private readonly KeyManagementService _service;

        public GetSuggestedGlossariesTests()
        {
            XUnitTest.Shared.TestBlocksContext.Set("suggest-tenant");
            _keyRepositoryMock.Setup(r => r.GetLanguageSettingAsync(It.IsAny<string>()))
                .ReturnsAsync(new BlocksLanguage { LanguageCode = "en-US", IsDefault = true });
            _glossaryRepositoryMock.Setup(r => r.GetByIdsAsync(It.IsAny<List<string>>()))
                .ReturnsAsync((List<string> ids) => _glossaries
                    .Where(g => ids.Contains(g.ItemId))
                    .Select(g => new GlossaryModel { ItemId = g.ItemId, Name = g.Name })
                    .Reverse() // the repository does not promise request order
                    .ToList());

            var terminology = new GlossaryTerminologyService(
                new GlossaryMatcherCache(_ => Task.FromResult(_glossaries.ToList())),
                _keyRepositoryMock.Object,
                new ConfigurationBuilder().Build());
            _serviceProvider.Setup(x => x.GetService(typeof(IGlossaryTerminologyService))).Returns(terminology);

            _service = NewService(_serviceProvider.Object);
        }

        private KeyManagementService NewService(IServiceProvider serviceProvider)
        {
            var storageDriverServiceMock = new Mock<IStorageDriverService>();
            return new KeyManagementService(
                _keyRepositoryMock.Object,
                Mock.Of<IKeyTimelineRepository>(),
                Mock.Of<ILanguageFileGenerationHistoryRepository>(),
                new Mock<IValidator<KeyModel>>().Object,
                new Mock<ILogger<KeyManagementService>>().Object,
                Mock.Of<ILanguageManagementService>(),
                Mock.Of<IModuleManagementService>(),
                Mock.Of<IMessageClient>(),
                Mock.Of<IAssistantService>(),
                storageDriverServiceMock.Object,
                new StorageHelper(new Mock<ILogger<StorageHelper>>().Object, storageDriverServiceMock.Object),
                serviceProvider,
                Mock.Of<INotificationService>(),
                _glossaryRepositoryMock.Object);
        }

        private void AddGlossary(string id, string name, bool isGlobal = false, List<string>? moduleIds = null,
            GlossaryStatus status = GlossaryStatus.Approved) =>
            _glossaries.Add(new BlocksGlossary { ItemId = id, Name = name, IsGlobal = isGlobal, ModuleIds = moduleIds, Status = status, SchemaVersion = 2 });

        private void SetupKey(string text, List<string>? glossaryIds = null) =>
            _keyRepositoryMock.Setup(r => r.GetByIdAsync("key-1")).ReturnsAsync(new KeyModel
            {
                ItemId = "key-1",
                KeyName = "welcome.message",
                ModuleId = "mod-1",
                GlossaryIds = glossaryIds,
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = text },
                    new Resource { Culture = "fr-FR", Value = "Bienvenue sur le portail SDK" }
                }
            });

        [Fact]
        public async Task Returns_glossaries_found_in_the_default_language_text_in_text_order()
        {
            AddGlossary("g1", "API");
            AddGlossary("g2", "SDK");
            AddGlossary("g3", "portal");
            SetupKey("Welcome to the API portal");

            var result = await _service.GetSuggestedGlossariesAsync(new GetSuggestedGlossariesRequest { ItemId = "key-1" });

            // SDK appears only in the French value, which is not the source text.
            result.SuggestedGlossaries.Select(g => g.ItemId).Should().Equal("g1", "g3");
        }

        [Fact]
        public async Task Excludes_tagged_global_module_linked_and_deprecated_glossaries()
        {
            AddGlossary("tagged", "Workspace");
            AddGlossary("global", "Portal", isGlobal: true);
            AddGlossary("module", "Customer", moduleIds: new List<string> { "mod-1" });
            AddGlossary("deprecated", "Billing", status: GlossaryStatus.Deprecated);
            AddGlossary("other", "Dashboard");
            SetupKey("Workspace Portal Customer Billing Dashboard", glossaryIds: new List<string> { "tagged" });

            var result = await _service.GetSuggestedGlossariesAsync(new GetSuggestedGlossariesRequest { ItemId = "key-1" });

            result.SuggestedGlossaries.Select(g => g.ItemId).Should().Equal("other");
        }

        [Fact]
        public async Task Considers_every_glossary_not_only_the_100_newest()
        {
            for (var i = 0; i < 150; i++) AddGlossary($"filler-{i}", $"Filler{i}");
            AddGlossary("oldest", "Workspace");
            SetupKey("Open your Workspace");

            var result = await _service.GetSuggestedGlossariesAsync(new GetSuggestedGlossariesRequest { ItemId = "key-1" });

            result.SuggestedGlossaries.Select(g => g.ItemId).Should().Equal("oldest");
        }

        [Fact]
        public async Task Matches_whole_words_only_and_ignores_case()
        {
            AddGlossary("g1", "api");
            AddGlossary("g2", "port");
            SetupKey("Welcome to the API portal");

            var result = await _service.GetSuggestedGlossariesAsync(new GetSuggestedGlossariesRequest { ItemId = "key-1" });

            result.SuggestedGlossaries.Select(g => g.ItemId).Should().Equal("g1");
        }

        [Theory]
        [InlineData(0, 5)]
        [InlineData(3, 3)]
        [InlineData(50, 20)]
        public async Task Defaults_MaxResults_to_5_and_caps_it_at_20(int maxResults, int expected)
        {
            var words = Enumerable.Range(0, 30).Select(i => $"Term{i}").ToList();
            for (var i = 0; i < words.Count; i++) AddGlossary($"g{i}", words[i]);
            SetupKey(string.Join(" ", words));

            var result = await _service.GetSuggestedGlossariesAsync(new GetSuggestedGlossariesRequest { ItemId = "key-1", MaxResults = maxResults });

            result.SuggestedGlossaries.Should().HaveCount(expected);
        }

        [Fact]
        public async Task KeyNotFound_ReturnsEmptyList()
        {
            AddGlossary("g1", "API");
            _keyRepositoryMock.Setup(r => r.GetByIdAsync("missing")).ReturnsAsync((KeyModel)null!);

            var result = await _service.GetSuggestedGlossariesAsync(new GetSuggestedGlossariesRequest { ItemId = "missing" });

            result.SuggestedGlossaries.Should().BeEmpty();
            _glossaryRepositoryMock.Verify(r => r.GetByIdsAsync(It.IsAny<List<string>>()), Times.Never);
        }

        [Fact]
        public async Task NoMatches_ReturnsEmptyList_WithoutLoadingGlossaries()
        {
            AddGlossary("g1", "SDK");
            SetupKey("Hello world");

            var result = await _service.GetSuggestedGlossariesAsync(new GetSuggestedGlossariesRequest { ItemId = "key-1" });

            result.SuggestedGlossaries.Should().BeEmpty();
            _glossaryRepositoryMock.Verify(r => r.GetByIdsAsync(It.IsAny<List<string>>()), Times.Never);
        }

        [Fact]
        public async Task EmptyResources_ReturnsEmptyList()
        {
            AddGlossary("g1", "API");
            _keyRepositoryMock.Setup(r => r.GetByIdAsync("key-1"))
                .ReturnsAsync(new KeyModel { ItemId = "key-1", Resources = Array.Empty<Resource>() });

            var result = await _service.GetSuggestedGlossariesAsync(new GetSuggestedGlossariesRequest { ItemId = "key-1" });

            result.SuggestedGlossaries.Should().BeEmpty();
        }

        [Fact]
        public async Task Without_a_terminology_service_returns_an_empty_list()
        {
            AddGlossary("g1", "API");
            SetupKey("Welcome to the API portal");

            var result = await NewService(Mock.Of<IServiceProvider>())
                .GetSuggestedGlossariesAsync(new GetSuggestedGlossariesRequest { ItemId = "key-1" });

            result.SuggestedGlossaries.Should().BeEmpty();
        }
    }
}
