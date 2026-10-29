using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Services.Glossary
{
    /// <summary>SPEC6 Migration (H15, C9–C12, C23, C28).</summary>
    public class GlossaryMigrationServiceTests
    {
        private const string Prefix = "@@glossary-meta:v1@@";

        private readonly Mock<IGlossaryRepository> _repository = new();
        private readonly Mock<IKeyRepository> _keyRepository = new();
        private readonly Mock<IGlossaryMatcherCache> _matcherCache = new();
        private readonly GlossaryMigrationService _service;
        private readonly List<(BlocksGlossary Glossary, int ExpectedVersion)> _written = new();
        private readonly List<BlocksGlossary> _stored = new();

        public GlossaryMigrationServiceTests()
        {
            XUnitTest.Shared.TestBlocksContext.Set("tenant-m");
            _repository.Setup(r => r.GetAllEntitiesAsync("tenant-m")).ReturnsAsync(() => _stored);
            _repository.Setup(r => r.ReplaceManyAsync(It.IsAny<IReadOnlyList<(BlocksGlossary, int)>>()))
                .Callback<IReadOnlyList<(BlocksGlossary Glossary, int ExpectedVersion)>>(batch => _written.AddRange(batch))
                .ReturnsAsync((IReadOnlyList<(BlocksGlossary, int)> batch) => (long)batch.Count);
            _keyRepository.Setup(k => k.RemoveStaleGlossaryIdsAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<bool>(), It.IsAny<int>()))
                .ReturnsAsync(0L);

            _service = new GlossaryMigrationService(_repository.Object, _keyRepository.Object,
                new Mock<ILogger<GlossaryMigrationService>>().Object, _matcherCache.Object);
        }

        private static BlocksGlossary TrackA(string id, string name = "Workspace") => new()
        {
            ItemId = id,
            Name = name,
            Context = "A shared space ⟦rule: de-DE→Arbeitsbereich⟧",
            AdditionalNote = Prefix + "{\"rule\":\"translate\",\"variants\":[\"workspaces\"],\"translations\":{\"de-DE\":\"Arbeitsbereich\"},\"note\":\"internal\"}",
            Version = 3
        };

        private static BlocksGlossary Migrated(string id, string name) => new()
        {
            ItemId = id,
            Name = name,
            NormalizedName = name.ToLowerInvariant(),
            SchemaVersion = 2,
            Context = "definition",
            AdditionalNote = "note",
            Version = 1
        };

        [Fact]
        public async Task Converts_a_Track_A_document_into_structured_fields()
        {
            _stored.Add(TrackA("g1"));

            var report = await _service.MigrateAsync(dryRun: false);

            report.Migrated.Should().Be(1);
            var (glossary, expectedVersion) = _written.Single();
            expectedVersion.Should().Be(3);
            glossary.SchemaVersion.Should().Be(2);
            glossary.Version.Should().Be(4);
            glossary.Status.Should().Be(GlossaryStatus.Approved);
            glossary.Rule.Should().Be(GlossaryRule.Translate);
            glossary.Variants.Should().Equal("workspaces");
            glossary.Translations.Should().ContainSingle(t => t.Language == "de-DE" && t.Value == "Arbeitsbereich");
            glossary.NormalizedName.Should().Be("workspace");
            glossary.Context.Should().Be("A shared space");
            glossary.AdditionalNote.Should().Be("internal");
            _matcherCache.Verify(c => c.Invalidate("tenant-m"), Times.Once);
        }

        [Fact]
        public async Task Plain_note_is_kept_as_the_note()
        {
            _stored.Add(new BlocksGlossary { ItemId = "g1", Name = "API", AdditionalNote = "just a note", Context = "def" });

            await _service.MigrateAsync(dryRun: false);

            _written.Single().Glossary.AdditionalNote.Should().Be("just a note");
            _written.Single().Glossary.Context.Should().Be("def");
        }

        [Fact]
        public async Task Corrupt_JSON_keeps_the_note_gets_defaults_and_is_reported()
        {
            var raw = Prefix + "{broken";
            _stored.Add(new BlocksGlossary { ItemId = "g6", Name = "Broken", AdditionalNote = raw });

            var report = await _service.MigrateAsync(dryRun: false);

            report.Corrupt.Should().Equal("g6");
            var glossary = _written.Single().Glossary;
            glossary.AdditionalNote.Should().Be(raw);
            glossary.Rule.Should().Be(GlossaryRule.Translate);
            glossary.SchemaVersion.Should().Be(2);
        }

        [Fact]
        public async Task Unsupported_version_is_left_untouched_reported_and_blocks_the_index()
        {
            _stored.Add(new BlocksGlossary { ItemId = "g9", Name = "Future", AdditionalNote = "@@glossary-meta:v2@@{}" });

            var report = await _service.MigrateAsync(dryRun: false);

            report.Corrupt.Should().Equal("g9");
            report.Migrated.Should().Be(0);
            _written.Should().BeEmpty();
            report.UniqueIndexCreated.Should().BeFalse();
            report.Notes.Should().Contain(n => n.Contains("unique index"));
            _repository.Verify(r => r.CreateNormalizedNameUniqueIndexAsync(), Times.Never);
        }

        [Fact]
        public async Task Schema_2_document_still_holding_JSON_or_a_marker_is_cleaned()
        {
            var withJson = Migrated("a", "Alpha");
            withJson.AdditionalNote = Prefix + "{\"rule\":\"keep\",\"note\":\"kept\"}";
            var withMarker = Migrated("b", "Beta");
            withMarker.Context = "Beta definition ⟦rule: keep as-is in all languages⟧";
            _stored.AddRange(new[] { withJson, withMarker, Migrated("c", "Gamma") });

            var report = await _service.MigrateAsync(dryRun: false);

            report.Migrated.Should().Be(2);
            report.AlreadyMigrated.Should().Be(1);
            _written.Single(w => w.Glossary.ItemId == "a").Glossary.AdditionalNote.Should().Be("kept");
            _written.Single(w => w.Glossary.ItemId == "b").Glossary.Context.Should().Be("Beta definition");
            _written.Should().OnlyContain(w => w.Glossary.Version == 2);
        }

        [Fact]
        public async Task Duplicate_names_are_listed_and_block_the_index()
        {
            _stored.AddRange(new[] { TrackA("id1", "workspace"), TrackA("id2", "Workspace"), TrackA("id3", "Other") });

            var report = await _service.MigrateAsync(dryRun: false);

            report.DuplicateGroups.Should().ContainSingle().Which.Should().Equal("id1", "id2");
            report.UniqueIndexCreated.Should().BeFalse();
            _repository.Verify(r => r.CreateNormalizedNameUniqueIndexAsync(), Times.Never);
        }

        [Fact]
        public async Task Dry_run_writes_nothing_but_reports_the_same()
        {
            // Example 7.
            _stored.AddRange(new[] { TrackA("id1", "workspace"), TrackA("id2", "Workspace") });
            _keyRepository.Setup(k => k.RemoveStaleGlossaryIdsAsync(It.IsAny<IReadOnlyCollection<string>>(), true, It.IsAny<int>())).ReturnsAsync(4L);

            var report = await _service.MigrateAsync(dryRun: true);

            report.DryRun.Should().BeTrue();
            report.Migrated.Should().Be(2);
            report.DuplicateGroups.Should().ContainSingle();
            report.StaleKeyRefsRemoved.Should().Be(4);
            report.UniqueIndexCreated.Should().BeFalse();
            _repository.Verify(r => r.ReplaceManyAsync(It.IsAny<IReadOnlyList<(BlocksGlossary, int)>>()), Times.Never);
            _repository.Verify(r => r.CreateNormalizedNameUniqueIndexAsync(), Times.Never);
            _keyRepository.Verify(k => k.RemoveStaleGlossaryIdsAsync(It.IsAny<IReadOnlyCollection<string>>(), false, It.IsAny<int>()), Times.Never);
            _matcherCache.Verify(c => c.Invalidate(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Running_twice_reports_nothing_migrated_the_second_time()
        {
            _stored.AddRange(new[] { TrackA("g1"), new BlocksGlossary { ItemId = "g6", Name = "Broken", AdditionalNote = Prefix + "{broken" } });

            await _service.MigrateAsync(dryRun: false);
            _stored.Clear();
            _stored.AddRange(_written.Select(w => w.Glossary));
            _written.Clear();

            var second = await _service.MigrateAsync(dryRun: false);

            second.Migrated.Should().Be(0);
            second.AlreadyMigrated.Should().Be(2);
            _written.Should().BeEmpty();
            second.UniqueIndexCreated.Should().BeTrue();
        }

        [Fact]
        public async Task Creates_the_unique_index_when_everything_is_migrated_without_duplicates()
        {
            _stored.AddRange(new[] { TrackA("g1", "Alpha"), Migrated("g2", "Beta") });

            var report = await _service.MigrateAsync(dryRun: false);

            report.UniqueIndexCreated.Should().BeTrue();
            _repository.Verify(r => r.CreateNormalizedNameUniqueIndexAsync(), Times.Once);
        }

        [Fact]
        public async Task Removes_stale_key_references_against_every_existing_glossary_id()
        {
            _stored.AddRange(new[] { Migrated("g1", "A"), Migrated("g2", "B") });
            IReadOnlyCollection<string>? existing = null;
            _keyRepository.Setup(k => k.RemoveStaleGlossaryIdsAsync(It.IsAny<IReadOnlyCollection<string>>(), false, 200))
                .Callback<IReadOnlyCollection<string>, bool, int>((ids, _, _) => existing = ids)
                .ReturnsAsync(7L);

            var report = await _service.MigrateAsync(dryRun: false);

            report.StaleKeyRefsRemoved.Should().Be(7);
            existing.Should().BeEquivalentTo(new[] { "g1", "g2" });
        }

        [Fact]
        public async Task Writes_in_batches_of_200()
        {
            _stored.AddRange(Enumerable.Range(0, 450).Select(i => TrackA($"g{i:D3}", $"Term {i}")));

            await _service.MigrateAsync(dryRun: false);

            _repository.Verify(r => r.ReplaceManyAsync(It.Is<IReadOnlyList<(BlocksGlossary, int)>>(b => b.Count <= 200)), Times.Exactly(3));
        }

        [Fact]
        public async Task A_document_changed_during_the_run_is_skipped_and_blocks_the_index()
        {
            _stored.Add(TrackA("g1"));
            _repository.Setup(r => r.ReplaceManyAsync(It.IsAny<IReadOnlyList<(BlocksGlossary, int)>>())).ReturnsAsync(0L);

            var report = await _service.MigrateAsync(dryRun: false);

            report.Migrated.Should().Be(0);
            report.UniqueIndexCreated.Should().BeFalse();
            report.Notes.Should().Contain(n => n.Contains("run it again"));
        }
    }
}
