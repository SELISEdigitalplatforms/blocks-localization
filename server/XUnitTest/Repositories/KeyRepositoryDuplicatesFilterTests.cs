using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using Moq;
using Xunit;
using XUnitTest.Shared;

namespace XUnitTest.Repositories
{
    /// <summary>
    /// The "duplicates only" filter of POST /Key/Gets: which ids it collects, how it combines with
    /// the existing filter, its default order and its cap. MongoDB's evaluation of the aggregation is
    /// proven by the E2E run (spec A10).
    /// </summary>
    public class KeyRepositoryDuplicatesFilterTests
    {
        private readonly Mock<IDbContextProvider> _dbContextProvider = new();
        private readonly Mock<IMongoDatabase> _database = new();
        private readonly Mock<IMongoCollection<Key>> _keys = new();
        private readonly Mock<IMongoCollection<BsonDocument>> _rawKeys = new();
        private readonly KeyRepository _repo;

        private FilterDefinition<Key>? _countFilter;
        private FindOptions<Key, Key>? _findOptions;
        private PipelineDefinition<BsonDocument, BsonDocument>? _pipeline;
        private AggregateOptions? _aggregateOptions;

        public KeyRepositoryDuplicatesFilterTests()
        {
            _dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(_database.Object);
            _database.Setup(x => x.GetCollection<Key>(It.IsAny<string>(), null)).Returns(_keys.Object);
            _database.Setup(x => x.GetCollection<BsonDocument>("BlocksLanguageKeys", null)).Returns(_rawKeys.Object);

            _keys.Setup(x => x.FindAsync(It.IsAny<FilterDefinition<Key>>(), It.IsAny<FindOptions<Key, Key>>(), It.IsAny<CancellationToken>()))
                .Callback<FilterDefinition<Key>, FindOptions<Key, Key>, CancellationToken>((_, o, _) => _findOptions = o)
                .ReturnsAsync(() => MockCursorHelper.CreateCursor(new List<Key>()).Object);
            _keys.Setup(x => x.CountDocumentsAsync(It.IsAny<FilterDefinition<Key>>(), It.IsAny<CountOptions>(), It.IsAny<CancellationToken>()))
                .Callback<FilterDefinition<Key>, CountOptions, CancellationToken>((f, _, _) => _countFilter = f)
                .ReturnsAsync(0L);
            DuplicateIds(0);

            _repo = new KeyRepository(_dbContextProvider.Object);
        }

        private void DuplicateIds(int count)
        {
            var docs = Enumerable.Range(0, count).Select(i => new BsonDocument("_id", $"id-{i}")).ToList();
            _rawKeys.Setup(x => x.AggregateAsync(It.IsAny<PipelineDefinition<BsonDocument, BsonDocument>>(), It.IsAny<AggregateOptions>(), It.IsAny<CancellationToken>()))
                .Callback<PipelineDefinition<BsonDocument, BsonDocument>, AggregateOptions, CancellationToken>((p, o, _) => { _pipeline = p; _aggregateOptions = o; })
                .ReturnsAsync(() => MockCursorHelper.CreateCursor(docs).Object);
        }

        private string Rendered(FilterDefinition<Key> filter) =>
            filter.Render(new RenderArgs<Key>(BsonSerializer.SerializerRegistry.GetSerializer<Key>(), BsonSerializer.SerializerRegistry)).ToString();

        private BsonDocument RenderedSort() =>
            _findOptions!.Sort.Render(new RenderArgs<Key>(BsonSerializer.SerializerRegistry.GetSerializer<Key>(), BsonSerializer.SerializerRegistry));

        private static GetKeysRequest Request(bool onlyDuplicates = true) => new() { PageNumber = 0, PageSize = 10, OnlyDuplicates = onlyDuplicates };

        [Fact]
        public async Task Without_the_flag_the_query_and_order_are_unchanged_and_nothing_is_aggregated()
        {
            var response = await _repo.GetAllKeysAsync(Request(onlyDuplicates: false));

            Rendered(_countFilter!).Should().Be("{ }");
            RenderedSort().ToJson().Should().Be(BsonDocument.Parse("{ KeyName: 1, _id: 1 }").ToJson());
            response.DuplicatesTruncated.Should().BeFalse();
            _rawKeys.Verify(x => x.AggregateAsync(It.IsAny<PipelineDefinition<BsonDocument, BsonDocument>>(), It.IsAny<AggregateOptions>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Only_duplicate_members_are_returned_ordered_so_copies_sit_together()
        {
            DuplicateIds(3);

            var response = await _repo.GetAllKeysAsync(Request());

            Rendered(_countFilter!).Should().Contain("\"_id\" : { \"$in\" : [\"id-0\", \"id-1\", \"id-2\"] }");
            RenderedSort().ToJson().Should().Be(BsonDocument.Parse("{ KeyName: 1, ModuleId: 1, CreateDate: 1, _id: 1 }").ToJson());
            response.DuplicatesTruncated.Should().BeFalse();
            _aggregateOptions!.AllowDiskUse.Should().BeTrue();
        }

        [Fact]
        public async Task The_duplicates_filter_is_combined_with_the_existing_filters()
        {
            DuplicateIds(2);
            var request = Request();
            request.ModuleIds = new[] { "m1" };
            request.KeySearchText = "save";

            await _repo.GetAllKeysAsync(request);

            var rendered = Rendered(_countFilter!);
            rendered.Should().Contain("\"ModuleId\" : \"m1\"");
            rendered.Should().Contain("save");
            rendered.Should().Contain("\"$in\" : [\"id-0\", \"id-1\"]");
        }

        [Fact]
        public async Task An_explicit_sort_comes_first_and_the_tie_breakers_keep_paging_stable()
        {
            DuplicateIds(2);
            var request = Request();
            request.SortProperty = "LastUpdateDate";
            request.IsDescending = true;

            await _repo.GetAllKeysAsync(request);

            RenderedSort().ToJson().Should().Be(BsonDocument.Parse("{ LastUpdateDate: -1, ModuleId: 1, CreateDate: 1, _id: 1 }").ToJson());
        }

        [Fact]
        public async Task The_tables_default_key_name_sort_still_groups_copies_by_module()
        {
            // The UI always sends its sort property, "KeyName" by default.
            DuplicateIds(2);
            var request = Request();
            request.SortProperty = "KeyName";

            await _repo.GetAllKeysAsync(request);

            RenderedSort().ToJson().Should().Be(BsonDocument.Parse("{ KeyName: 1, ModuleId: 1, CreateDate: 1, _id: 1 }").ToJson());
        }

        [Fact]
        public async Task The_duplicates_view_pages_by_offset_and_refuses_a_keyset_cursor()
        {
            var cursor = KeyListCursor.Encode(new Key { ItemId = "id-0", KeyName = "a" }, "KeyName", false, "hash");
            var request = Request();
            request.Cursor = cursor;

            var act = () => _repo.GetAllKeysAsync(request);

            (await act.Should().ThrowAsync<KeyListException>()).Which.ErrorCode.Should().Be(KeyListErrorCodes.CursorMismatch);
        }

        [Fact]
        public async Task No_duplicates_means_an_empty_result_rather_than_every_key()
        {
            await _repo.GetAllKeysAsync(Request());

            Rendered(_countFilter!).Should().Contain("\"_id\" : { \"$in\" : [] }");
        }

        [Fact]
        public async Task More_than_ten_thousand_members_are_capped_and_flagged()
        {
            DuplicateIds(KeyRepository.DuplicateKeyIdCap + 1);

            var response = await _repo.GetAllKeysAsync(Request());

            response.DuplicatesTruncated.Should().BeTrue();
            Rendered(_countFilter!).Should().Contain("\"id-9999\"").And.NotContain("\"id-10000\"");
        }

        [Fact]
        public async Task The_id_pipeline_orders_members_before_capping_them()
        {
            DuplicateIds(1);

            await _repo.GetAllKeysAsync(Request());

            var stages = _pipeline!.Render(new RenderArgs<BsonDocument>(
                BsonSerializer.SerializerRegistry.GetSerializer<BsonDocument>(), BsonSerializer.SerializerRegistry)).Documents.ToList();
            stages.Select(s => s.GetElement(0).Name).Should().Equal("$match", "$group", "$match", "$unwind", "$sort", "$limit", "$project");
            stages[0]["$match"].ToJson().Should().Be(BsonDocument.Parse("{ ModuleId: { $type: 'string' }, KeyName: { $type: 'string' } }").ToJson());
            stages[2]["$match"].ToJson().Should().Be(BsonDocument.Parse("{ count: { $gt: 1 } }").ToJson());
            stages[4]["$sort"].ToJson().Should().Be(BsonDocument.Parse("{ '_id.KeyName': 1, '_id.ModuleId': 1, 'members.created': 1 }").ToJson());
            stages[5]["$limit"].ToInt32().Should().Be(KeyRepository.DuplicateKeyIdCap + 1);
        }
    }
}
