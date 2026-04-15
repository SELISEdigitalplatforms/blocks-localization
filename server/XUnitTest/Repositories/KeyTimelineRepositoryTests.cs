using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Shared.Entities;
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
    }
}
