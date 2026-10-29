using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using GlossaryModel = Eurolm.DomainService.Services.Glossary;

namespace XUnitTest.Services.Glossary
{
    public class GlossaryStructuredSaveTests
    {
        private const string Prefix = "@@glossary-meta:v1@@";

        private readonly Mock<IGlossaryRepository> _repository = new();
        private readonly Mock<IKeyRepository> _keyRepository = new();
        private readonly Mock<IValidator<GlossaryModel>> _validator = new();
        private readonly Mock<IGlossaryMatcherCache> _matcherCache = new();
        private readonly GlossaryManagementService _service;
        private BlocksGlossary? _written;

        public GlossaryStructuredSaveTests()
        {
            XUnitTest.Shared.TestBlocksContext.Set("tenant-a");
            _validator.Setup(v => v.ValidateAsync(It.IsAny<GlossaryModel>(), default))
                .ReturnsAsync(new FluentValidation.Results.ValidationResult());
            _repository.Setup(r => r.InsertAsync(It.IsAny<BlocksGlossary>()))
                .Callback<BlocksGlossary>(g => _written = g).Returns(Task.CompletedTask);
            _repository.Setup(r => r.ReplaceAsync(It.IsAny<BlocksGlossary>(), It.IsAny<int?>()))
                .Callback<BlocksGlossary, int?>((g, _) => _written = g).ReturnsAsync(true);

            _service = new GlossaryManagementService(_validator.Object, new Mock<ILogger<GlossaryManagementService>>().Object,
                _repository.Object, _keyRepository.Object, _matcherCache.Object);
        }

        private void SetupStored(BlocksGlossary stored) =>
            _repository.Setup(r => r.GetStoredByIdAsync(stored.ItemId)).ReturnsAsync(stored);

        private static BlocksGlossary Structured(string id = "g1") => new()
        {
            ItemId = id,
            Name = "Workspace",
            SchemaVersion = 2,
            Rule = GlossaryRule.Translate,
            CaseSensitive = true,
            Variants = new List<string> { "workspaces" },
            Translations = new List<GlossaryTranslation> { new() { Language = "de-DE", Value = "Arbeitsbereich", ForbiddenValues = new() { "Werkbereich" } } },
            Status = GlossaryStatus.Draft,
            ModuleIds = new List<string> { "m1" },
            Version = 4
        };

        [Fact]
        public async Task Create_without_status_stores_Approved_and_the_normalized_name()
        {
            await _service.SaveGlossaryAsync(new GlossaryModel { Name = "  Café Workspace " });

            _written!.Status.Should().Be(GlossaryStatus.Approved);
            _written.NormalizedName.Should().Be("café workspace");
            _written.SchemaVersion.Should().Be(0);
            _matcherCache.Verify(c => c.Invalidate("tenant-a"), Times.Once);
        }

        [Fact]
        public async Task Create_with_structured_fields_stores_them_as_schema_2()
        {
            await _service.SaveGlossaryAsync(new GlossaryModel
            {
                Name = "Workspace",
                Rule = "forbidden",
                Variants = new List<string> { " workspaces " },
                Status = "draft"
            });

            _written!.SchemaVersion.Should().Be(2);
            _written.Rule.Should().Be(GlossaryRule.Forbidden);
            _written.Variants.Should().Equal("workspaces");
            _written.Status.Should().Be(GlossaryStatus.Draft);
            _written.CaseSensitive.Should().BeFalse();
            _written.Translations.Should().BeEmpty();
        }

        [Fact]
        public async Task Old_client_save_keeps_every_structured_field_and_replaces_the_existing_ones()
        {
            SetupStored(Structured());

            // The CLI and extension send only the existing fields.
            await _service.SaveGlossaryAsync(new GlossaryModel
            {
                ItemId = "g1",
                Name = "Workspace",
                Context = "new definition",
                AdditionalNote = "plain note",
                IsGlobal = false,
                ModuleIds = new List<string>()
            });

            _written!.Rule.Should().Be(GlossaryRule.Translate);
            _written.CaseSensitive.Should().BeTrue();
            _written.Variants.Should().Equal("workspaces");
            _written.Translations.Should().ContainSingle(t => t.Value == "Arbeitsbereich");
            _written.Status.Should().Be(GlossaryStatus.Draft);
            _written.SchemaVersion.Should().Be(2);
            // Existing fields keep replace semantics: moduleIds: [] clears the modules.
            _written.ModuleIds.Should().BeEmpty();
            _written.Context.Should().Be("new definition");
            _written.Version.Should().Be(5);
        }

        [Fact]
        public async Task Empty_list_clears_and_value_sets_while_null_keeps()
        {
            SetupStored(Structured());

            await _service.SaveGlossaryAsync(new GlossaryModel
            {
                ItemId = "g1",
                Name = "Workspace",
                Variants = new List<string>(),
                Status = "approved"
            });

            _written!.Variants.Should().BeEmpty();
            _written.Status.Should().Be(GlossaryStatus.Approved);
            _written.Translations.Should().ContainSingle();
            _written.CaseSensitive.Should().BeTrue();
        }

        [Fact]
        public async Task First_structured_save_of_a_legacy_document_fills_omitted_fields_from_its_JSON()
        {
            SetupStored(new BlocksGlossary
            {
                ItemId = "g1",
                Name = "Workspace",
                AdditionalNote = Prefix + "{\"rule\":\"translate\",\"caseSensitive\":true,\"variants\":[\"workspaces\"],\"translations\":{\"de-DE\":\"Arbeitsbereich\"}}",
                Version = 2
            });

            await _service.SaveGlossaryAsync(new GlossaryModel { ItemId = "g1", Name = "Workspace", Status = "draft" });

            _written!.SchemaVersion.Should().Be(2);
            _written.Status.Should().Be(GlossaryStatus.Draft);
            _written.CaseSensitive.Should().BeTrue();
            _written.Variants.Should().Equal("workspaces");
            _written.Translations.Should().ContainSingle(t => t.Language == "de-DE" && t.Value == "Arbeitsbereich");
        }

        [Fact]
        public async Task Track_A_save_copies_the_JSON_terminology_and_keeps_status_and_schema()
        {
            // Example 9: API-created Draft term edited in the Track A sheet.
            SetupStored(Structured());

            await _service.SaveGlossaryAsync(new GlossaryModel
            {
                ItemId = "g1",
                Name = "Workspace",
                AdditionalNote = Prefix + "{\"rule\":\"keep\",\"variants\":[\"ws\"],\"translations\":{\"de-DE\":\"Arbeitsbereich\",\"fr-FR\":\"État\"}}"
            });

            _written!.Rule.Should().Be(GlossaryRule.Keep);
            _written.CaseSensitive.Should().BeFalse();
            _written.Variants.Should().Equal("ws");
            _written.Translations!.Select(t => t.Language).Should().Equal("de-DE", "fr-FR");
            _written.Status.Should().Be(GlossaryStatus.Draft);
            _written.SchemaVersion.Should().Be(2);
        }

        [Theory]
        [InlineData("plain note")]
        [InlineData(Prefix + "{broken")]
        [InlineData("@@glossary-meta:v2@@{}")]
        public async Task Save_without_structured_fields_or_v1_JSON_changes_no_structured_field(string note)
        {
            SetupStored(Structured());

            await _service.SaveGlossaryAsync(new GlossaryModel { ItemId = "g1", Name = "Workspace", AdditionalNote = note });

            _written!.Rule.Should().Be(GlossaryRule.Translate);
            _written.Variants.Should().Equal("workspaces");
            _written.CaseSensitive.Should().BeTrue();
        }

        [Fact]
        public async Task Update_recomputes_the_normalized_name_and_invalidates_the_matcher()
        {
            SetupStored(Structured());

            await _service.SaveGlossaryAsync(new GlossaryModel { ItemId = "g1", Name = "WORKSPACE " });

            _written!.NormalizedName.Should().Be("workspace");
            _matcherCache.Verify(c => c.Invalidate("tenant-a"), Times.Once);
        }

        [Fact]
        public async Task Delete_invalidates_the_matcher()
        {
            _repository.Setup(r => r.GetByIdAsync("g1")).ReturnsAsync(new GlossaryModel { ItemId = "g1", Name = "x" });

            await _service.DeleteGlossaryAsync(new DeleteGlossaryRequest { ItemId = "g1" });

            _matcherCache.Verify(c => c.Invalidate("tenant-a"), Times.Once);
        }

        [Fact]
        public async Task GetGlossariesByIds_returns_existing_items_once_in_request_order()
        {
            _repository.Setup(r => r.GetStoredByIdsAsync(It.IsAny<IEnumerable<string>>()))
                .ReturnsAsync(new List<BlocksGlossary> { Structured("b"), Structured("a") });

            var result = await _service.GetGlossariesByIdsAsync(new[] { "a", "missing", "b", "a" });

            result.Select(g => g.ItemId).Should().Equal("a", "b");
            result[0].Rule.Should().Be("translate");
            _repository.Verify(r => r.GetStoredByIdsAsync(It.IsAny<IEnumerable<string>>()), Times.Once);
        }

        [Fact]
        public async Task GetGlossaryUsage_unknown_glossary_returns_null()
        {
            _repository.Setup(r => r.GetStoredByIdAsync("x")).ReturnsAsync((BlocksGlossary?)null);

            var result = await _service.GetGlossaryUsageAsync(new GlossaryUsageRequest { ItemId = "x" });

            result.Should().BeNull();
            _keyRepository.Verify(k => k.GetGlossaryKeyUsageAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>()), Times.Never);
        }

        [Fact]
        public async Task GetGlossaryUsage_returns_counts_keys_and_modules()
        {
            SetupStored(Structured());
            _keyRepository.Setup(k => k.GetGlossaryKeyUsageAsync("g1", 2, 25)).ReturnsAsync(new GlossaryKeyUsage
            {
                KeyCount = 30,
                Keys = new List<GlossaryUsageKey> { new() { ItemId = "k1", KeyName = "a", ModuleId = "m1" } },
                ModuleIds = new List<string> { "m1" },
                ViolationKeyCount = 2
            });

            var result = await _service.GetGlossaryUsageAsync(new GlossaryUsageRequest { ItemId = "g1", PageNumber = 2, PageSize = 25 });

            result!.KeyCount.Should().Be(30);
            result.ViolationKeyCount.Should().Be(2);
            result.ModuleIds.Should().Equal("m1");
            result.Keys.Should().ContainSingle();
        }
    }
}
