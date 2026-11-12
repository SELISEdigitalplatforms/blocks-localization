using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared;
using Eurolm.DomainService.Shared.Events;
using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.Logging;
using Moq;
using StorageDriver;
using Xunit;
using KeyModel = Eurolm.DomainService.Services.Key;

namespace XUnitTest.Services.Key
{
    /// <summary>SPEC16 H6, C6, C9: Translate All passes each key's module description to the assistant.</summary>
    public class KeyManagementServiceSpec16Tests
    {
        private static readonly List<Language> EnFr = new()
        {
            new Language { LanguageCode = "en-US", LanguageName = "English" },
            new Language { LanguageCode = "fr-FR", LanguageName = "French" }
        };

        private readonly Mock<IModuleManagementService> _modules = new();
        private readonly Mock<IAssistantService> _assistant = new();
        private readonly List<SuggestLanguageRequest> _queries = new();
        private readonly KeyManagementService _service;

        public KeyManagementServiceSpec16Tests()
        {
            XUnitTest.Shared.TestBlocksContext.Set("spec16-keys");
            _assistant.Setup(a => a.SuggestTranslation(It.IsAny<SuggestLanguageRequest>()))
                .Callback<SuggestLanguageRequest>(q => { lock (_queries) _queries.Add(q); })
                .ReturnsAsync(new SuggestionResult { Content = "Bonjour" });
            var storageDriver = new Mock<IStorageDriverService>();
            _service = new KeyManagementService(
                new Mock<IKeyRepository>().Object,
                new Mock<IKeyTimelineRepository>().Object,
                new Mock<ILanguageFileGenerationHistoryRepository>().Object,
                new Mock<IValidator<KeyModel>>().Object,
                new Mock<ILogger<KeyManagementService>>().Object,
                new Mock<ILanguageManagementService>().Object,
                _modules.Object,
                new Mock<IMessageClient>().Object,
                _assistant.Object,
                storageDriver.Object,
                new StorageHelper(new Mock<ILogger<StorageHelper>>().Object, storageDriver.Object),
                Mock.Of<IServiceProvider>(),
                new Mock<INotificationService>().Object,
                Mock.Of<IGlossaryRepository>());
        }

        private static BlocksLanguageKey MissingFrench(string id, string moduleId) => new()
        {
            ItemId = id,
            KeyName = id,
            ModuleId = moduleId,
            Resources = new[]
            {
                new Resource { Culture = "en-US", Value = "Plan" },
                new Resource { Culture = "fr-FR", Value = "" }
            }
        };

        private static TranslateAllEvent Job() => new() { DefaultLanguage = "en-US", ProjectKey = "job-tenant" };

        [Fact]
        public async Task H6_C9_descriptions_are_read_once_per_batch_from_the_job_tenant()
        {
            _modules.Setup(m => m.GetModulesAsync("job-tenant", null)).ReturnsAsync(new List<BlocksLanguageModule>
            {
                new() { ItemId = "billing", Description = "Subscription plans." },
                new() { ItemId = "travel", Description = null }
            });
            var keys = new[] { MissingFrench("k1", "billing"), MissingFrench("k2", "billing"), MissingFrench("k3", "travel") };

            await _service.ProcessChangeAll(Job(), keys.AsQueryable(), EnFr);

            _modules.Verify(m => m.GetModulesAsync("job-tenant", null), Times.Once);
            _modules.Verify(m => m.GetModulesAsync(It.IsAny<string?>()), Times.Never);
            _queries.Where(q => q.ModuleId == "billing").Select(q => q.ElementApplicationContext)
                .Should().Equal("Subscription plans.", "Subscription plans.");
            _queries.Single(q => q.ModuleId == "travel").ElementApplicationContext.Should().BeNull();
        }

        [Fact]
        public async Task H6_a_single_module_batch_reads_only_that_module()
        {
            _modules.Setup(m => m.GetModulesAsync("job-tenant", "billing"))
                .ReturnsAsync(new List<BlocksLanguageModule> { new() { ItemId = "billing", Description = "Subscription plans." } });

            await _service.ProcessResourceKey(Job(), MissingFrench("k1", "billing"), EnFr, new List<BlocksLanguageKey>());

            _modules.Verify(m => m.GetModulesAsync("job-tenant", "billing"), Times.Once);
            _queries.Single().ElementApplicationContext.Should().Be("Subscription plans.");
        }

        [Fact]
        public async Task H6_keys_with_nothing_to_translate_read_no_modules()
        {
            var complete = MissingFrench("k1", "billing");
            complete.Resources[1].Value = "Forfait";

            await _service.ProcessResourceKey(Job(), complete, EnFr, new List<BlocksLanguageKey>());

            _modules.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task C6_a_failed_module_read_still_translates_without_context()
        {
            _modules.Setup(m => m.GetModulesAsync(It.IsAny<string>(), It.IsAny<string?>())).ThrowsAsync(new TimeoutException());
            var list = new List<BlocksLanguageKey>();

            await _service.ProcessResourceKey(Job(), MissingFrench("k1", "billing"), EnFr, list);

            _queries.Single().ElementApplicationContext.Should().BeNull();
            list.Should().ContainSingle();
        }

        [Fact]
        public void ConstructQuery_passes_the_module_description_as_application_context()
        {
            var key = MissingFrench("k1", "billing");

            var query = KeyManagementService.ConstructQuery(Job(), key, key.Resources[0], key.Resources[1], "French", EnFr, "Subscription plans.");

            query.ElementApplicationContext.Should().Be("Subscription plans.");
            query.ModuleId.Should().Be("billing");
        }
    }
}
