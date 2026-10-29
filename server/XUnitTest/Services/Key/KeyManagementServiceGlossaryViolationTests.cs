using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared;
using Eurolm.DomainService.Shared.Events;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.Extensions.Logging;
using Moq;
using StorageDriver;
using Xunit;
using KeyModel = Eurolm.DomainService.Services.Key;

namespace XUnitTest.Services.Key
{
    /// <summary>SPEC6 key violations: the worker replaces one culture's entries (H9); Key/Save recomputes them with the flag on (H16) and keeps them otherwise (C27).</summary>
    public class KeyManagementServiceGlossaryViolationTests
    {
        private readonly Mock<IKeyRepository> _keyRepository = new();
        private readonly Mock<IAssistantService> _assistant = new();
        private readonly Mock<IGlossaryTerminologyService> _terminology = new();
        private readonly Mock<IServiceProvider> _serviceProvider = new();
        private readonly Mock<IValidator<KeyModel>> _validator = new();
        private readonly KeyManagementService _service;

        public KeyManagementServiceGlossaryViolationTests()
        {
            XUnitTest.Shared.TestBlocksContext.Set("violations-tenant");
            _serviceProvider.Setup(x => x.GetService(typeof(IGlossaryTerminologyService))).Returns(_terminology.Object);
            _validator.Setup(v => v.ValidateAsync(It.IsAny<KeyModel>(), default)).ReturnsAsync(new ValidationResult());
            var storageDriver = new Mock<IStorageDriverService>();

            _service = new KeyManagementService(
                _keyRepository.Object,
                new Mock<IKeyTimelineRepository>().Object,
                new Mock<ILanguageFileGenerationHistoryRepository>().Object,
                _validator.Object,
                new Mock<ILogger<KeyManagementService>>().Object,
                new Mock<ILanguageManagementService>().Object,
                new Mock<IModuleManagementService>().Object,
                new Mock<IMessageClient>().Object,
                _assistant.Object,
                storageDriver.Object,
                new StorageHelper(new Mock<ILogger<StorageHelper>>().Object, storageDriver.Object),
                _serviceProvider.Object,
                new Mock<INotificationService>().Object,
                Mock.Of<IGlossaryRepository>());
        }

        private static KeyGlossaryViolation Stored(string culture, string glossaryId) => new()
        {
            Culture = culture,
            GlossaryId = glossaryId,
            Term = "Workspace",
            Kind = GlossaryViolationKinds.MissingTranslation,
            DetectedAt = DateTime.UtcNow.AddDays(-1)
        };

        private static readonly List<Language> Languages = new()
        {
            new Language { LanguageCode = "en-US", LanguageName = "English", IsDefault = true },
            new Language { LanguageCode = "de-DE", LanguageName = "German" }
        };

        private async Task<BlocksLanguageKey> TranslateGerman(BlocksLanguageKey key, SuggestionResult result)
        {
            _assistant.Setup(a => a.SuggestTranslation(It.IsAny<SuggestLanguageRequest>())).ReturnsAsync(result);
            var resources = key.Resources.ToList();
            var english = resources.First(r => r.Culture == "en-US");
            await _service.ProcessMissingResource(new TranslateAllEvent { DefaultLanguage = "en-US" }, key, english,
                new Resource { Culture = "de-DE" }, resources, Languages);
            return key;
        }

        private static BlocksLanguageKey KeyWithViolations(params KeyGlossaryViolation[] violations) => new()
        {
            ItemId = "k1",
            KeyName = "open",
            ModuleId = "m1",
            Resources = new[] { new Resource { Culture = "en-US", Value = "Open your Workspace" }, new Resource { Culture = "de-DE", Value = "" } },
            GlossaryViolations = violations.ToList()
        };

        [Fact]
        public async Task Worker_replaces_only_the_translated_cultures_violations()
        {
            _terminology.SetupGet(t => t.IsEnforcementEnabled).Returns(true);
            var key = KeyWithViolations(Stored("de-DE", "old"), Stored("fr-FR", "kept"));

            await TranslateGerman(key, new SuggestionResult
            {
                Content = "Öffnen Sie Ihren Werkbereich",
                GlossaryViolations = { new GlossaryViolationDto { GlossaryId = "g1", Term = "Workspace", Kind = GlossaryViolationKinds.ForbiddenUsed, Found = "Werkbereich" } }
            });

            key.GlossaryViolations.Should().HaveCount(2);
            key.GlossaryViolations.Should().ContainSingle(v => v.Culture == "fr-FR" && v.GlossaryId == "kept");
            key.GlossaryViolations.Should().ContainSingle(v => v.Culture == "de-DE" && v.GlossaryId == "g1"
                && v.Kind == GlossaryViolationKinds.ForbiddenUsed && v.Found == "Werkbereich");
        }

        [Fact]
        public async Task Worker_removes_a_cultures_violations_when_the_new_translation_is_clean()
        {
            _terminology.SetupGet(t => t.IsEnforcementEnabled).Returns(true);
            var key = KeyWithViolations(Stored("de-DE", "old"));

            await TranslateGerman(key, new SuggestionResult { Content = "Öffnen Sie Ihren Arbeitsbereich" });

            key.GlossaryViolations.Should().BeEmpty();
        }

        [Fact]
        public async Task Worker_leaves_stored_violations_alone_with_the_flag_off()
        {
            _terminology.SetupGet(t => t.IsEnforcementEnabled).Returns(false);
            var stored = Stored("de-DE", "old");
            var key = KeyWithViolations(stored);

            await TranslateGerman(key, new SuggestionResult { Content = "Hallo" });

            key.GlossaryViolations.Should().ContainSingle().Which.Should().BeSameAs(stored);
            key.Resources.Should().NotBeNull();
        }

        [Fact]
        public void The_worker_query_carries_the_source_culture()
        {
            var query = KeyManagementService.ConstructQuery(new TranslateAllEvent { DefaultLanguage = "en-US" },
                KeyWithViolations(), new Resource { Culture = "en-US", Value = "Open" }, new Resource { Culture = "de-DE" }, "German", Languages);

            query.CurrentLanguageCode.Should().Be("en-US");
            query.DestinationLanguageCode.Should().Be("de-DE");
        }

        private static KeyModel Save() => new()
        {
            KeyName = "open",
            ModuleId = "m1",
            Resources = new[] { new Resource { Culture = "en-US", Value = "Open your Workspace" }, new Resource { Culture = "de-DE", Value = "Öffne Werkbereich" } }
        };

        [Fact]
        public async Task KeySave_with_the_flag_off_keeps_the_stored_violations()
        {
            _terminology.SetupGet(t => t.IsEnforcementEnabled).Returns(false);
            var stored = KeyWithViolations(Stored("de-DE", "g1"));
            BlocksLanguageKey? saved = null;
            _keyRepository.Setup(r => r.GetKeyByNameAsync("open", "m1")).ReturnsAsync(stored);
            _keyRepository.Setup(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>())).Callback<BlocksLanguageKey>(k => saved = k).Returns(Task.CompletedTask);

            await _service.SaveKeyAsync(Save());

            saved!.GlossaryViolations.Should().ContainSingle(v => v.GlossaryId == "g1");
            _terminology.Verify(t => t.ComputeKeyViolationsAsync(It.IsAny<BlocksLanguageKey>()), Times.Never);
            _assistant.Verify(a => a.SuggestTranslation(It.IsAny<SuggestLanguageRequest>()), Times.Never);
        }

        [Fact]
        public async Task KeySave_with_the_flag_on_stores_recomputed_violations_without_calling_the_AI()
        {
            _terminology.SetupGet(t => t.IsEnforcementEnabled).Returns(true);
            var recomputed = new List<KeyGlossaryViolation> { Stored("de-DE", "g-new") };
            _terminology.Setup(t => t.ComputeKeyViolationsAsync(It.IsAny<BlocksLanguageKey>())).ReturnsAsync(recomputed);
            BlocksLanguageKey? saved = null;
            _keyRepository.Setup(r => r.GetKeyByNameAsync("open", "m1")).ReturnsAsync(KeyWithViolations(Stored("de-DE", "g-old")));
            _keyRepository.Setup(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>())).Callback<BlocksLanguageKey>(k => saved = k).Returns(Task.CompletedTask);

            await _service.SaveKeyAsync(Save());

            saved!.GlossaryViolations.Should().BeSameAs(recomputed);
            _assistant.Verify(a => a.SuggestTranslation(It.IsAny<SuggestLanguageRequest>()), Times.Never);
        }

        [Fact]
        public async Task KeySave_keeps_the_stored_violations_when_the_recompute_fails()
        {
            _terminology.SetupGet(t => t.IsEnforcementEnabled).Returns(true);
            _terminology.Setup(t => t.ComputeKeyViolationsAsync(It.IsAny<BlocksLanguageKey>())).ThrowsAsync(new InvalidOperationException("db down"));
            BlocksLanguageKey? saved = null;
            _keyRepository.Setup(r => r.GetKeyByNameAsync("open", "m1")).ReturnsAsync(KeyWithViolations(Stored("de-DE", "g-old")));
            _keyRepository.Setup(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>())).Callback<BlocksLanguageKey>(k => saved = k).Returns(Task.CompletedTask);

            var result = await _service.SaveKeyAsync(Save());

            result.Success.Should().BeTrue();
            saved!.GlossaryViolations.Should().ContainSingle(v => v.GlossaryId == "g-old");
        }
    }
}
