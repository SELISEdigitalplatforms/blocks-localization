using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using Moq;
using Xunit;
using XUnitTest.Shared;

namespace XUnitTest.Repositories
{
    /// <summary>
    /// The uniqueness repository decides when a tenant may get its unique indexes. These tests
    /// check the requests it builds and how it reacts to Mongo's answers; whether MongoDB
    /// evaluates them as intended is proven by the E2E run against a real database (spec A10).
    /// </summary>
    public class LocalizationUniquenessRepositoryTests
    {
        private readonly Mock<IDbContextProvider> _dbContextProvider = new();
        private readonly Mock<IMongoDatabase> _database = new();
        private readonly Mock<ILogger<LocalizationUniquenessRepository>> _logger = new();
        private readonly CollectionMock _keys = new(LocalizationUniquenessRepository.KeyCollectionName);
        private readonly CollectionMock _modules = new(LocalizationUniquenessRepository.ModuleCollectionName);
        private readonly LocalizationUniquenessRepository _repo;
        private readonly string _tenant = "tenant-" + Guid.NewGuid().ToString("N");

        public LocalizationUniquenessRepositoryTests()
        {
            _dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(_database.Object);
            _database.Setup(x => x.GetCollection<BsonDocument>(LocalizationUniquenessRepository.KeyCollectionName, null)).Returns(_keys.Collection.Object);
            _database.Setup(x => x.GetCollection<BsonDocument>(LocalizationUniquenessRepository.ModuleCollectionName, null)).Returns(_modules.Collection.Object);
            _repo = new LocalizationUniquenessRepository(_dbContextProvider.Object, _logger.Object);
        }

        private sealed class CollectionMock
        {
            public Mock<IMongoCollection<BsonDocument>> Collection { get; } = new();
            public Mock<IMongoIndexManager<BsonDocument>> Indexes { get; } = new();
            public List<AggregateOptions> AggregateOptions { get; } = new();
            public List<CreateIndexModel<BsonDocument>> Created { get; } = new();

            public CollectionMock(string name)
            {
                Collection.Setup(x => x.CollectionNamespace).Returns(new CollectionNamespace("tenant", name));
                Collection.Setup(x => x.Indexes).Returns(Indexes.Object);
                Groups(0, 0);
                Existing();
                Indexes.Setup(x => x.CreateOneAsync(It.IsAny<CreateIndexModel<BsonDocument>>(), It.IsAny<CreateOneIndexOptions>(), It.IsAny<CancellationToken>()))
                    .Callback<CreateIndexModel<BsonDocument>, CreateOneIndexOptions, CancellationToken>((m, _, _) => Created.Add(m))
                    .ReturnsAsync("created");
            }

            /// <summary>The duplicate-group aggregation returns these totals (no document when there are none).</summary>
            public void Groups(long groups, long rows)
            {
                var docs = groups == 0
                    ? new List<BsonDocument>()
                    : new List<BsonDocument> { new() { { "_id", BsonNull.Value }, { "groups", groups }, { "rows", rows } } };
                Collection.Setup(x => x.AggregateAsync(It.IsAny<PipelineDefinition<BsonDocument, BsonDocument>>(), It.IsAny<AggregateOptions>(), It.IsAny<CancellationToken>()))
                    .Callback<PipelineDefinition<BsonDocument, BsonDocument>, AggregateOptions, CancellationToken>((_, o, _) => AggregateOptions.Add(o))
                    .ReturnsAsync(() => MockCursorHelper.CreateCursor(docs).Object);
            }

            public void Existing(params BsonDocument[] indexes) =>
                Indexes.Setup(x => x.ListAsync(It.IsAny<CancellationToken>()))
                    .ReturnsAsync(() => MockCursorHelper.CreateCursor(indexes.ToList()).Object);

            public void CreateFails(Exception ex) =>
                Indexes.Setup(x => x.CreateOneAsync(It.IsAny<CreateIndexModel<BsonDocument>>(), It.IsAny<CreateOneIndexOptions>(), It.IsAny<CancellationToken>()))
                    .ThrowsAsync(ex);

            public void VerifyNoCreate() =>
                Indexes.Verify(x => x.CreateOneAsync(It.IsAny<CreateIndexModel<BsonDocument>>(), It.IsAny<CreateOneIndexOptions>(), It.IsAny<CancellationToken>()), Times.Never);

            public void VerifyNothingDropped()
            {
                Indexes.Verify(x => x.DropOneAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
                Indexes.Verify(x => x.DropOneAsync(It.IsAny<string>(), It.IsAny<DropIndexOptions>(), It.IsAny<CancellationToken>()), Times.Never);
                Indexes.Verify(x => x.DropAllAsync(It.IsAny<CancellationToken>()), Times.Never);
            }
        }

        private static List<BsonDocument> Stages(PipelineDefinition<BsonDocument, BsonDocument> pipeline) =>
            pipeline.Render(new RenderArgs<BsonDocument>(
                BsonSerializer.SerializerRegistry.GetSerializer<BsonDocument>(), BsonSerializer.SerializerRegistry)).Documents.ToList();

        private void VerifyLogged(LogLevel level, string fragment) =>
            _logger.Verify(x => x.Log(level, It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains(fragment)),
                It.IsAny<Exception?>(), It.IsAny<Func<It.IsAnyType, Exception?, string>>()), Times.AtLeastOnce);

        // ---- Detection ----

        [Fact]
        public void The_key_group_pipeline_ignores_non_string_fields_and_keeps_only_groups_of_two_or_more()
        {
            var stages = Stages(LocalizationUniquenessRepository.DuplicateGroupCountPipeline("ModuleId", "KeyName"));

            stages.Should().HaveCount(4);
            stages[0].ToJson().Should().Be(BsonDocument.Parse("{ $match: { ModuleId: { $type: 'string' }, KeyName: { $type: 'string' } } }").ToJson());
            stages[1].ToJson().Should().Be(BsonDocument.Parse("{ $group: { _id: { ModuleId: '$ModuleId', KeyName: '$KeyName' }, count: { $sum: 1 } } }").ToJson());
            stages[2].ToJson().Should().Be(BsonDocument.Parse("{ $match: { count: { $gt: 1 } } }").ToJson());
            stages[3].ToJson().Should().Be(BsonDocument.Parse("{ $group: { _id: null, groups: { $sum: 1 }, rows: { $sum: '$count' } } }").ToJson());
        }

        [Fact]
        public async Task The_summary_reports_extra_rows_as_rows_minus_groups_and_reads_index_state()
        {
            // Example 1: (m1,"save") x2 and (m1,"cancel") x3 are two groups of five rows.
            _keys.Groups(2, 5);
            _modules.Groups(1, 2);
            _keys.Existing(new BsonDocument { { "name", "_id_" } }, new BsonDocument { { "name", LocalizationUniquenessRepository.KeyIndexName } });

            var summary = await _repo.GetDuplicateSummaryAsync(_tenant);

            summary.KeyGroupCount.Should().Be(2);
            summary.DuplicateKeyRowCount.Should().Be(5);
            summary.ExtraKeyCount.Should().Be(3);
            summary.ModuleGroupCount.Should().Be(1);
            summary.ExtraModuleCount.Should().Be(1);
            summary.KeyUniquenessEnforced.Should().BeTrue();
            summary.ModuleUniquenessEnforced.Should().BeFalse();
            _keys.AggregateOptions.Should().OnlyContain(o => o.AllowDiskUse == true);
            _modules.AggregateOptions.Should().OnlyContain(o => o.AllowDiskUse == true);
        }

        [Fact]
        public async Task An_empty_tenant_has_an_all_zero_summary()
        {
            var summary = await _repo.GetDuplicateSummaryAsync(_tenant);

            summary.Should().BeEquivalentTo(new { KeyGroupCount = 0L, DuplicateKeyRowCount = 0L, ExtraKeyCount = 0L, ModuleGroupCount = 0L, ExtraModuleCount = 0L });
        }

        [Fact]
        public async Task The_summary_never_creates_an_index()
        {
            await _repo.GetDuplicateSummaryAsync(_tenant);

            _keys.VerifyNoCreate();
            _modules.VerifyNoCreate();
        }

        [Fact]
        public async Task The_summary_reads_the_requested_tenant_database()
        {
            await _repo.GetDuplicateSummaryAsync(_tenant);

            _dbContextProvider.Verify(x => x.GetDatabase(_tenant), Times.Once);
        }

        // ---- Enforcement ----

        [Fact]
        public async Task A_clean_tenant_gets_partial_unique_indexes_on_both_collections()
        {
            var response = await _repo.EnsureUniqueIndexesAsync(_tenant);

            response.KeyUniquenessEnforced.Should().BeTrue();
            response.ModuleUniquenessEnforced.Should().BeTrue();

            var key = _keys.Created.Should().ContainSingle().Subject;
            var rendered = key.Keys.Render(new RenderArgs<BsonDocument>(
                BsonSerializer.SerializerRegistry.GetSerializer<BsonDocument>(), BsonSerializer.SerializerRegistry));
            rendered.ToJson().Should().Be(BsonDocument.Parse("{ ModuleId: 1, KeyName: 1 }").ToJson());
            key.Options.Name.Should().Be("ux_ModuleId_KeyName");
            key.Options.Unique.Should().BeTrue();
            ((BsonDocumentFilterDefinition<BsonDocument>)key.Options.PartialFilterExpression).Document.ToJson()
                .Should().Be(BsonDocument.Parse("{ ModuleId: { $type: 'string' }, KeyName: { $type: 'string' } }").ToJson());

            var module = _modules.Created.Should().ContainSingle().Subject;
            module.Options.Name.Should().Be("ux_ModuleName");
            module.Options.Unique.Should().BeTrue();
            ((BsonDocumentFilterDefinition<BsonDocument>)module.Options.PartialFilterExpression).Document.ToJson()
                .Should().Be(BsonDocument.Parse("{ ModuleName: { $type: 'string' } }").ToJson());
        }

        [Fact]
        public async Task Duplicate_keys_skip_the_key_index_but_the_module_index_is_still_evaluated()
        {
            _keys.Groups(2, 5);

            var response = await _repo.EnsureUniqueIndexesAsync(_tenant);

            response.KeyUniquenessEnforced.Should().BeFalse();
            response.KeyGroupCount.Should().Be(2);
            response.ModuleUniquenessEnforced.Should().BeTrue();
            _keys.VerifyNoCreate();
            _modules.Created.Should().ContainSingle();
            VerifyLogged(LogLevel.Warning, _tenant);
        }

        [Theory]
        [InlineData(11000)]
        [InlineData(85)]
        [InlineData(86)]
        [InlineData(13)]
        public async Task A_failed_index_build_is_reported_as_not_enforced_and_drops_nothing(int code)
        {
            _keys.CreateFails(MongoExceptionFactory.Command(code));

            var response = await _repo.EnsureUniqueIndexesAsync(_tenant);

            response.KeyUniquenessEnforced.Should().BeFalse();
            response.ModuleUniquenessEnforced.Should().BeTrue();
            _keys.VerifyNothingDropped();
        }

        [Fact]
        public async Task An_index_conflict_logs_the_existing_index_for_manual_review()
        {
            _keys.Existing(BsonDocument.Parse("{ name: 'ModuleId_1_KeyName_1', key: { ModuleId: 1, KeyName: 1 }, unique: true }"));
            _keys.CreateFails(MongoExceptionFactory.Command(85));

            await _repo.EnsureUniqueIndexesAsync(_tenant);

            VerifyLogged(LogLevel.Warning, "ModuleId_1_KeyName_1");
            VerifyLogged(LogLevel.Warning, "Manual review required");
        }

        [Fact]
        public async Task A_skipped_result_is_not_cached_so_the_next_call_tries_again()
        {
            _keys.CreateFails(MongoExceptionFactory.Command(11000));
            await _repo.EnsureUniqueIndexesAsync(_tenant);

            _keys.Indexes.Setup(x => x.CreateOneAsync(It.IsAny<CreateIndexModel<BsonDocument>>(), It.IsAny<CreateOneIndexOptions>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("created");
            var second = await _repo.EnsureUniqueIndexesAsync(_tenant);

            second.KeyUniquenessEnforced.Should().BeTrue();
        }

        [Fact]
        public async Task Once_both_indexes_are_confirmed_a_repeat_call_makes_no_mongo_calls()
        {
            await _repo.EnsureUniqueIndexesAsync(_tenant);
            _dbContextProvider.Invocations.Clear();

            var second = await _repo.EnsureUniqueIndexesAsync(_tenant);

            second.KeyUniquenessEnforced.Should().BeTrue();
            second.ModuleUniquenessEnforced.Should().BeTrue();
            _dbContextProvider.Verify(x => x.GetDatabase(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task A_confirmed_key_index_is_not_rebuilt_while_the_module_index_is_retried()
        {
            _modules.Groups(1, 2);
            await _repo.EnsureUniqueIndexesAsync(_tenant);
            _keys.Created.Clear();

            var second = await _repo.EnsureUniqueIndexesAsync(_tenant);

            second.KeyUniquenessEnforced.Should().BeTrue();
            second.ModuleUniquenessEnforced.Should().BeFalse();
            _keys.Created.Should().BeEmpty();
        }

        [Fact]
        public async Task The_cache_is_per_tenant()
        {
            await _repo.EnsureUniqueIndexesAsync(_tenant);
            _keys.Created.Clear();

            await _repo.EnsureUniqueIndexesAsync(_tenant + "-other");

            _keys.Created.Should().ContainSingle();
        }
    }
}
