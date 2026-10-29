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
    public class GlossaryDescriptiveFieldsTests
    {
        private readonly Mock<IGlossaryRepository> _repository = new();
        private readonly Mock<IKeyRepository> _keyRepository = new();
        private readonly Mock<IValidator<GlossaryModel>> _validatorMock = new();
        private readonly Mock<IGlossaryRecheckService> _recheck = new();
        private readonly GlossaryManagementService _service;
        private readonly GlossaryValidator _validator;
        private BlocksGlossary? _written;

        public GlossaryDescriptiveFieldsTests()
        {
            XUnitTest.Shared.TestBlocksContext.Set("tenant-a");
            _validatorMock.Setup(v => v.ValidateAsync(It.IsAny<GlossaryModel>(), default))
                .ReturnsAsync(new FluentValidation.Results.ValidationResult());
            _repository.Setup(r => r.InsertAsync(It.IsAny<BlocksGlossary>()))
                .Callback<BlocksGlossary>(g => _written = g).Returns(Task.CompletedTask);
            _repository.Setup(r => r.ReplaceAsync(It.IsAny<BlocksGlossary>(), It.IsAny<int?>()))
                .Callback<BlocksGlossary, int?>((g, _) => _written = g).ReturnsAsync(true);
            _repository.Setup(r => r.GetByNameInsensitiveAsync(It.IsAny<string>())).ReturnsAsync(new List<GlossaryModel>());

            _service = new GlossaryManagementService(_validatorMock.Object, new Mock<ILogger<GlossaryManagementService>>().Object,
                _repository.Object, _keyRepository.Object, null, _recheck.Object);
            _validator = new GlossaryValidator(_repository.Object);
        }

        private static BlocksGlossary Stored() => new()
        {
            ItemId = "g1",
            Name = "Workspace",
            Version = 3,
            PartOfSpeech = "noun",
            UsageExamples = new List<string> { "Open your workspace." }
        };

        private async Task<IEnumerable<string>> Errors(GlossaryModel glossary) =>
            (await _validator.ValidateAsync(glossary)).Errors.Select(e => $"{e.PropertyName}: {e.ErrorMessage}");

        #region Validation (C16)

        [Theory]
        [InlineData("noun")]
        [InlineData("verb")]
        [InlineData("adjective")]
        [InlineData("adverb")]
        [InlineData("phrase")]
        [InlineData("Other")]
        [InlineData("")]
        public async Task Allowed_part_of_speech_or_empty_to_clear_is_accepted(string value)
        {
            (await Errors(new GlossaryModel { Name = "Workspace", PartOfSpeech = value })).Should().BeEmpty();
        }

        [Fact]
        public async Task Unknown_part_of_speech_is_rejected()
        {
            (await Errors(new GlossaryModel { Name = "Workspace", PartOfSpeech = "pronoun" }))
                .Should().ContainSingle().Which.Should().Be("PartOfSpeech: Part of speech is invalid.");
        }

        [Fact]
        public async Task Omitted_or_empty_usage_examples_are_accepted()
        {
            (await Errors(new GlossaryModel { Name = "Workspace" })).Should().BeEmpty();
            (await Errors(new GlossaryModel { Name = "Workspace", UsageExamples = new List<string>() })).Should().BeEmpty();
            (await Errors(new GlossaryModel { Name = "Workspace", UsageExamples = Enumerable.Repeat(new string('a', 300), 5).ToList() })).Should().BeEmpty();
        }

        public static TheoryData<List<string>> InvalidExamples => new()
        {
            Enumerable.Repeat("An example.", 6).ToList(),
            new List<string> { new('a', 301) },
            new List<string> { "  " },
            new List<string> { null! }
        };

        [Theory]
        [MemberData(nameof(InvalidExamples))]
        public async Task Usage_examples_beyond_the_limits_are_rejected(List<string> examples)
        {
            (await Errors(new GlossaryModel { Name = "Workspace", UsageExamples = examples }))
                .Should().ContainSingle().Which.Should().Be("UsageExamples: Usage examples are invalid.");
        }

        [Fact]
        public async Task An_invalid_save_writes_nothing()
        {
            _validatorMock.Setup(v => v.ValidateAsync(It.IsAny<GlossaryModel>(), default))
                .ReturnsAsync(new FluentValidation.Results.ValidationResult(new[] { new FluentValidation.Results.ValidationFailure("PartOfSpeech", "Part of speech is invalid.") }));

            var response = await _service.SaveGlossaryAsync(new GlossaryModel { ItemId = "g1", Name = "Workspace", PartOfSpeech = "pronoun" });

            response.Success.Should().BeFalse();
            _repository.Verify(r => r.ReplaceAsync(It.IsAny<BlocksGlossary>(), It.IsAny<int?>()), Times.Never);
            _recheck.Verify(r => r.TriggerAsync(It.IsAny<IReadOnlyCollection<string>>()), Times.Never);
        }

        #endregion

        #region Save merge (H22, C17)

        [Fact]
        public async Task Create_stores_the_normalized_fields()
        {
            await _service.SaveGlossaryAsync(new GlossaryModel
            {
                Name = "Workspace", PartOfSpeech = " Noun ", UsageExamples = new List<string> { "  Open your workspace. ", "" }
            });

            _written!.PartOfSpeech.Should().Be("noun");
            _written.UsageExamples.Should().Equal("Open your workspace.");
            _written.SchemaVersion.Should().Be(0, "descriptive fields don't make a save structured");
        }

        [Fact]
        public async Task Omitted_fields_keep_the_stored_values_C17()
        {
            _repository.Setup(r => r.GetStoredByIdAsync("g1")).ReturnsAsync(Stored());

            await _service.SaveGlossaryAsync(new GlossaryModel { ItemId = "g1", Name = "Workspace", Context = "CLI save" });

            _written!.PartOfSpeech.Should().Be("noun");
            _written.UsageExamples.Should().Equal("Open your workspace.");
        }

        [Fact]
        public async Task Empty_string_and_empty_list_clear_the_fields()
        {
            _repository.Setup(r => r.GetStoredByIdAsync("g1")).ReturnsAsync(Stored());

            await _service.SaveGlossaryAsync(new GlossaryModel { ItemId = "g1", Name = "Workspace", PartOfSpeech = "", UsageExamples = new List<string>() });

            _written!.PartOfSpeech.Should().BeNull();
            _written.UsageExamples.Should().BeNull();
        }

        [Fact]
        public async Task Sent_values_replace_the_stored_ones()
        {
            _repository.Setup(r => r.GetStoredByIdAsync("g1")).ReturnsAsync(Stored());

            await _service.SaveGlossaryAsync(new GlossaryModel { ItemId = "g1", Name = "Workspace", PartOfSpeech = "verb", UsageExamples = new List<string> { "Workspace it." } });

            _written!.PartOfSpeech.Should().Be("verb");
            _written.UsageExamples.Should().Equal("Workspace it.");
        }

        [Fact]
        public void Fields_serialize_as_camelCase()
        {
            var json = System.Text.Json.JsonSerializer.Serialize(
                new GlossaryModel { Name = "W", PartOfSpeech = "noun", UsageExamples = new List<string> { "e" } },
                new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));

            json.Should().Contain("\"partOfSpeech\":\"noun\"").And.Contain("\"usageExamples\":[\"e\"]");
        }

        #endregion

        #region Re-check trigger (H28)

        [Fact]
        public async Task Create_and_update_trigger_a_recheck_for_that_glossary()
        {
            _repository.Setup(r => r.GetStoredByIdAsync("g1")).ReturnsAsync(Stored());

            await _service.SaveGlossaryAsync(new GlossaryModel { Name = "New term" });
            await _service.SaveGlossaryAsync(new GlossaryModel { ItemId = "g1", Name = "Workspace" });

            _recheck.Verify(r => r.TriggerAsync(It.Is<IReadOnlyCollection<string>>(ids => ids.Single() == _written!.ItemId)), Times.Once);
            _recheck.Verify(r => r.TriggerAsync(It.Is<IReadOnlyCollection<string>>(ids => ids.Single() == "g1")), Times.Once);
        }

        [Fact]
        public async Task A_version_conflict_triggers_nothing()
        {
            _repository.Setup(r => r.GetStoredByIdAsync("g1")).ReturnsAsync(Stored());

            await _service.SaveGlossaryAsync(new GlossaryModel { ItemId = "g1", Name = "Workspace", Version = 1 });

            _recheck.Verify(r => r.TriggerAsync(It.IsAny<IReadOnlyCollection<string>>()), Times.Never);
        }

        [Fact]
        public async Task Delete_triggers_a_recheck_for_that_glossary()
        {
            _repository.Setup(r => r.GetByIdAsync("g1")).ReturnsAsync(new GlossaryModel { ItemId = "g1", Name = "Workspace" });

            var result = await _service.DeleteGlossaryAsync(new DeleteGlossaryRequest { ItemId = "g1" });

            result.IsSuccess.Should().BeTrue();
            _recheck.Verify(r => r.TriggerAsync(It.Is<IReadOnlyCollection<string>>(ids => ids.Single() == "g1")), Times.Once);
        }

        [Fact]
        public async Task A_migration_run_triggers_a_whole_project_recheck_and_a_dry_run_does_not()
        {
            _repository.Setup(r => r.GetAllEntitiesAsync("tenant-a")).ReturnsAsync(new List<BlocksGlossary>
            {
                new() { ItemId = "g1", Name = "Workspace", Version = 1, AdditionalNote = GlossaryMetaParser.Prefix + "{\"rule\":\"keep\"}" }
            });
            _repository.Setup(r => r.ReplaceManyAsync(It.IsAny<IReadOnlyList<(BlocksGlossary, int)>>())).ReturnsAsync(1);
            var migration = new GlossaryMigrationService(_repository.Object, _keyRepository.Object,
                new Mock<ILogger<GlossaryMigrationService>>().Object, null, _recheck.Object);

            await migration.MigrateAsync(dryRun: true);
            _recheck.Verify(r => r.TriggerAsync(It.IsAny<IReadOnlyCollection<string>>()), Times.Never);

            await migration.MigrateAsync(dryRun: false);
            _recheck.Verify(r => r.TriggerAsync(It.Is<IReadOnlyCollection<string>>(ids => ids.Count == 0)), Times.Once);
        }

        #endregion
    }
}
