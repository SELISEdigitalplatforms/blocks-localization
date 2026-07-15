using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared.Entities;
using FluentAssertions;
using Moq;
using MongoDB.Driver;
using Microsoft.Extensions.Configuration;
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

            // Setup for root database (user lookup)
            _configuration.Setup(x => x[It.Is<string>(s => s == "RootTenantId")]).Returns("root-tenant");
            _rootDatabase.Setup(x => x.GetCollection<User>(It.IsAny<string>(), null)).Returns(_usersCollection.Object);

            _repo = new KeyTimelineRepository(_dbContextProvider.Object, _configuration.Object);
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

        [Fact]
        public async Task GetLocalizationTimelineAsync_GroupsByOperationId_WithCountsAndUserNames()
        {
            var now = DateTime.UtcNow;
            var timelines = new List<KeyTimeline>
            {
                // op1 has two entries -> AffectedKeysCount 2, CurrentData null
                new KeyTimeline { ItemId = "t1", OperationId = "op1", LogFrom = "TranslateAll", UserId = "u1", CreateDate = now },
                new KeyTimeline { ItemId = "t2", OperationId = "op1", LogFrom = "TranslateAll", UserId = "u1", CreateDate = now },
                // op2 has one entry -> CurrentData populated
                new KeyTimeline { ItemId = "t3", OperationId = "op2", LogFrom = "KeyController.Save", UserId = "u2", CreateDate = now.AddMinutes(-5),
                    CurrentData = new BlocksLanguageKey { ItemId = "k1", KeyName = "welcome", ModuleId = "m1" } }
            };
            MockCursorHelper.SetupFindAsync(_collection, timelines);
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
            op2.UserName.Should().Be("u2@test.com");
        }

        [Fact]
        public async Task GetLocalizationTimelineAsync_AscendingWithFilters_ReturnsOperations()
        {
            var now = DateTime.UtcNow;
            var timelines = new List<KeyTimeline>
            {
                new KeyTimeline { ItemId = "t1", OperationId = "op1", LogFrom = "TranslateAll", UserId = "u1", CreateDate = now.AddMinutes(-1) },
                new KeyTimeline { ItemId = "t2", OperationId = "op2", LogFrom = "TranslateAll", UserId = null, CreateDate = now }
            };
            MockCursorHelper.SetupFindAsync(_collection, timelines);
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
            // Ascending order by CreateDate.
            result.Operations[0].CreateDate.Should().BeOnOrBefore(result.Operations[1].CreateDate);
            // A null UserId op falls back to "Unknown".
            result.Operations.Should().Contain(o => o.UserName == "Unknown");
        }

        [Fact]
        public async Task GetLocalizationTimelineAsync_EmptyResult_ReturnsEmpty()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_collection);

            var request = new GetLocalizationTimelineRequest { PageNumber = 1, PageSize = 10 };
            var result = await _repo.GetLocalizationTimelineAsync(request);

            result.TotalCount.Should().Be(0);
            result.Operations.Should().BeEmpty();
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
        public async Task GetLatestPublishTimelinesAsync_GroupsByEntityId_ReturnsLatestPerEntity()
        {
            var now = DateTime.UtcNow;
            // Descending sort means the first per group is the latest.
            var timelines = new List<KeyTimeline>
            {
                new KeyTimeline { ItemId = "t1", EntityId = "e1", LogFrom = LogFromConstants.Published, CreateDate = now },
                new KeyTimeline { ItemId = "t2", EntityId = "e1", LogFrom = LogFromConstants.Published, CreateDate = now.AddMinutes(-10) },
                new KeyTimeline { ItemId = "t3", EntityId = "e2", LogFrom = LogFromConstants.Published, CreateDate = now.AddMinutes(-1) }
            };
            MockCursorHelper.SetupFindAsync(_collection, timelines);

            var result = await _repo.GetLatestPublishTimelinesAsync(new List<string> { "e1", "e2" }, "pub-tenant");

            result.Should().HaveCount(2);
            result["e1"].ItemId.Should().Be("t1");
            result["e2"].ItemId.Should().Be("t3");
            _dbContextProvider.Verify(x => x.GetDatabase("pub-tenant"), Times.Once);
        }

        #endregion
    }
}
