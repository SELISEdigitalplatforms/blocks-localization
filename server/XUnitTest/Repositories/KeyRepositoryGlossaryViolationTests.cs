using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Serializers;
using MongoDB.Driver;
using Moq;
using Xunit;
using XUnitTest.Shared;

namespace XUnitTest.Repositories
{
    /// <summary>SPEC6 key-side glossary data: stored violations, the "Glossary issues" filter, usage and stale references.</summary>
    public class KeyRepositoryGlossaryViolationTests
    {
        private readonly Mock<IDbContextProvider> _dbContextProvider = new();
        private readonly Mock<IMongoDatabase> _database = new();
        private readonly Mock<IMongoCollection<BlocksLanguageKey>> _blkCollection = new();
        private readonly Mock<IMongoCollection<Key>> _keyCollection = new();
        private readonly Mock<IMongoCollection<BsonDocument>> _bsonCollection = new();
        private readonly KeyRepository _repo;
        private FilterDefinition<Key>? _countFilter;

        public KeyRepositoryGlossaryViolationTests()
        {
            TestBlocksContext.Set("key-tenant");
            _dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(_database.Object);
            _database.Setup(x => x.GetCollection<BlocksLanguageKey>(It.IsAny<string>(), null)).Returns(_blkCollection.Object);
            _database.Setup(x => x.GetCollection<Key>(It.IsAny<string>(), null)).Returns(_keyCollection.Object);
            _database.Setup(x => x.GetCollection<BsonDocument>(It.IsAny<string>(), null)).Returns(_bsonCollection.Object);

            MockCursorHelper.SetupFindAsync(_keyCollection, new List<Key>());
            _keyCollection
                .Setup(x => x.CountDocumentsAsync(It.IsAny<FilterDefinition<Key>>(), It.IsAny<CountOptions>(), It.IsAny<CancellationToken>()))
                .Callback<FilterDefinition<Key>, CountOptions, CancellationToken>((f, _, _) => _countFilter = f)
                .ReturnsAsync(0L);

            _repo = new KeyRepository(_dbContextProvider.Object);
        }

        private static RenderArgs<T> Args<T>() =>
            new(BsonSerializer.SerializerRegistry.GetSerializer<T>(), BsonSerializer.SerializerRegistry);

        [Fact]
        public async Task HasGlossaryViolations_true_returns_only_keys_with_at_least_one_violation()
        {
            await _repo.GetAllKeysAsync(new GetKeysRequest { PageSize = 20, HasGlossaryViolations = true });

            _countFilter!.Render(Args<Key>()).ToJson()
                .Should().Be(BsonDocument.Parse("{ 'GlossaryViolations.0': { $exists: true } }").ToJson());
        }

        [Fact]
        public async Task HasGlossaryViolations_false_returns_keys_with_missing_or_empty_violations()
        {
            await _repo.GetAllKeysAsync(new GetKeysRequest { PageSize = 20, HasGlossaryViolations = false });

            _countFilter!.Render(Args<Key>()).ToJson().Should().BeOneOf(
                BsonDocument.Parse("{ 'GlossaryViolations.0': { $exists: false } }").ToJson(),
                BsonDocument.Parse("{ 'GlossaryViolations.0': { $not: { $exists: true } } }").ToJson());
        }

        [Fact]
        public async Task HasGlossaryViolations_absent_adds_no_filter()
        {
            await _repo.GetAllKeysAsync(new GetKeysRequest { PageSize = 20 });

            _countFilter!.Render(Args<Key>()).ToJson().Should().NotContain("GlossaryViolations");
        }

        [Fact]
        public async Task Delete_cleanup_pulls_the_glossary_id_and_its_violations_in_one_update()
        {
            FilterDefinition<BlocksLanguageKey>? filter = null;
            UpdateDefinition<BlocksLanguageKey>? update = null;
            _blkCollection.Setup(x => x.UpdateManyAsync(It.IsAny<FilterDefinition<BlocksLanguageKey>>(), It.IsAny<UpdateDefinition<BlocksLanguageKey>>(), It.IsAny<UpdateOptions>(), It.IsAny<CancellationToken>()))
                .Callback<FilterDefinition<BlocksLanguageKey>, UpdateDefinition<BlocksLanguageKey>, UpdateOptions, CancellationToken>((f, u, _, _) => { filter = f; update = u; })
                .ReturnsAsync(new UpdateResult.Acknowledged(3, 3, null));

            var modified = await _repo.RemoveGlossaryIdFromKeysAsync("g1");

            modified.Should().Be(3);
            _blkCollection.Verify(x => x.UpdateManyAsync(It.IsAny<FilterDefinition<BlocksLanguageKey>>(), It.IsAny<UpdateDefinition<BlocksLanguageKey>>(), It.IsAny<UpdateOptions>(), It.IsAny<CancellationToken>()), Times.Once);
            // A global or module term can cause violations on keys it isn't tagged on.
            filter!.Render(Args<BlocksLanguageKey>()).ToJson().Should().Be(BsonDocument.Parse(
                "{ $or: [ { GlossaryIds: 'g1' }, { GlossaryViolations: { $elemMatch: { GlossaryId: 'g1' } } } ] }").ToJson());
            var rendered = update!.Render(Args<BlocksLanguageKey>()).AsBsonDocument;
            rendered["$pull"].AsBsonDocument.ToJson().Should().Be(BsonDocument.Parse(
                "{ GlossaryIds: 'g1', GlossaryViolations: { GlossaryId: 'g1' } }").ToJson());
            rendered["$set"].AsBsonDocument.Names.Should().Equal("LastUpdateDate");
        }

        [Fact]
        public async Task UpdateUilmResourceKeys_sets_violations_only_for_keys_that_carry_them()
        {
            List<WriteModel<BlocksLanguageKey>>? models = null;
            _blkCollection.Setup(x => x.BulkWriteAsync(It.IsAny<IEnumerable<WriteModel<BlocksLanguageKey>>>(), It.IsAny<BulkWriteOptions>(), It.IsAny<CancellationToken>()))
                .Callback<IEnumerable<WriteModel<BlocksLanguageKey>>, BulkWriteOptions, CancellationToken>((m, _, _) => models = m.ToList())
                .ReturnsAsync(new BulkWriteResult<BlocksLanguageKey>.Acknowledged(2, 2, 0, 0, 2, new List<WriteModel<BlocksLanguageKey>>(), new List<BulkWriteUpsert>()));

            await _repo.UpdateUilmResourceKeys(new List<BlocksLanguageKey>
            {
                new() { ItemId = "checked", Resources = Array.Empty<Resource>(), GlossaryViolations = new List<KeyGlossaryViolation>() },
                new() { ItemId = "other-flow", Resources = Array.Empty<Resource>() }
            });

            var sets = models!.Cast<UpdateOneModel<BlocksLanguageKey>>()
                .Select(m => m.Update.Render(Args<BlocksLanguageKey>()).AsBsonDocument["$set"].AsBsonDocument)
                .ToList();
            sets[0].Contains("GlossaryViolations").Should().BeTrue();
            // A key from another flow never wipes the stored violations.
            sets[1].Contains("GlossaryViolations").Should().BeFalse();
        }

        [Fact]
        public async Task SetGlossaryViolationsAsync_replaces_the_key_violations()
        {
            UpdateDefinition<BlocksLanguageKey>? update = null;
            _blkCollection.Setup(x => x.UpdateOneAsync(It.IsAny<FilterDefinition<BlocksLanguageKey>>(), It.IsAny<UpdateDefinition<BlocksLanguageKey>>(), It.IsAny<UpdateOptions>(), It.IsAny<CancellationToken>()))
                .Callback<FilterDefinition<BlocksLanguageKey>, UpdateDefinition<BlocksLanguageKey>, UpdateOptions, CancellationToken>((_, u, _, _) => update = u)
                .ReturnsAsync(new UpdateResult.Acknowledged(1, 1, null));

            await _repo.SetGlossaryViolationsAsync("k1", new List<KeyGlossaryViolation>
            {
                new() { Culture = "de-DE", GlossaryId = "g1", Term = "Workspace", Kind = "forbidden-used", Found = "Werkbereich" }
            });

            var set = update!.Render(Args<BlocksLanguageKey>()).AsBsonDocument["$set"].AsBsonDocument;
            set.Names.Should().Equal("GlossaryViolations");
            set["GlossaryViolations"][0]["Found"].AsString.Should().Be("Werkbereich");
        }

        [Fact]
        public async Task GetGlossaryKeyUsageAsync_runs_a_page_query_and_one_facet_query()
        {
            var page = new List<GlossaryUsageKey> { new() { ItemId = "k1", KeyName = "a", ModuleId = "m1" } };
            var cursor = MockCursorHelper.CreateCursor(page);
            FindOptions<BlocksLanguageKey, GlossaryUsageKey>? findOptions = null;
            _blkCollection.Setup(x => x.FindAsync(It.IsAny<FilterDefinition<BlocksLanguageKey>>(), It.IsAny<FindOptions<BlocksLanguageKey, GlossaryUsageKey>>(), It.IsAny<CancellationToken>()))
                .Callback<FilterDefinition<BlocksLanguageKey>, FindOptions<BlocksLanguageKey, GlossaryUsageKey>, CancellationToken>((_, o, _) => findOptions = o)
                .ReturnsAsync(cursor.Object);

            var facet = BsonDocument.Parse("{ keyCount: [ { n: 12 } ], moduleIds: [ { _id: 'm2' }, { _id: 'm1' } ], violationKeyCount: [ { n: 4 } ] }");
            var facetCursor = MockCursorHelper.CreateCursor(new List<BsonDocument> { facet });
            PipelineDefinition<BsonDocument, BsonDocument>? pipeline = null;
            _bsonCollection.Setup(x => x.AggregateAsync(It.IsAny<PipelineDefinition<BsonDocument, BsonDocument>>(), It.IsAny<AggregateOptions>(), It.IsAny<CancellationToken>()))
                .Callback<PipelineDefinition<BsonDocument, BsonDocument>, AggregateOptions, CancellationToken>((p, _, _) => pipeline = p)
                .ReturnsAsync(facetCursor.Object);

            var usage = await _repo.GetGlossaryKeyUsageAsync("g1", 1, 10);

            usage.KeyCount.Should().Be(12);
            usage.ViolationKeyCount.Should().Be(4);
            usage.ModuleIds.Should().Equal("m1", "m2");
            usage.Keys.Should().ContainSingle(k => k.ItemId == "k1");
            findOptions!.Skip.Should().Be(10);
            findOptions.Limit.Should().Be(10);
            var stages = pipeline!.Render(new RenderArgs<BsonDocument>(BsonDocumentSerializer.Instance, BsonSerializer.SerializerRegistry)).Documents;
            stages.Should().HaveCount(2);
            stages[1].Names.Should().Equal("$facet");
        }

        [Fact]
        public async Task GetGlossaryKeyUsageAsync_without_matches_returns_zero_counts()
        {
            MockCursorHelper.SetupFindAsyncWithProjection(_blkCollection, new List<GlossaryUsageKey>());
            _bsonCollection.Setup(x => x.AggregateAsync(It.IsAny<PipelineDefinition<BsonDocument, BsonDocument>>(), It.IsAny<AggregateOptions>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(MockCursorHelper.CreateEmptyCursor<BsonDocument>().Object);

            var usage = await _repo.GetGlossaryKeyUsageAsync("g1", 0, 10);

            usage.KeyCount.Should().Be(0);
            usage.ViolationKeyCount.Should().Be(0);
            usage.ModuleIds.Should().BeEmpty();
        }

        private void SetupStaleKeys(List<BlocksLanguageKey> keys) =>
            MockCursorHelper.SetupFindAsyncWithProjection(_blkCollection, keys);

        [Fact]
        public async Task RemoveStaleGlossaryIdsAsync_dry_run_counts_entries_and_writes_nothing()
        {
            SetupStaleKeys(new List<BlocksLanguageKey>
            {
                new() { ItemId = "k1", GlossaryIds = new List<string> { "live", "gone1", "gone2" } },
                new() { ItemId = "k2", GlossaryIds = new List<string> { "gone1" } }
            });

            var removed = await _repo.RemoveStaleGlossaryIdsAsync(new HashSet<string> { "live" }, dryRun: true);

            removed.Should().Be(3);
            _blkCollection.Verify(x => x.UpdateManyAsync(It.IsAny<FilterDefinition<BlocksLanguageKey>>(), It.IsAny<UpdateDefinition<BlocksLanguageKey>>(), It.IsAny<UpdateOptions>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task RemoveStaleGlossaryIdsAsync_pulls_ids_not_in_the_existing_set_in_batches()
        {
            SetupStaleKeys(Enumerable.Range(0, 5).Select(i => new BlocksLanguageKey { ItemId = $"k{i}", GlossaryIds = new List<string> { "gone" } }).ToList());
            var updates = new List<UpdateDefinition<BlocksLanguageKey>>();
            _blkCollection.Setup(x => x.UpdateManyAsync(It.IsAny<FilterDefinition<BlocksLanguageKey>>(), It.IsAny<UpdateDefinition<BlocksLanguageKey>>(), It.IsAny<UpdateOptions>(), It.IsAny<CancellationToken>()))
                .Callback<FilterDefinition<BlocksLanguageKey>, UpdateDefinition<BlocksLanguageKey>, UpdateOptions, CancellationToken>((_, u, _, _) => updates.Add(u))
                .ReturnsAsync(new UpdateResult.Acknowledged(2, 2, null));

            var removed = await _repo.RemoveStaleGlossaryIdsAsync(new HashSet<string> { "live" }, dryRun: false, batchSize: 2);

            removed.Should().Be(5);
            updates.Should().HaveCount(3);
            updates[0].Render(Args<BlocksLanguageKey>()).AsBsonDocument["$pull"].ToJson()
                .Should().Be(BsonDocument.Parse("{ GlossaryIds: { $nin: ['live'] } }").ToJson());
        }
    }
}
