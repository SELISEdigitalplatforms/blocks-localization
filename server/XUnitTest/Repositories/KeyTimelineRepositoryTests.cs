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
using Moq;
using MongoDB.Bson;
using MongoDB.Driver;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using XUnitTest.Shared;

namespace XUnitTest.Repositories
{
    public class KeyTimelineRepositoryTests
    {
        private readonly Mock<IDbContextProvider> _dbContextProvider;
        private readonly Mock<IConfiguration> _configuration;
        private readonly Mock<IMongoDatabase> _database;
        private readonly Mock<IMongoDatabase> _rootDatabase;
        private readonly Mock<IMongoCollection<KeyTimeline>> _collection;
        private readonly Mock<IMongoCollection<User>> _usersCollection;
        private readonly Mock<IMongoIndexManager<KeyTimeline>> _indexes;
        // Unique per test: MongoIndexEnsurer caches per (database name, collection) for the whole process.
        private readonly DatabaseNamespace _databaseNamespace = new("timeline-tests-" + Guid.NewGuid().ToString("N"));
        private readonly KeyTimelineRepository _repo;

        public KeyTimelineRepositoryTests()
        {
            _dbContextProvider = new Mock<IDbContextProvider>();
            _configuration = new Mock<IConfiguration>();
            _database = new Mock<IMongoDatabase>();
            _rootDatabase = new Mock<IMongoDatabase>();
            _collection = new Mock<IMongoCollection<KeyTimeline>>();
            _usersCollection = new Mock<IMongoCollection<User>>();

            _dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(_database.Object);
            _database.Setup(x => x.GetCollection<KeyTimeline>(It.IsAny<string>(), null)).Returns(_collection.Object);
            _database.Setup(x => x.DatabaseNamespace).Returns(_databaseNamespace);
            _indexes = new Mock<IMongoIndexManager<KeyTimeline>>();
            _collection.Setup(x => x.Indexes).Returns(_indexes.Object);

            // Setup for root database (user lookup)
            _configuration.Setup(x => x[It.Is<string>(s => s == "RootTenantId")]).Returns("root-tenant");
            _rootDatabase.Setup(x => x.GetCollection<User>(It.IsAny<string>(), null)).Returns(_usersCollection.Object);

            _repo = new KeyTimelineRepository(_dbContextProvider.Object, _configuration.Object, NullLogger<KeyTimelineRepository>.Instance);
        }

        #region SaveKeyTimelineAsync

        [Fact]
        public async Task SaveKeyTimelineAsync_SetsItemIdAndDates_WhenNoItemId()
        {
            var timeline = new KeyTimeline { ItemId = null, EntityId = "e", UserId = "u" };

            _collection.Setup(x => x.InsertOneAsync(
                It.IsAny<KeyTimeline>(),
                It.IsAny<InsertOneOptions>(),
                It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            await _repo.SaveKeyTimelineAsync(timeline);

            timeline.ItemId.Should().NotBeNullOrWhiteSpace();
            timeline.CreateDate.Should().NotBe(default);
            timeline.LastUpdateDate.Should().NotBe(default);

            _collection.Verify(x => x.InsertOneAsync(
                timeline,
                It.IsAny<InsertOneOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task SaveKeyTimelineAsync_SetsEmptyItemIdAndDates_WhenEmptyString()
        {
            var timeline = new KeyTimeline { ItemId = "", EntityId = "e", UserId = "u" };

            _collection.Setup(x => x.InsertOneAsync(
                It.IsAny<KeyTimeline>(),
                It.IsAny<InsertOneOptions>(),
                It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            await _repo.SaveKeyTimelineAsync(timeline);

            timeline.ItemId.Should().NotBeNullOrWhiteSpace();
        }

        [Fact]
        public async Task SaveKeyTimelineAsync_Upserts_WhenItemIdExists()
        {
            _collection.Setup(x => x.ReplaceOneAsync(
                It.IsAny<FilterDefinition<KeyTimeline>>(),
                It.IsAny<KeyTimeline>(),
                It.IsAny<ReplaceOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync(Mock.Of<ReplaceOneResult>());

            var timeline = new KeyTimeline { ItemId = "id", EntityId = "e", UserId = "u", CreateDate = DateTime.UtcNow.AddDays(-1) };
            await _repo.SaveKeyTimelineAsync(timeline);

            _collection.Verify(x => x.ReplaceOneAsync(
                It.IsAny<FilterDefinition<KeyTimeline>>(),
                timeline,
                It.Is<ReplaceOptions>(o => o.IsUpsert),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        #endregion

        #region BulkSaveKeyTimelinesAsync

        [Fact]
        public async Task BulkSaveKeyTimelinesAsync_EmptyList_DoesNothing()
        {
            await _repo.BulkSaveKeyTimelinesAsync(new List<KeyTimeline>(), "tenant");
            _dbContextProvider.Verify(x => x.GetDatabase("tenant"), Times.Never);
        }

        [Fact]
        public async Task BulkSaveKeyTimelinesAsync_WithItems_SetsIdsAndDatesAndInserts()
        {
            _collection.Setup(x => x.InsertManyAsync(
                It.IsAny<IEnumerable<KeyTimeline>>(),
                It.IsAny<InsertManyOptions>(),
                It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var timelines = new List<KeyTimeline> {
                new KeyTimeline { ItemId = null, EntityId = "e1", UserId = "u1" },
                new KeyTimeline { ItemId = "id2", EntityId = "e2", UserId = "u2" }
            };

            await _repo.BulkSaveKeyTimelinesAsync(timelines, "tenant");

            timelines[0].ItemId.Should().NotBeNullOrWhiteSpace();
            timelines[0].CreateDate.Should().NotBe(default);
            timelines[1].CreateDate.Should().NotBe(default);

            _collection.Verify(x => x.InsertManyAsync(
                timelines,
                It.IsAny<InsertManyOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task BulkSaveKeyTimelinesAsync_PreservesExistingItemId()
        {
            _collection.Setup(x => x.InsertManyAsync(
                It.IsAny<IEnumerable<KeyTimeline>>(),
                It.IsAny<InsertManyOptions>(),
                It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var timelines = new List<KeyTimeline> {
                new KeyTimeline { ItemId = "existing-id", EntityId = "e1", UserId = "u1" }
            };

            await _repo.BulkSaveKeyTimelinesAsync(timelines, "tenant");

            timelines[0].ItemId.Should().Be("existing-id");
        }

        #endregion

        #region GetKeyTimelineAsync

        [Fact]
        public async Task GetKeyTimelineAsync_ReturnsTimelinesAndCount_WithUsers()
        {
            var timelines = new List<KeyTimeline>
            {
                new KeyTimeline { ItemId = "t1", EntityId = "e1", UserId = "u1", CreateDate = DateTime.UtcNow },
                new KeyTimeline { ItemId = "t2", EntityId = "e1", UserId = "u2", CreateDate = DateTime.UtcNow }
            };
            MockCursorHelper.SetupFindAsync(_collection, timelines);
            MockCursorHelper.SetupCountDocuments(_collection, 2);

            // Setup root database for user lookup
            _dbContextProvider.Setup(x => x.GetDatabase("root-tenant")).Returns(_rootDatabase.Object);

            var users = new List<User>
            {
                new User { ItemId = "u1", FirstName = "John", LastName = "Doe", Email = "john@test.com" },
                new User { ItemId = "u2", FirstName = null, LastName = null, Email = "jane@test.com" }
            };
            MockCursorHelper.SetupFindAsync(_usersCollection, users);

            var request = new GetKeyTimelineRequest { EntityId = "e1", PageNumber = 1, PageSize = 10 };
            var result = await _repo.GetKeyTimelineAsync(request);

            result.Should().NotBeNull();
            result.TotalCount.Should().Be(2);
            result.Timelines.Should().HaveCount(2);
            result.Timelines[0].UserName.Should().Be("John Doe");
            result.Timelines[1].UserName.Should().Be("jane@test.com"); // Fallback to email
        }

        [Fact]
        public async Task GetKeyTimelineAsync_WithNoUsers_FallsBackToUserId()
        {
            var timelines = new List<KeyTimeline>
            {
                new KeyTimeline { ItemId = "t1", EntityId = "e1", UserId = "u1", CreateDate = DateTime.UtcNow }
            };
            MockCursorHelper.SetupFindAsync(_collection, timelines);
            MockCursorHelper.SetupCountDocuments(_collection, 1);

            _dbContextProvider.Setup(x => x.GetDatabase("root-tenant")).Returns(_rootDatabase.Object);

            // No matching users
            MockCursorHelper.SetupFindAsyncEmpty(_usersCollection);

            var request = new GetKeyTimelineRequest { EntityId = "e1", PageNumber = 1, PageSize = 10 };
            var result = await _repo.GetKeyTimelineAsync(request);

            result.Timelines[0].UserName.Should().Be("u1"); // Fallback to UserId
        }

        [Fact]
        public async Task GetKeyTimelineAsync_WithNullUserId_SetsUnknown()
        {
            var timelines = new List<KeyTimeline>
            {
                new KeyTimeline { ItemId = "t1", EntityId = "e1", UserId = null, CreateDate = DateTime.UtcNow }
            };
            MockCursorHelper.SetupFindAsync(_collection, timelines);
            MockCursorHelper.SetupCountDocuments(_collection, 1);

            var request = new GetKeyTimelineRequest { EntityId = "e1", PageNumber = 1, PageSize = 10 };
            var result = await _repo.GetKeyTimelineAsync(request);

            result.Timelines[0].UserName.Should().Be("Unknown");
        }

        [Fact]
        public async Task GetKeyTimelineAsync_WithEmptyTimelines_SkipsUserLookup()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_collection);
            MockCursorHelper.SetupCountDocuments(_collection, 0);

            var request = new GetKeyTimelineRequest { EntityId = "e1", PageNumber = 1, PageSize = 10 };
            var result = await _repo.GetKeyTimelineAsync(request);

            result.TotalCount.Should().Be(0);
            result.Timelines.Should().BeEmpty();
        }

        [Fact]
        public async Task GetKeyTimelineAsync_DescendingSort_UsesDescending()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_collection);
            MockCursorHelper.SetupCountDocuments(_collection, 0);

            var request = new GetKeyTimelineRequest
            {
                EntityId = "e1",
                PageNumber = 1,
                PageSize = 10,
                SortProperty = "CreateDate",
                IsDescending = true
            };

            var result = await _repo.GetKeyTimelineAsync(request);
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task GetKeyTimelineAsync_AscendingSort_NoSortProperty_DefaultsToCreateDate()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_collection);
            MockCursorHelper.SetupCountDocuments(_collection, 0);

            var request = new GetKeyTimelineRequest
            {
                EntityId = "e1",
                PageNumber = 1,
                PageSize = 10,
                SortProperty = null,
                IsDescending = false
            };

            var result = await _repo.GetKeyTimelineAsync(request);
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task GetKeyTimelineAsync_WithUserIdFilter()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_collection);
            MockCursorHelper.SetupCountDocuments(_collection, 0);

            var request = new GetKeyTimelineRequest
            {
                EntityId = "e1",
                UserId = "u1",
                PageNumber = 1,
                PageSize = 10
            };

            var result = await _repo.GetKeyTimelineAsync(request);
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task GetKeyTimelineAsync_WithDateRangeFilter()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_collection);
            MockCursorHelper.SetupCountDocuments(_collection, 0);

            var request = new GetKeyTimelineRequest
            {
                EntityId = "e1",
                PageNumber = 1,
                PageSize = 10,
                CreateDateRange = new DateRange
                {
                    StartDate = DateTime.UtcNow.AddDays(-7),
                    EndDate = DateTime.UtcNow
                }
            };

            var result = await _repo.GetKeyTimelineAsync(request);
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task GetKeyTimelineAsync_WithStartDateOnly()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_collection);
            MockCursorHelper.SetupCountDocuments(_collection, 0);

            var request = new GetKeyTimelineRequest
            {
                PageNumber = 1,
                PageSize = 10,
                CreateDateRange = new DateRange { StartDate = DateTime.UtcNow.AddDays(-7) }
            };

            var result = await _repo.GetKeyTimelineAsync(request);
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task GetKeyTimelineAsync_WithEndDateOnly()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_collection);
            MockCursorHelper.SetupCountDocuments(_collection, 0);

            var request = new GetKeyTimelineRequest
            {
                PageNumber = 1,
                PageSize = 10,
                CreateDateRange = new DateRange { EndDate = DateTime.UtcNow }
            };

            var result = await _repo.GetKeyTimelineAsync(request);
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task GetKeyTimelineAsync_UserWithFirstNameOnly()
        {
            var timelines = new List<KeyTimeline>
            {
                new KeyTimeline { ItemId = "t1", EntityId = "e1", UserId = "u1", CreateDate = DateTime.UtcNow }
            };
            MockCursorHelper.SetupFindAsync(_collection, timelines);
            MockCursorHelper.SetupCountDocuments(_collection, 1);

            _dbContextProvider.Setup(x => x.GetDatabase("root-tenant")).Returns(_rootDatabase.Object);

            var users = new List<User>
            {
                new User { ItemId = "u1", FirstName = "John", LastName = null, Email = "john@test.com" }
            };
            MockCursorHelper.SetupFindAsync(_usersCollection, users);

            var request = new GetKeyTimelineRequest { EntityId = "e1", PageNumber = 1, PageSize = 10 };
            var result = await _repo.GetKeyTimelineAsync(request);

            result.Timelines[0].UserName.Should().Be("John");
        }

        [Fact]
        public async Task GetKeyTimelineAsync_UserWithNoNameNoEmail_FallsBackToUserId()
        {
            var timelines = new List<KeyTimeline>
            {
                new KeyTimeline { ItemId = "t1", EntityId = "e1", UserId = "u1", CreateDate = DateTime.UtcNow }
            };
            MockCursorHelper.SetupFindAsync(_collection, timelines);
            MockCursorHelper.SetupCountDocuments(_collection, 1);

            _dbContextProvider.Setup(x => x.GetDatabase("root-tenant")).Returns(_rootDatabase.Object);

            var users = new List<User>
            {
                new User { ItemId = "u1", FirstName = null, LastName = null, Email = null }
            };
            MockCursorHelper.SetupFindAsync(_usersCollection, users);

            var request = new GetKeyTimelineRequest { EntityId = "e1", PageNumber = 1, PageSize = 10 };
            var result = await _repo.GetKeyTimelineAsync(request);

            result.Timelines[0].UserName.Should().Be("u1");
        }

        #endregion

        #region GetTimelineByItemIdAsync

        [Fact]
        public async Task GetTimelineByItemIdAsync_ReturnsTimeline_WhenFound()
        {
            var timeline = new KeyTimeline { ItemId = "t1", EntityId = "e1", UserId = "u1" };
            MockCursorHelper.SetupFindAsync(_collection, new List<KeyTimeline> { timeline });

            var result = await _repo.GetTimelineByItemIdAsync("t1");

            result.Should().NotBeNull();
            result!.ItemId.Should().Be("t1");
        }

        [Fact]
        public async Task GetTimelineByItemIdAsync_ReturnsNull_WhenNotFound()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_collection);

            var result = await _repo.GetTimelineByItemIdAsync("nonexistent");

            result.Should().BeNull();
        }

        #endregion

        #region GetTimelineByOperationIdAsync

        [Fact]
        public async Task GetTimelineByOperationIdAsync_ReturnsTimelinesAndCount()
        {
            var timelines = new List<KeyTimeline>
            {
                new KeyTimeline { ItemId = "t1", EntityId = "e1", UserId = "u1", OperationId = "op1", CreateDate = DateTime.UtcNow },
                new KeyTimeline { ItemId = "t2", EntityId = "e2", UserId = "u1", OperationId = "op1", CreateDate = DateTime.UtcNow }
            };
            MockCursorHelper.SetupFindAsync(_collection, timelines);
            MockCursorHelper.SetupCountDocuments(_collection, 2);

            _dbContextProvider.Setup(x => x.GetDatabase("root-tenant")).Returns(_rootDatabase.Object);
            var users = new List<User>
            {
                new User { ItemId = "u1", FirstName = "John", LastName = "Doe", Email = "john@test.com" }
            };
            MockCursorHelper.SetupFindAsync(_usersCollection, users);

            var request = new GetTimelineByOperationIdRequest { OperationId = "op1", PageNumber = 1, PageSize = 10 };
            var result = await _repo.GetTimelineByOperationIdAsync(request);

            result.Should().NotBeNull();
            result.TotalCount.Should().Be(2);
            result.Timelines.Should().HaveCount(2);
            result.Timelines[0].UserName.Should().Be("John Doe");
        }

        [Fact]
        public async Task GetTimelineByOperationIdAsync_EmptyResult_ReturnsEmptyList()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_collection);
            MockCursorHelper.SetupCountDocuments(_collection, 0);

            var request = new GetTimelineByOperationIdRequest { OperationId = "nonexistent", PageNumber = 1, PageSize = 10 };
            var result = await _repo.GetTimelineByOperationIdAsync(request);

            result.Should().NotBeNull();
            result.TotalCount.Should().Be(0);
            result.Timelines.Should().BeEmpty();
        }

        [Fact]
        public async Task GetTimelineByOperationIdAsync_PopulatesUserName_FallsBackToEmail()
        {
            var timelines = new List<KeyTimeline>
            {
                new KeyTimeline { ItemId = "t1", EntityId = "e1", UserId = "u1", OperationId = "op1", CreateDate = DateTime.UtcNow }
            };
            MockCursorHelper.SetupFindAsync(_collection, timelines);
            MockCursorHelper.SetupCountDocuments(_collection, 1);

            _dbContextProvider.Setup(x => x.GetDatabase("root-tenant")).Returns(_rootDatabase.Object);
            var users = new List<User>
            {
                new User { ItemId = "u1", FirstName = null, LastName = null, Email = "john@test.com" }
            };
            MockCursorHelper.SetupFindAsync(_usersCollection, users);

            var request = new GetTimelineByOperationIdRequest { OperationId = "op1", PageNumber = 1, PageSize = 10 };
            var result = await _repo.GetTimelineByOperationIdAsync(request);

            result.Timelines[0].UserName.Should().Be("john@test.com");
        }

        [Fact]
        public async Task GetTimelineByOperationIdAsync_NullUserId_SetsUnknown()
        {
            var timelines = new List<KeyTimeline>
            {
                new KeyTimeline { ItemId = "t1", EntityId = "e1", UserId = null, OperationId = "op1", CreateDate = DateTime.UtcNow }
            };
            MockCursorHelper.SetupFindAsync(_collection, timelines);
            MockCursorHelper.SetupCountDocuments(_collection, 1);

            var request = new GetTimelineByOperationIdRequest { OperationId = "op1", PageNumber = 1, PageSize = 10 };
            var result = await _repo.GetTimelineByOperationIdAsync(request);

            result.Timelines[0].UserName.Should().Be("Unknown");
        }

        [Fact]
        public async Task GetTimelineByOperationIdAsync_UserWithNoNameNoEmail_FallsBackToUserId()
        {
            var timelines = new List<KeyTimeline>
            {
                new KeyTimeline { ItemId = "t1", EntityId = "e1", UserId = "u1", OperationId = "op1", CreateDate = DateTime.UtcNow }
            };
            MockCursorHelper.SetupFindAsync(_collection, timelines);
            MockCursorHelper.SetupCountDocuments(_collection, 1);

            _dbContextProvider.Setup(x => x.GetDatabase("root-tenant")).Returns(_rootDatabase.Object);
            var users = new List<User>
            {
                new User { ItemId = "u1", FirstName = null, LastName = null, Email = null }
            };
            MockCursorHelper.SetupFindAsync(_usersCollection, users);

            var request = new GetTimelineByOperationIdRequest { OperationId = "op1", PageNumber = 1, PageSize = 10 };
            var result = await _repo.GetTimelineByOperationIdAsync(request);

            result.Timelines[0].UserName.Should().Be("u1");
        }

        #endregion

        #region GetLocalizationTimelineAsync

        private static BsonDocument Group(string operationId, string? logFrom, string? userId, DateTime createDate, string firstItemId, int count)
        {
            var group = new BsonDocument { { "_id", operationId }, { "CreateDate", createDate }, { "FirstItemId", firstItemId }, { "Count", count } };
            if (logFrom != null) group.Add("LogFrom", logFrom);
            if (userId != null) group.Add("UserId", userId);
            return group;
        }

        /// <summary>The single $facet output document: Total [{Count}] and the Data page.</summary>
        private static BsonDocument Facet(long total, params BsonDocument[] groups) => new()
        {
            { "Total", total > 0 ? new BsonArray { new BsonDocument("Count", total) } : new BsonArray() },
            { "Data", new BsonArray(groups) }
        };

        private List<BsonDocument> SetupOverview(BsonDocument? facet, Action<PipelineDefinition<KeyTimeline, BsonDocument>, AggregateOptions>? callback = null)
        {
            var results = facet == null ? new List<BsonDocument>() : new List<BsonDocument> { facet };
            MockCursorHelper.SetupAggregateAsync(_collection, results, callback);
            return results;
        }

        private static List<BsonDocument> Render(PipelineDefinition<KeyTimeline, BsonDocument> pipeline)
        {
            var registry = MongoDB.Bson.Serialization.BsonSerializer.SerializerRegistry;
            return pipeline.Render(new RenderArgs<KeyTimeline>(registry.GetSerializer<KeyTimeline>(), registry)).Documents.ToList();
        }

        private async Task<List<BsonDocument>> RenderedStagesFor(GetLocalizationTimelineRequest request, BsonDocument? facet = null)
        {
            PipelineDefinition<KeyTimeline, BsonDocument>? captured = null;
            SetupOverview(facet ?? Facet(0), (p, _) => captured = p);
            await _repo.GetLocalizationTimelineAsync(request);
            captured.Should().NotBeNull();
            return Render(captured!);
        }

        private void VerifySnapshotQuery(Times times) =>
            _collection.Verify(x => x.FindAsync(
                It.IsAny<FilterDefinition<KeyTimeline>>(),
                It.IsAny<FindOptions<KeyTimeline, KeyTimeline>>(),
                It.IsAny<CancellationToken>()), times);

        [Fact]
        public async Task GetLocalizationTimelineAsync_GroupsByOperationId_WithCountsAndUserNames()
        {
            var now = DateTime.UtcNow;
            // op1 has two entries -> AffectedKeysCount 2, CurrentData null; op2 has one entry -> CurrentData populated
            SetupOverview(Facet(2,
                Group("op1", "TranslateAll", "u1", now, "t1", 2),
                Group("op2", "KeyController.Save", "u2", now.AddMinutes(-5), "t3", 1)));
            MockCursorHelper.SetupFindAsync(_collection, new List<KeyTimeline>
            {
                new KeyTimeline { ItemId = "t3", OperationId = "op2", LogFrom = "KeyController.Save", UserId = "u2", CreateDate = now.AddMinutes(-5),
                    CurrentData = new BlocksLanguageKey { ItemId = "k1", KeyName = "welcome", ModuleId = "m1" } }
            });
            _dbContextProvider.Setup(x => x.GetDatabase("root-tenant")).Returns(_rootDatabase.Object);
            MockCursorHelper.SetupFindAsync(_usersCollection, new List<User>
            {
                new User { ItemId = "u1", FirstName = "Jane", LastName = "Doe" },
                new User { ItemId = "u2", Email = "u2@test.com" }
            });

            var request = new GetLocalizationTimelineRequest { PageNumber = 1, PageSize = 10, IsDescending = true };
            var result = await _repo.GetLocalizationTimelineAsync(request);

            result.TotalCount.Should().Be(2);
            result.Operations.Should().HaveCount(2);
            var op1 = result.Operations.First(o => o.OperationId == "op1");
            op1.AffectedKeysCount.Should().Be(2);
            op1.CurrentData.Should().BeNull();
            op1.UserName.Should().Be("Jane Doe");
            var op2 = result.Operations.First(o => o.OperationId == "op2");
            op2.AffectedKeysCount.Should().Be(1);
            op2.CurrentData.Should().NotBeNull();
            op2.CurrentData!.KeyName.Should().Be("welcome");
            op2.UserName.Should().Be("u2@test.com");
        }

        [Fact]
        public async Task GetLocalizationTimelineAsync_AscendingWithFilters_ReturnsOperations()
        {
            var now = DateTime.UtcNow;
            SetupOverview(Facet(2,
                Group("op1", "TranslateAll", "u1", now.AddMinutes(-1), "t1", 1),
                Group("op2", "TranslateAll", null, now, "t2", 1)));
            MockCursorHelper.SetupFindAsync(_collection, new List<KeyTimeline>
            {
                new KeyTimeline { ItemId = "t1", OperationId = "op1", LogFrom = "TranslateAll", UserId = "u1", CreateDate = now.AddMinutes(-1) },
                new KeyTimeline { ItemId = "t2", OperationId = "op2", LogFrom = "TranslateAll", UserId = null, CreateDate = now }
            });
            _dbContextProvider.Setup(x => x.GetDatabase("root-tenant")).Returns(_rootDatabase.Object);
            MockCursorHelper.SetupFindAsyncEmpty(_usersCollection);

            var request = new GetLocalizationTimelineRequest
            {
                PageNumber = 1,
                PageSize = 10,
                IsDescending = false,
                UserId = "u1",
                LogFrom = "TranslateAll",
                LogFromValues = new List<string> { "TranslateAll" },
                ExcludeLogFromValues = new List<string> { "Rollback" },
                CreateDateRange = new DateRange { StartDate = now.AddDays(-1), EndDate = now.AddDays(1) }
            };
            var result = await _repo.GetLocalizationTimelineAsync(request);

            result.Operations.Should().HaveCount(2);
            // Ascending order by CreateDate (sorted by the server; the pipeline tests pin the direction).
            result.Operations[0].CreateDate.Should().BeOnOrBefore(result.Operations[1].CreateDate);
            // A null UserId op falls back to "Unknown".
            result.Operations.Should().Contain(o => o.UserName == "Unknown");
        }

        [Fact]
        public async Task GetLocalizationTimelineAsync_EmptyResult_ReturnsEmpty()
        {
            SetupOverview(Facet(0));

            var request = new GetLocalizationTimelineRequest { PageNumber = 1, PageSize = 10 };
            var result = await _repo.GetLocalizationTimelineAsync(request);

            result.TotalCount.Should().Be(0);
            result.Operations.Should().BeEmpty();
            VerifySnapshotQuery(Times.Never());
            _dbContextProvider.Verify(x => x.GetDatabase("root-tenant"), Times.Never);
        }

        [Fact]
        public async Task GetLocalizationTimelineAsync_NoFacetDocument_ReturnsEmpty()
        {
            SetupOverview(null);

            var result = await _repo.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest());

            result.TotalCount.Should().Be(0);
            result.Operations.Should().BeEmpty();
        }

        [Theory]
        [InlineData(true, -1)]
        [InlineData(false, 1)]
        public async Task GetLocalizationTimelineAsync_Pipeline_SortsGroupsAndPagesOnServer(bool isDescending, int direction)
        {
            AggregateOptions? options = null;
            PipelineDefinition<KeyTimeline, BsonDocument>? captured = null;
            SetupOverview(Facet(0), (p, o) => { captured = p; options = o; });

            await _repo.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest { PageNumber = 3, PageSize = 10, IsDescending = isDescending });

            options!.AllowDiskUse.Should().BeTrue();
            var stages = Render(captured!);
            stages.Select(s => s.GetElement(0).Name).Should().Equal("$match", "$sort", "$group", "$sort", "$facet");
            stages[1]["$sort"].Should().Be(new BsonDocument("CreateDate", direction));
            stages[2]["$group"].Should().Be(new BsonDocument
            {
                { "_id", "$OperationId" },
                { "LogFrom", new BsonDocument("$first", "$LogFrom") },
                { "UserId", new BsonDocument("$first", "$UserId") },
                { "CreateDate", new BsonDocument("$first", "$CreateDate") },
                { "FirstItemId", new BsonDocument("$first", "$_id") },
                { "Count", new BsonDocument("$sum", 1) }
            });
            stages[3]["$sort"].Should().Be(new BsonDocument { { "CreateDate", direction }, { "_id", direction } });
            stages[4]["$facet"].Should().Be(new BsonDocument
            {
                { "Total", new BsonArray { new BsonDocument("$count", "Count") } },
                { "Data", new BsonArray { new BsonDocument("$skip", 20L), new BsonDocument("$limit", 10) } }
            });
        }

        [Theory]
        [InlineData(1, 10, 0L)]
        [InlineData(2, 10, 10L)]
        [InlineData(5, 3, 12L)]
        [InlineData(0, 1, 0L)]
        [InlineData(-4, 10, 0L)]
        [InlineData(int.MaxValue, 10, 21474836460L)]
        public async Task GetLocalizationTimelineAsync_Paging_SkipIsComputedAsLongWithoutOverflow(int pageNumber, int pageSize, long expectedSkip)
        {
            var stages = await RenderedStagesFor(new GetLocalizationTimelineRequest { PageNumber = pageNumber, PageSize = pageSize });

            var data = stages[4]["$facet"]["Data"].AsBsonArray;
            data[0]["$skip"].Should().Be(new BsonInt64(expectedSkip));
            data[1]["$limit"].Should().Be(new BsonInt32(pageSize));
        }

        [Fact]
        public async Task GetLocalizationTimelineAsync_PageNumberMaxValue_ReturnsTotalWithEmptyPage()
        {
            SetupOverview(Facet(2));

            var result = await _repo.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest { PageNumber = int.MaxValue, PageSize = 10 });

            result.TotalCount.Should().Be(2);
            result.Operations.Should().BeEmpty();
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-1)]
        public async Task GetLocalizationTimelineAsync_NonPositivePageSize_ReturnsTotalOnly_WithoutLimitStage(int pageSize)
        {
            PipelineDefinition<KeyTimeline, BsonDocument>? captured = null;
            var facet = new BsonDocument("Total", new BsonArray { new BsonDocument("Count", 2) });
            SetupOverview(facet, (p, _) => captured = p);

            var result = await _repo.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest { PageNumber = 1, PageSize = pageSize });

            result.TotalCount.Should().Be(2);
            result.Operations.Should().BeEmpty();
            Render(captured!)[4]["$facet"].Should().Be(new BsonDocument("Total", new BsonArray { new BsonDocument("$count", "Count") }));
            VerifySnapshotQuery(Times.Never());
        }

        [Fact]
        public async Task GetLocalizationTimelineAsync_Filters_UseTheSameOperatorsAsBefore()
        {
            var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var end = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);
            var stages = await RenderedStagesFor(new GetLocalizationTimelineRequest
            {
                UserId = "u1",
                LogFrom = "TranslateAll",
                LogFromValues = new List<string> { "TranslateAll", "Published" },
                ExcludeLogFromValues = new List<string> { "Rollback" },
                CreateDateRange = new DateRange { StartDate = start, EndDate = end }
            });

            stages[0]["$match"].Should().Be(new BsonDocument("$and", new BsonArray
            {
                new BsonDocument("OperationId", new BsonDocument("$ne", BsonNull.Value)),
                new BsonDocument("OperationId", new BsonDocument("$ne", "")),
                new BsonDocument("UserId", "u1"),
                new BsonDocument("LogFrom", "TranslateAll"),
                new BsonDocument("LogFrom", new BsonDocument("$in", new BsonArray { "TranslateAll", "Published" })),
                new BsonDocument("LogFrom", new BsonDocument("$nin", new BsonArray { "Rollback" })),
                new BsonDocument("CreateDate", new BsonDocument("$gte", start)),
                new BsonDocument("CreateDate", new BsonDocument("$lte", end))
            }));
        }

        [Fact]
        public async Task GetLocalizationTimelineAsync_NoFilters_MatchesOnlyEntriesWithAnOperationId()
        {
            var stages = await RenderedStagesFor(new GetLocalizationTimelineRequest());

            stages[0]["$match"].Should().Be(new BsonDocument("$and", new BsonArray
            {
                new BsonDocument("OperationId", new BsonDocument("$ne", BsonNull.Value)),
                new BsonDocument("OperationId", new BsonDocument("$ne", ""))
            }));
        }

        [Fact]
        public async Task GetLocalizationTimelineAsync_KeepsServerOrder()
        {
            var now = DateTime.UtcNow;
            // Deliberately not in CreateDate order: the repository must not re-sort the page in memory.
            SetupOverview(Facet(3,
                Group("b", "Published", null, now.AddMinutes(-10), "t-b", 2),
                Group("c", "Published", null, now, "t-c", 2),
                Group("a", "Published", null, now.AddMinutes(-5), "t-a", 2)));

            var result = await _repo.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest());

            result.Operations.Select(o => o.OperationId).Should().Equal("b", "c", "a");
        }

        [Fact]
        public async Task GetLocalizationTimelineAsync_MissingGroupFields_ReturnNullAndUnknown()
        {
            var now = DateTime.UtcNow;
            var nullFields = Group("op-null", null, null, now, "t1", 2);
            nullFields.Add("LogFrom", BsonNull.Value).Add("UserId", BsonNull.Value);
            SetupOverview(Facet(3,
                Group("op-missing", null, null, now, "t0", 2),
                nullFields,
                Group("op-empty-user", "Published", "", now, "t2", 2)));

            var result = await _repo.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest());

            result.Operations.Should().HaveCount(3);
            result.Operations[0].LogFrom.Should().BeNull();
            result.Operations[0].UserId.Should().BeNull();
            result.Operations[0].UserName.Should().Be("Unknown");
            result.Operations[1].LogFrom.Should().BeNull();
            result.Operations[1].UserName.Should().Be("Unknown");
            // Unchanged rule (Q3): an empty UserId stays empty.
            result.Operations[2].UserName.Should().Be("");
            _dbContextProvider.Verify(x => x.GetDatabase("root-tenant"), Times.Never);
        }

        [Fact]
        public async Task GetLocalizationTimelineAsync_SingleEntryDeletedBeforeSnapshotFetch_ReturnsNullSnapshots()
        {
            SetupOverview(Facet(1, Group("op-c", "KeyController.Save", null, DateTime.UtcNow, "t-c", 1)));
            MockCursorHelper.SetupFindAsyncEmpty(_collection);

            var result = await _repo.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest());

            var op = result.Operations.Should().ContainSingle().Subject;
            op.OperationId.Should().Be("op-c");
            op.AffectedKeysCount.Should().Be(1);
            op.CurrentData.Should().BeNull();
            op.PreviousData.Should().BeNull();
        }

        [Fact]
        public async Task GetLocalizationTimelineAsync_SingleEntrySnapshots_FetchedOnlyForThePagesSingleEntryOperations()
        {
            var now = DateTime.UtcNow;
            SetupOverview(Facet(5,
                Group("single-1", "KeyController.Save", null, now, "t-1", 1),
                Group("multi", "Published", null, now, "t-m", 4),
                Group("single-2", "KeyController.Save", null, now, "t-2", 1)));
            FilterDefinition<KeyTimeline>? snapshotFilter = null;
            var cursor = MockCursorHelper.CreateCursor(new List<KeyTimeline>
            {
                new KeyTimeline { ItemId = "t-2", CurrentData = new BlocksLanguageKey { KeyName = "two" }, PreviousData = new BlocksLanguageKey { KeyName = "two-before" } },
                new KeyTimeline { ItemId = "t-1", CurrentData = new BlocksLanguageKey { KeyName = "one" } }
            });
            _collection.Setup(x => x.FindAsync(It.IsAny<FilterDefinition<KeyTimeline>>(), It.IsAny<FindOptions<KeyTimeline, KeyTimeline>>(), It.IsAny<CancellationToken>()))
                .Callback<FilterDefinition<KeyTimeline>, FindOptions<KeyTimeline, KeyTimeline>, CancellationToken>((f, _, _) => snapshotFilter = f)
                .ReturnsAsync(cursor.Object);

            var result = await _repo.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest());

            VerifySnapshotQuery(Times.Once());
            var registry = MongoDB.Bson.Serialization.BsonSerializer.SerializerRegistry;
            ((BsonValue)snapshotFilter!.Render(new RenderArgs<KeyTimeline>(registry.GetSerializer<KeyTimeline>(), registry)))
                .Should().Be(new BsonDocument("_id", new BsonDocument("$in", new BsonArray { "t-1", "t-2" })));
            result.Operations[0].CurrentData!.KeyName.Should().Be("one");
            result.Operations[0].PreviousData.Should().BeNull();
            result.Operations[1].CurrentData.Should().BeNull();
            result.Operations[2].CurrentData!.KeyName.Should().Be("two");
            result.Operations[2].PreviousData!.KeyName.Should().Be("two-before");
        }

        [Fact]
        public async Task GetLocalizationTimelineAsync_OnlyMultiEntryOperations_SkipsSnapshotQuery()
        {
            SetupOverview(Facet(2,
                Group("a", "Published", null, DateTime.UtcNow, "t-a", 2),
                Group("b", "Published", null, DateTime.UtcNow, "t-b", 9225)));

            var result = await _repo.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest());

            result.Operations.Should().OnlyContain(o => o.CurrentData == null && o.PreviousData == null);
            VerifySnapshotQuery(Times.Never());
        }

        [Fact]
        public async Task GetLocalizationTimelineAsync_LooksUpUsersOnlyForThePage()
        {
            SetupOverview(Facet(40,
                Group("a", "Published", "u1", DateTime.UtcNow, "t-a", 2),
                Group("b", "Published", "u2", DateTime.UtcNow, "t-b", 2),
                Group("c", "Published", "u1", DateTime.UtcNow, "t-c", 2),
                Group("d", "Published", "u3", DateTime.UtcNow, "t-d", 2)));
            _dbContextProvider.Setup(x => x.GetDatabase("root-tenant")).Returns(_rootDatabase.Object);
            FilterDefinition<User>? userFilter = null;
            var cursor = MockCursorHelper.CreateCursor(new List<User>
            {
                // Name wins over email; a last name alone is used; no name or email falls back to the ID.
                new User { ItemId = "u1", FirstName = "Ada", Email = "ada@example.test" },
                new User { ItemId = "u2" },
                new User { ItemId = "u3", LastName = "Doe", Email = "doe@example.test" }
            });
            _usersCollection.Setup(x => x.FindAsync(It.IsAny<FilterDefinition<User>>(), It.IsAny<FindOptions<User, User>>(), It.IsAny<CancellationToken>()))
                .Callback<FilterDefinition<User>, FindOptions<User, User>, CancellationToken>((f, _, _) => userFilter = f)
                .ReturnsAsync(cursor.Object);

            var result = await _repo.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest());

            var registry = MongoDB.Bson.Serialization.BsonSerializer.SerializerRegistry;
            ((BsonValue)userFilter!.Render(new RenderArgs<User>(registry.GetSerializer<User>(), registry)))
                .Should().Be(new BsonDocument("_id", new BsonDocument("$in", new BsonArray { "u1", "u2", "u3" })));
            result.Operations.Select(o => o.UserName).Should().Equal("Ada", "u2", "Ada", "Doe");
        }

        [Fact]
        public async Task GetLocalizationTimelineAsync_RunsOnlyAgainstTheRequestTenantsDatabase()
        {
            TestBlocksContext.Set("tenant-a");
            var tenantDb = new Mock<IMongoDatabase>();
            tenantDb.Setup(x => x.GetCollection<KeyTimeline>("KeyTimelines", null)).Returns(_collection.Object);
            tenantDb.Setup(x => x.DatabaseNamespace).Returns(new DatabaseNamespace("tenant-a-" + Guid.NewGuid().ToString("N")));
            _dbContextProvider.Setup(x => x.GetDatabase("tenant-a")).Returns(tenantDb.Object);
            SetupOverview(Facet(1, Group("op", "KeyController.Save", null, DateTime.UtcNow, "t1", 1)));
            MockCursorHelper.SetupFindAsyncEmpty(_collection);

            try
            {
                await _repo.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest());
            }
            finally
            {
                BlocksContext.ClearContext();
            }

            _dbContextProvider.Verify(x => x.GetDatabase("tenant-a"), Times.Once);
            _dbContextProvider.Verify(x => x.GetDatabase(It.Is<string>(t => t != "tenant-a")), Times.Never);
            _database.Verify(x => x.GetCollection<KeyTimeline>(It.IsAny<string>(), null), Times.Never);
            VerifySnapshotQuery(Times.Once());
        }

        [Fact]
        public async Task GetLocalizationTimelineAsync_MongoUnavailable_Throws()
        {
            _collection.Setup(x => x.AggregateAsync(It.IsAny<PipelineDefinition<KeyTimeline, BsonDocument>>(), It.IsAny<AggregateOptions>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new TimeoutException("server selection timed out"));

            var act = () => _repo.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest());

            await act.Should().ThrowAsync<TimeoutException>();
        }

        [Fact]
        public async Task GetLocalizationTimelineAsync_EnsuresTheCreateDateIndexOncePerDatabase()
        {
            SetupOverview(Facet(0));
            var created = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            _indexes.Setup(x => x.CreateManyAsync(It.IsAny<IEnumerable<CreateIndexModel<KeyTimeline>>>(), It.IsAny<CancellationToken>()))
                .Callback(() => created.TrySetResult())
                .ReturnsAsync(new List<string> { "ix_CreateDate_desc" });

            await _repo.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest());
            // The request does not await the creation; wait for the background task it started.
            await created.Task.WaitAsync(TimeSpan.FromSeconds(10));
            await _repo.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest());
            // Returns the cached task (no new creation when the cache works) and waits for it.
            await MongoIndexEnsurer.EnsureAsync(_database.Object, "KeyTimelines", KeyTimelineRepository.OverviewIndexes, NullLogger.Instance);

            _indexes.Verify(x => x.CreateManyAsync(
                It.Is<IEnumerable<CreateIndexModel<KeyTimeline>>>(m => m.Single().Options.Name == "ix_CreateDate_desc"),
                It.IsAny<CancellationToken>()), Times.Once);
            var registry = MongoDB.Bson.Serialization.BsonSerializer.SerializerRegistry;
            ((BsonValue)KeyTimelineRepository.OverviewIndexes.Single().Keys
                .Render(new RenderArgs<KeyTimeline>(registry.GetSerializer<KeyTimeline>(), registry)))
                .Should().Be(new BsonDocument("CreateDate", -1));
        }

        [Fact]
        public async Task GetLocalizationTimelineAsync_DoesNotWaitForTheIndexBuild()
        {
            SetupOverview(Facet(0));
            var neverCompletes = new TaskCompletionSource<IEnumerable<string>>();
            _indexes.Setup(x => x.CreateManyAsync(It.IsAny<IEnumerable<CreateIndexModel<KeyTimeline>>>(), It.IsAny<CancellationToken>()))
                .Returns(neverCompletes.Task);

            var request = _repo.GetLocalizationTimelineAsync(new GetLocalizationTimelineRequest());

            var result = await request.WaitAsync(TimeSpan.FromSeconds(10));
            result.TotalCount.Should().Be(0);
        }

        #endregion

        #region GetLatestPublishTimelinesAsync

        [Fact]
        public async Task GetLatestPublishTimelinesAsync_EmptyEntityIds_ReturnsEmptyWithoutQuerying()
        {
            var result = await _repo.GetLatestPublishTimelinesAsync(new List<string>(), "pub-tenant");

            result.Should().BeEmpty();
            _dbContextProvider.Verify(x => x.GetDatabase("pub-tenant"), Times.Never);
        }

        [Fact]
        public async Task GetLatestPublishTimelinesAsync_ReturnsServerGroupedLatestPerEntity()
        {
            var now = DateTime.UtcNow;
            // The server pipeline already reduces to one (latest) entry per entity.
            var timelines = new List<KeyTimeline>
            {
                new KeyTimeline { ItemId = "t1", EntityId = "e1", LogFrom = LogFromConstants.Published, CreateDate = now },
                new KeyTimeline { ItemId = "t3", EntityId = "e2", LogFrom = LogFromConstants.Published, CreateDate = now.AddMinutes(-1) }
            };
            SetupAggregate(timelines);

            var result = await _repo.GetLatestPublishTimelinesAsync(new List<string> { "e1", "e2" }, "pub-tenant");

            result.Should().HaveCount(2);
            result["e1"].ItemId.Should().Be("t1");
            result["e2"].ItemId.Should().Be("t3");
            _dbContextProvider.Verify(x => x.GetDatabase("pub-tenant"), Times.Once);
            _collection.Verify(x => x.FindAsync(
                It.IsAny<FilterDefinition<KeyTimeline>>(),
                It.IsAny<FindOptions<KeyTimeline, KeyTimeline>>(),
                It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task GetLatestPublishTimelinesAsync_GroupsOnServerAndDropsPreviousData()
        {
            PipelineDefinition<KeyTimeline, KeyTimeline>? captured = null;
            AggregateOptions? capturedOptions = null;
            SetupAggregate(new List<KeyTimeline>(), (p, o) => { captured = p; capturedOptions = o; });

            await _repo.GetLatestPublishTimelinesAsync(new List<string> { "e1" }, "pub-tenant");

            captured.Should().NotBeNull();
            capturedOptions!.AllowDiskUse.Should().BeTrue();

            var registry = MongoDB.Bson.Serialization.BsonSerializer.SerializerRegistry;
            var stages = captured!.Render(new RenderArgs<KeyTimeline>(registry.GetSerializer<KeyTimeline>(), registry)).Documents.ToList();
            var json = string.Join("\n", stages.Select(s => s.ToJson()));

            stages[0].Contains("$match").Should().BeTrue();
            json.Should().Contain("\"PreviousData\" : 0");
            json.Should().Contain("$group");
            json.Should().Contain("$first");
        }

        [Fact]
        public async Task GetLatestPublishTimelinesAsync_SkipsEntriesWithoutEntityId()
        {
            SetupAggregate(new List<KeyTimeline>
            {
                new KeyTimeline { ItemId = "t1", EntityId = null, LogFrom = LogFromConstants.Published },
                new KeyTimeline { ItemId = "t2", EntityId = "e1", LogFrom = LogFromConstants.Published }
            });

            var result = await _repo.GetLatestPublishTimelinesAsync(new List<string> { "e1" }, "pub-tenant");

            result.Should().ContainSingle().Which.Key.Should().Be("e1");
        }

        private void SetupAggregate(List<KeyTimeline> items, Action<PipelineDefinition<KeyTimeline, KeyTimeline>, AggregateOptions>? callback = null)
        {
            var cursor = MockCursorHelper.CreateCursor(items);
            _collection.Setup(x => x.AggregateAsync(
                    It.IsAny<PipelineDefinition<KeyTimeline, KeyTimeline>>(),
                    It.IsAny<AggregateOptions>(),
                    It.IsAny<CancellationToken>()))
                .Callback<PipelineDefinition<KeyTimeline, KeyTimeline>, AggregateOptions, CancellationToken>((p, o, _) => callback?.Invoke(p, o))
                .ReturnsAsync(cursor.Object);
        }

        #endregion
    }
}
