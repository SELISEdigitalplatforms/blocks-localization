using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared.Entities;
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
    /// <summary>
    /// The resolver behind filter-form bulk Delete and Translate: it must read IDs only, stop one past the
    /// limit, run under the key list time limit and stay inside the caller's tenant.
    /// </summary>
    public class KeyRepositoryBulkTargetTests
    {
        private readonly Mock<IDbContextProvider> _dbContextProvider = new();
        private readonly Mock<IMongoDatabase> _database = new();
        private readonly Mock<IMongoCollection<Key>> _keyCollection = new();
        private readonly Mock<IMongoCollection<BlocksLanguageKey>> _blkCollection = new();
        private readonly KeyRepository _repo;

        private FilterDefinition<Key>? _capturedFilter;
        private FindOptions<Key, BsonDocument>? _capturedOptions;

        public KeyRepositoryBulkTargetTests()
        {
            _dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(_database.Object);
            _database.Setup(x => x.GetCollection<Key>(It.IsAny<string>(), null)).Returns(_keyCollection.Object);
            _database.Setup(x => x.GetCollection<BlocksLanguageKey>(It.IsAny<string>(), null)).Returns(_blkCollection.Object);
            _repo = new KeyRepository(_dbContextProvider.Object);
        }

        private void SetupIds(params string[] ids)
        {
            var cursor = MockCursorHelper.CreateCursor(ids.Select(id => new BsonDocument("_id", id)).ToList());
            _keyCollection
                .Setup(x => x.FindAsync(It.IsAny<FilterDefinition<Key>>(), It.IsAny<FindOptions<Key, BsonDocument>>(), It.IsAny<CancellationToken>()))
                .Callback<FilterDefinition<Key>, FindOptions<Key, BsonDocument>, CancellationToken>((f, o, _) =>
                {
                    _capturedFilter = f;
                    _capturedOptions = o;
                })
                .ReturnsAsync(cursor.Object);
        }

        private string Render<T>(FilterDefinition<T> filter) => filter
            .Render(new RenderArgs<T>(BsonSerializer.SerializerRegistry.GetSerializer<T>(), BsonSerializer.SerializerRegistry))
            .ToString();

        [Fact]
        public async Task Atomic_delete_returns_only_deleted_snapshots_and_identifies_a_concurrent_removal()
        {
            TestBlocksContext.Set("tenant-a");
            _blkCollection.Setup(x => x.FindOneAndDeleteAsync(
                    It.IsAny<FilterDefinition<BlocksLanguageKey>>(),
                    It.IsAny<FindOneAndDeleteOptions<BlocksLanguageKey, BlocksLanguageKey>>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync((FilterDefinition<BlocksLanguageKey> filter,
                    FindOneAndDeleteOptions<BlocksLanguageKey, BlocksLanguageKey> _, CancellationToken _) =>
                    Render(filter).Contains("k1")
                        ? new BlocksLanguageKey { ItemId = "k1", KeyName = "first" }
                        : null!);

            var result = await _repo.DeleteKeysWithSnapshotsAsync(new[] { "k1", "k2" });

            result.Deleted.Select(key => key.ItemId).Should().Equal("k1");
            result.Errors.Should().ContainSingle().Which.Should().Be(new KeyValuePair<string, string>("k2", "Key not found"));
            _dbContextProvider.Verify(x => x.GetDatabase("tenant-a"), Times.Once);
        }

        [Fact]
        public async Task Returns_the_matching_ids_reading_only_the_id_up_to_the_limit()
        {
            SetupIds("k1", "k2");

            var result = await _repo.GetMatchingKeyIdsAsync(new GetKeysRequest(), 10_001);

            result.Ids.Should().Equal("k1", "k2");
            result.DuplicatesTruncated.Should().BeFalse();
            _capturedOptions!.Limit.Should().Be(10_001);
            _capturedOptions.MaxTime.Should().Be(KeyRepository.KeyListQueryMaxTime);
            _capturedOptions.Projection
                .Render(new RenderArgs<Key>(BsonSerializer.SerializerRegistry.GetSerializer<Key>(), BsonSerializer.SerializerRegistry))
                .Document.ToString().Should().Be("{ \"_id\" : 1 }");
        }

        [Fact]
        public async Task Uses_the_same_filter_as_the_key_list_and_ignores_paging()
        {
            SetupIds();
            var filter = new GetKeysRequest { ModuleIds = new[] { "m1" }, PageNumber = 7, PageSize = 20, Cursor = "ignored" };

            await _repo.GetMatchingKeyIdsAsync(filter, 10);

            Render(_capturedFilter!).Should().Contain("ModuleId").And.Contain("m1");
            _capturedOptions!.Skip.Should().BeNull();
        }

        [Fact]
        public async Task Resolves_in_the_callers_tenant_database()
        {
            TestBlocksContext.Set("tenant-a");
            SetupIds();

            await _repo.GetMatchingKeyIdsAsync(new GetKeysRequest(), 10);

            _dbContextProvider.Verify(x => x.GetDatabase("tenant-a"), Times.Once);
        }

        [Fact]
        public async Task A_timeout_surfaces_as_query_timeout_503_under_target()
        {
            _keyCollection
                .Setup(x => x.FindAsync(It.IsAny<FilterDefinition<Key>>(), It.IsAny<FindOptions<Key, BsonDocument>>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new MongoExecutionTimeoutException(
                    new MongoDB.Driver.Core.Connections.ConnectionId(
                        new MongoDB.Driver.Core.Servers.ServerId(
                            new MongoDB.Driver.Core.Clusters.ClusterId(1), new System.Net.DnsEndPoint("localhost", 27017))),
                    "operation exceeded time limit"));

            var act = () => _repo.GetMatchingKeyIdsAsync(new GetKeysRequest(), 10);

            var error = (await act.Should().ThrowAsync<KeyListException>()).Which;
            error.ErrorCode.Should().Be(KeyListErrorCodes.QueryTimeout);
            error.Field.Should().Be(BulkKeyTarget.Field);
            error.StatusCode.Should().Be(503);
        }

        [Fact]
        public async Task GetKeysByIdsAsync_reads_the_keys_in_one_in_query()
        {
            FilterDefinition<BlocksLanguageKey>? captured = null;
            var cursor = MockCursorHelper.CreateCursor(new List<BlocksLanguageKey> { new() { ItemId = "k1" } });
            _blkCollection
                .Setup(x => x.FindAsync(It.IsAny<FilterDefinition<BlocksLanguageKey>>(), It.IsAny<FindOptions<BlocksLanguageKey, BlocksLanguageKey>>(), It.IsAny<CancellationToken>()))
                .Callback<FilterDefinition<BlocksLanguageKey>, FindOptions<BlocksLanguageKey, BlocksLanguageKey>, CancellationToken>((f, _, _) => captured = f)
                .ReturnsAsync(cursor.Object);

            var keys = await _repo.GetKeysByIdsAsync(new[] { "k1", "k2" });

            keys.Select(k => k.ItemId).Should().Equal("k1");
            Render(captured!).Should().Be("{ \"_id\" : { \"$in\" : [\"k1\", \"k2\"] } }");
        }

        [Fact]
        public async Task A_finished_translate_batch_is_counted_atomically_in_the_tenant_database()
        {
            TestBlocksContext.Set("tenant-b");
            var progress = new Mock<IMongoCollection<BsonDocument>>();
            _database.Setup(x => x.GetCollection<BsonDocument>("BulkTranslateProgress", null)).Returns(progress.Object);
            UpdateDefinition<BsonDocument>? update = null;
            FindOneAndUpdateOptions<BsonDocument, BsonDocument>? options = null;
            progress
                .Setup(x => x.FindOneAndUpdateAsync(It.IsAny<FilterDefinition<BsonDocument>>(), It.IsAny<UpdateDefinition<BsonDocument>>(),
                    It.IsAny<FindOneAndUpdateOptions<BsonDocument, BsonDocument>>(), It.IsAny<CancellationToken>()))
                .Callback<FilterDefinition<BsonDocument>, UpdateDefinition<BsonDocument>, FindOneAndUpdateOptions<BsonDocument, BsonDocument>, CancellationToken>(
                    (_, u, o, _) => { update = u; options = o; })
                .ReturnsAsync(new BsonDocument { { "_id", "op-1" }, { "Done", 2 }, { "Failed", 1 } });

            var result = await _repo.RecordBulkTranslateBatchAsync("op-1", succeeded: false);

            result.Should().Be(new BulkTranslateProgress(2, 1));
            _dbContextProvider.Verify(x => x.GetDatabase("tenant-b"), Times.Once);
            options!.IsUpsert.Should().BeTrue();
            options.ReturnDocument.Should().Be(ReturnDocument.After);
            update!.Render(new RenderArgs<BsonDocument>(BsonDocumentSerializer.Instance, BsonSerializer.SerializerRegistry))
                .ToString().Should().Contain("\"$inc\" : { \"Done\" : 1, \"Failed\" : 1 }");
        }

        [Fact]
        public async Task GetKeysByIdsAsync_with_no_ids_does_not_query()
        {
            var keys = await _repo.GetKeysByIdsAsync(Array.Empty<string>());

            keys.Should().BeEmpty();
            _blkCollection.VerifyNoOtherCalls();
        }
    }
}
