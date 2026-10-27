using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using Xunit;

namespace XUnitTest.Repositories
{
    /// <summary>
    /// Keyset paging is only correct if the cursor filter and Mongo's (sortField, _id) ordering agree,
    /// including ties and null sort values, which a mocked collection cannot show. These run against
    /// local MongoDB (the same prerequisite as the Routing tests; port from BLOCKS_ROUTING_TEST_MONGO_PORT).
    /// </summary>
    public sealed class KeyRepositoryKeysetIntegrationTests : IDisposable
    {
        private readonly MongoClient _client;
        private readonly string _databaseName = "blocks_keyset_" + Guid.NewGuid().ToString("N");
        private readonly IMongoCollection<Key> _keys;
        private readonly KeyRepository _repo;

        public KeyRepositoryKeysetIntegrationTests()
        {
            var port = Environment.GetEnvironmentVariable("BLOCKS_ROUTING_TEST_MONGO_PORT") ?? "27017";
            _client = new MongoClient($"mongodb://localhost:{port}/?appName=keyset-tests");
            var database = _client.GetDatabase(_databaseName);
            database.RunCommand<BsonDocument>(new BsonDocument("ping", 1));
            _keys = database.GetCollection<Key>("BlocksLanguageKeys");

            var provider = new Mock<IDbContextProvider>();
            provider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(database);
            _repo = new KeyRepository(provider.Object, NullLogger<KeyRepository>.Instance);
        }

        public void Dispose()
        {
            _client.DropDatabase(_databaseName);
            _client.Dispose();
        }

        private static readonly DateTime Base = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        /// <summary>
        /// 60 keys whose sort values deliberately collide: 12 distinct names, 5 distinct dates, and
        /// a few keys without a name so the null bucket is crossed mid-iteration.
        /// </summary>
        private async Task SeedAsync(int count = 60)
        {
            var keys = Enumerable.Range(0, count).Select(i => new Key
            {
                ItemId = $"id-{(i * 37) % count:D4}",
                KeyName = i % 15 == 0 ? null! : $"key_{i % 12:D2}",
                ModuleId = i % 2 == 0 ? "mod-a" : "mod-b",
                Resources = new[] { new Resource { Culture = "en-US", Value = i == 7 ? "say a(b now" : $"value {i}" } },
                CreateDate = Base.AddMinutes(i % 5),
                LastUpdateDate = Base.AddMinutes(i % 3)
            });
            await _keys.InsertManyAsync(keys);
        }

        private async Task<List<string>> ExpectedOrderAsync(string field, bool descending)
        {
            var sort = descending
                ? Builders<Key>.Sort.Descending(field).Descending("_id")
                : Builders<Key>.Sort.Ascending(field).Ascending("_id");
            return (await _keys.Find(FilterDefinition<Key>.Empty).Sort(sort).ToListAsync()).Select(k => k.ItemId!).ToList();
        }

        private async Task<List<string>> IterateCursorAsync(GetKeysRequest request)
        {
            var ids = new List<string>();
            var cursor = request.Cursor;
            for (var guard = 0; guard < 1000; guard++)
            {
                request.Cursor = cursor;
                request.IncludeTotalCount = ids.Count == 0;
                var page = await _repo.GetAllKeysAsync(request);
                ids.AddRange(page.Keys.Select(k => k.ItemId!));
                if (!page.HasMore) return ids;
                cursor = page.NextCursor;
            }
            throw new InvalidOperationException("Cursor iteration did not terminate.");
        }

        [Theory]
        [InlineData("KeyName", false)]
        [InlineData("KeyName", true)]
        [InlineData("CreateDate", false)]
        [InlineData("CreateDate", true)]
        [InlineData("LastUpdateDate", false)]
        [InlineData("LastUpdateDate", true)]
        public async Task Cursor_iteration_returns_every_key_once_in_sort_then_id_order(string field, bool descending)
        {
            await SeedAsync();

            // Page size 3 makes a chunk end inside the null-KeyName bucket, so that branch of the cursor filter runs.
            var ids = await IterateCursorAsync(new GetKeysRequest { PageSize = 3, SortProperty = field, IsDescending = descending });

            ids.Should().Equal(await ExpectedOrderAsync(field, descending));
        }

        [Fact]
        public async Task Offset_pages_and_cursor_chunks_agree()
        {
            await SeedAsync();
            var offsetIds = new List<string>();
            for (var page = 0; page < 9; page++)
            {
                var result = await _repo.GetAllKeysAsync(new GetKeysRequest { PageNumber = page, PageSize = 7, SortProperty = "CreateDate" });
                offsetIds.AddRange(result.Keys.Select(k => k.ItemId!));
                result.TotalCount.Should().Be(60);
                result.HasMore.Should().Be(page < 8);
            }

            var cursorIds = await IterateCursorAsync(new GetKeysRequest { PageSize = 7, SortProperty = "CreateDate" });

            offsetIds.Should().Equal(cursorIds);
        }

        [Fact]
        public async Task Count_is_skipped_only_when_asked()
        {
            await SeedAsync();

            (await _repo.GetAllKeysAsync(new GetKeysRequest { PageSize = 5 })).TotalCount.Should().Be(60);
            (await _repo.GetAllKeysAsync(new GetKeysRequest { PageSize = 5, IncludeTotalCount = false })).TotalCount.Should().BeNull();
        }

        [Fact]
        public async Task Cursor_respects_the_request_filter_and_rejects_a_different_one()
        {
            await SeedAsync();
            var request = new GetKeysRequest { PageSize = 4, ModuleIds = new[] { "mod-a" } };

            var ids = await IterateCursorAsync(request);
            ids.Should().HaveCount(30);

            var first = await _repo.GetAllKeysAsync(new GetKeysRequest { PageSize = 4, ModuleIds = new[] { "mod-a" } });
            var act = () => _repo.GetAllKeysAsync(new GetKeysRequest { PageSize = 4, ModuleIds = new[] { "mod-b" }, Cursor = first.NextCursor });
            (await act.Should().ThrowAsync<KeyListException>()).Which.ErrorCode.Should().Be(KeyListErrorCodes.CursorMismatch);

            var flipped = () => _repo.GetAllKeysAsync(new GetKeysRequest { PageSize = 4, ModuleIds = new[] { "mod-a" }, IsDescending = true, Cursor = first.NextCursor });
            (await flipped.Should().ThrowAsync<KeyListException>()).Which.ErrorCode.Should().Be(KeyListErrorCodes.CursorMismatch);
        }

        [Fact]
        public async Task Keys_inserted_or_deleted_between_chunks_are_neither_repeated_nor_skipped()
        {
            await SeedAsync();
            var first = await _repo.GetAllKeysAsync(new GetKeysRequest { PageSize = 10 });
            var seen = first.Keys.Select(k => k.ItemId!).ToList();

            await _keys.InsertOneAsync(new Key { ItemId = "id-new", KeyName = "zzz_late", ModuleId = "mod-a", Resources = Array.Empty<Resource>(), CreateDate = Base, LastUpdateDate = Base });
            var remaining = (await ExpectedOrderAsync("KeyName", false)).Except(seen).ToList();
            var deleted = remaining[5];
            await _keys.DeleteOneAsync(k => k.ItemId == deleted);

            var rest = await IterateCursorAsync(new GetKeysRequest { PageSize = 10, Cursor = first.NextCursor });

            seen.Intersect(rest).Should().BeEmpty();
            rest.Should().Contain("id-new").And.NotContain(deleted);
            seen.Concat(rest).Should().OnlyHaveUniqueItems().And.HaveCount(60);
        }

        [Fact]
        public async Task Page_size_is_defaulted_and_capped()
        {
            await _keys.InsertManyAsync(Enumerable.Range(0, KeyRepository.MaxKeyPageSize + 5).Select(i => new Key
            {
                ItemId = $"bulk-{i:D5}", KeyName = $"bulk_{i:D5}", ModuleId = "m", Resources = Array.Empty<Resource>(), CreateDate = Base, LastUpdateDate = Base
            }));

            var capped = await _repo.GetAllKeysAsync(new GetKeysRequest { PageSize = 5000 });
            capped.Keys.Should().HaveCount(KeyRepository.MaxKeyPageSize);
            capped.HasMore.Should().BeTrue();

            (await _repo.GetAllKeysAsync(new GetKeysRequest { PageSize = 0 })).Keys.Should().HaveCount(KeyRepository.DefaultKeyPageSize);
        }

        [Fact]
        public async Task A_page_number_far_past_the_end_returns_no_rows_instead_of_failing()
        {
            await SeedAsync();

            var result = await _repo.GetAllKeysAsync(new GetKeysRequest { PageNumber = int.MaxValue, PageSize = 1000 });

            result.Keys.Should().BeEmpty();
            result.TotalCount.Should().Be(60);
            result.HasMore.Should().BeFalse();
        }

        [Fact]
        public async Task Resource_search_matches_regex_metacharacters_literally()
        {
            await SeedAsync();

            var result = await _repo.GetAllKeysAsync(new GetKeysRequest
            {
                PageSize = 50,
                ResourceSearchFilters = new[] { new ResourceSearchFilter { Culture = "en-US", SearchText = "a(b" } }
            });

            // Seed row i = 7 holds "say a(b now"; its id is (7 * 37) % 60 = 19.
            result.Keys.Select(k => k.ItemId).Should().Equal("id-0019");
        }

        [Fact]
        public async Task An_empty_collection_returns_an_empty_last_page()
        {
            var result = await _repo.GetAllKeysAsync(new GetKeysRequest { PageSize = 100 });

            result.Keys.Should().BeEmpty();
            result.TotalCount.Should().Be(0);
            result.HasMore.Should().BeFalse();
            result.NextCursor.Should().BeNull();
        }

        [Fact]
        public async Task Index_creation_is_idempotent_and_names_the_five_indexes()
        {
            await SeedAsync();

            await KeyIndexInitializer.EnsureAsync("keyset-test", _keys, NullLogger.Instance);
            await KeyIndexInitializer.EnsureAsync("keyset-test", _keys, NullLogger.Instance);

            var names = (await (await _keys.Indexes.ListAsync()).ToListAsync()).Select(i => i["name"].AsString);
            names.Should().BeEquivalentTo("_id_", "ix_keys_keyname_id", "ix_keys_createdate_id", "ix_keys_lastupdatedate_id",
                "ix_keys_moduleid_keyname_id", "ix_keys_glossaryids");
        }
    }
}
