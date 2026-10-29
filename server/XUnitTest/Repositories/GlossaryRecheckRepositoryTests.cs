using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using Moq;
using Xunit;
using XUnitTest.Shared;

namespace XUnitTest.Repositories
{
    /// <summary>SPEC8 re-check storage: the per-tenant coalescing marker (C12) and the key paging / violations-only write (H29).</summary>
    public class GlossaryRecheckRepositoryTests
    {
        private static readonly DateTime Now = new(2026, 10, 29, 12, 0, 0, DateTimeKind.Utc);
        private readonly Mock<IDbContextProvider> _dbContextProvider = new();
        private readonly Mock<IMongoDatabase> _database = new();
        private readonly Mock<IMongoCollection<GlossaryRecheckJob>> _jobs = new();
        private readonly Mock<IMongoCollection<BlocksLanguageKey>> _keys = new();
        private readonly List<(BsonDocument Filter, BsonDocument Update, bool Upsert)> _updates = new();

        public GlossaryRecheckRepositoryTests()
        {
            TestBlocksContext.Set("recheck-tenant");
            _dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(_database.Object);
            _database.Setup(x => x.GetCollection<GlossaryRecheckJob>(GlossaryRecheckJobRepository.CollectionName, null)).Returns(_jobs.Object);
            _database.Setup(x => x.GetCollection<BlocksLanguageKey>(It.IsAny<string>(), null)).Returns(_keys.Object);
        }

        private static BsonDocument Render<T>(FilterDefinition<T> filter) =>
            filter.Render(new RenderArgs<T>(BsonSerializer.SerializerRegistry.GetSerializer<T>(), BsonSerializer.SerializerRegistry));

        private static BsonDocument Render<T>(UpdateDefinition<T> update) =>
            update.Render(new RenderArgs<T>(BsonSerializer.SerializerRegistry.GetSerializer<T>(), BsonSerializer.SerializerRegistry)).AsBsonDocument;

        /// <summary>The first UpdateOne (the upsert) returns <paramref name="upsert"/>, the stale take-over returns <paramref name="takeOverModified"/>.</summary>
        private void SetupJobUpdates(UpdateResult upsert, long takeOverModified)
        {
            _jobs.Setup(x => x.UpdateOneAsync(It.IsAny<FilterDefinition<GlossaryRecheckJob>>(), It.IsAny<UpdateDefinition<GlossaryRecheckJob>>(), It.IsAny<UpdateOptions>(), It.IsAny<CancellationToken>()))
                .Callback<FilterDefinition<GlossaryRecheckJob>, UpdateDefinition<GlossaryRecheckJob>, UpdateOptions, CancellationToken>((f, u, o, _) =>
                    _updates.Add((Render(f), Render(u), o?.IsUpsert == true)))
                .ReturnsAsync(() => _updates.Count == 1 ? upsert : new UpdateResult.Acknowledged(takeOverModified, takeOverModified, null));
        }

        [Fact]
        public async Task TryEnqueue_creates_the_marker_and_reports_it()
        {
            SetupJobUpdates(new UpdateResult.Acknowledged(0, 0, new BsonString(GlossaryRecheckJob.MarkerId)), 0);
            var repo = new GlossaryRecheckJobRepository(_dbContextProvider.Object);

            var created = await repo.TryEnqueueAsync("recheck-tenant", new[] { "g1", "g2" }, Now, TimeSpan.FromMinutes(30));

            created.Should().BeTrue();
            _updates.Should().ContainSingle();
            _updates[0].Upsert.Should().BeTrue();
            _updates[0].Filter.ToJson().Should().Be(BsonDocument.Parse("{ _id: 'glossary-recheck' }").ToJson());
            _updates[0].Update["$addToSet"].ToJson().Should().Be(BsonDocument.Parse("{ GlossaryIds: { $each: ['g1', 'g2'] } }").ToJson());
            _updates[0].Update["$setOnInsert"].AsBsonDocument.Names.Should().Equal("QueuedAt");
        }

        [Fact]
        public async Task TryEnqueue_merges_into_a_queued_marker_and_reports_coalesced()
        {
            SetupJobUpdates(new UpdateResult.Acknowledged(1, 1, null), 0);
            var repo = new GlossaryRecheckJobRepository(_dbContextProvider.Object);

            var created = await repo.TryEnqueueAsync("recheck-tenant", null, Now, TimeSpan.FromMinutes(30));

            created.Should().BeFalse();
            _updates[0].Update["$set"].ToJson().Should().Be(BsonDocument.Parse("{ WholeProject: true }").ToJson());
            // The second update only takes over a marker older than the stale limit.
            _updates[1].Filter["QueuedAt"]["$lt"].ToUniversalTime().Should().Be(Now.AddMinutes(-30));
        }

        [Fact]
        public async Task TryEnqueue_takes_over_a_stale_marker()
        {
            SetupJobUpdates(new UpdateResult.Acknowledged(1, 1, null), 1);
            var repo = new GlossaryRecheckJobRepository(_dbContextProvider.Object);

            (await repo.TryEnqueueAsync("recheck-tenant", new[] { "g1" }, Now, TimeSpan.FromMinutes(30))).Should().BeTrue();
        }

        [Fact]
        public async Task TryEnqueue_that_loses_the_insert_race_merges_and_reports_coalesced()
        {
            var calls = 0;
            _jobs.Setup(x => x.UpdateOneAsync(It.IsAny<FilterDefinition<GlossaryRecheckJob>>(), It.IsAny<UpdateDefinition<GlossaryRecheckJob>>(), It.IsAny<UpdateOptions>(), It.IsAny<CancellationToken>()))
                .Returns(() => ++calls == 1
                    ? throw MongoExceptionFactory.DuplicateKeyWrite()
                    : Task.FromResult<UpdateResult>(new UpdateResult.Acknowledged(1, calls == 2 ? 1 : 0, null)));
            var repo = new GlossaryRecheckJobRepository(_dbContextProvider.Object);

            (await repo.TryEnqueueAsync("recheck-tenant", new[] { "g1" }, Now, TimeSpan.FromMinutes(30))).Should().BeFalse();
            calls.Should().Be(3);
        }

        [Fact]
        public async Task GetKeysForGlossaryRecheckAsync_pages_by_id_with_a_projection()
        {
            FilterDefinition<BlocksLanguageKey>? filter = null;
            FindOptions<BlocksLanguageKey, BlocksLanguageKey>? options = null;
            var cursor = MockCursorHelper.CreateCursor(new List<BlocksLanguageKey> { new() { ItemId = "k2" } });
            _keys.Setup(x => x.FindAsync(It.IsAny<FilterDefinition<BlocksLanguageKey>>(), It.IsAny<FindOptions<BlocksLanguageKey, BlocksLanguageKey>>(), It.IsAny<CancellationToken>()))
                .Callback<FilterDefinition<BlocksLanguageKey>, FindOptions<BlocksLanguageKey, BlocksLanguageKey>, CancellationToken>((f, o, _) => { filter = f; options = o; })
                .ReturnsAsync(cursor.Object);
            var repo = new KeyRepository(_dbContextProvider.Object);

            var keys = await repo.GetKeysForGlossaryRecheckAsync(null, "k1", 1000);

            keys.Should().ContainSingle();
            Render(filter!).ToJson().Should().Be(BsonDocument.Parse("{ _id: { $gt: 'k1' } }").ToJson());
            options!.Limit.Should().Be(1000);
            options.Sort.Render(new RenderArgs<BlocksLanguageKey>(BsonSerializer.SerializerRegistry.GetSerializer<BlocksLanguageKey>(), BsonSerializer.SerializerRegistry))
                .ToJson().Should().Be(BsonDocument.Parse("{ _id: 1 }").ToJson());
            options.Projection.Should().NotBeNull();
        }

        [Fact]
        public void Recheck_filter_selects_tagged_module_and_violation_keys()
        {
            var filter = KeyRepository.BuildGlossaryRecheckFilter(
                new GlossaryRecheckKeyScope { GlossaryIds = new[] { "g1" }, ModuleIds = new[] { "m1" } }, null);

            Render(filter).ToJson().Should().Be(BsonDocument.Parse(
                "{ $or: [ { GlossaryIds: { $in: ['g1'] } }, { 'GlossaryViolations.GlossaryId': { $in: ['g1'] } }, { ModuleId: { $in: ['m1'] } } ] }").ToJson());
        }

        [Fact]
        public void Recheck_filter_for_an_empty_scope_selects_nothing()
        {
            Render(KeyRepository.BuildGlossaryRecheckFilter(new GlossaryRecheckKeyScope(), null)).ToJson()
                .Should().Be(BsonDocument.Parse("{ _id: { $in: [] } }").ToJson());
        }

        [Fact]
        public async Task SetGlossaryViolationsManyAsync_sets_only_GlossaryViolations_in_one_bulk_write()
        {
            List<WriteModel<BlocksLanguageKey>>? models = null;
            _keys.Setup(x => x.BulkWriteAsync(It.IsAny<IEnumerable<WriteModel<BlocksLanguageKey>>>(), It.IsAny<BulkWriteOptions>(), It.IsAny<CancellationToken>()))
                .Callback<IEnumerable<WriteModel<BlocksLanguageKey>>, BulkWriteOptions, CancellationToken>((m, _, _) => models = m.ToList())
                .ReturnsAsync(new BulkWriteResult<BlocksLanguageKey>.Acknowledged(2, 2, 0, 2, 2, new List<WriteModel<BlocksLanguageKey>>(), new List<BulkWriteUpsert>()));
            var repo = new KeyRepository(_dbContextProvider.Object);

            await repo.SetGlossaryViolationsManyAsync(new List<(string, List<KeyGlossaryViolation>)>
            {
                ("k1", new List<KeyGlossaryViolation>()),
                ("k2", new List<KeyGlossaryViolation> { new() { Culture = "de-DE", GlossaryId = "g1" } })
            });

            var updates = models!.Cast<UpdateOneModel<BlocksLanguageKey>>().ToList();
            updates.Should().HaveCount(2).And.OnlyContain(u => !u.IsUpsert);
            updates.Select(u => Render(u.Update)).Should().OnlyContain(u => u.Names.SequenceEqual(new[] { "$set" }) && u["$set"].AsBsonDocument.Names.SequenceEqual(new[] { "GlossaryViolations" }));
        }
    }
}
