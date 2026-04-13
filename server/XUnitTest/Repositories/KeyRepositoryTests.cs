using System;
using System.Collections.Generic;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Shared.Entities;
using FluentAssertions;
using Moq;
using MongoDB.Bson;
using MongoDB.Driver;
using Xunit;
using BlocksTemplate.XUnitTest.Shared;

namespace BlocksTemplate.XUnitTest.Repositories
{
    public class KeyRepositoryTests
    {
        private readonly Mock<IDbContextProvider> _dbContextProvider;
        private readonly Mock<IMongoDatabase> _database;
        private readonly Mock<IMongoCollection<BlocksLanguageKey>> _blkCollection;
        private readonly Mock<IMongoCollection<Key>> _keyCollection;
        private readonly Mock<IMongoCollection<UilmFile>> _uilmFileCollection;
        private readonly Mock<IMongoCollection<BsonDocument>> _bsonCollection;
        private readonly Mock<IMongoCollection<UilmExportedFile>> _exportedFileCollection;
        private readonly Mock<IMongoCollection<BlocksLanguage>> _blocksLanguageCollection;
        private readonly Mock<IMongoCollection<BlocksLanguageModule>> _moduleCollection;
        private readonly KeyRepository _repo;

        public KeyRepositoryTests()
        {
            _dbContextProvider = new Mock<IDbContextProvider>();
            _database = new Mock<IMongoDatabase>();
            _blkCollection = new Mock<IMongoCollection<BlocksLanguageKey>>();
            _keyCollection = new Mock<IMongoCollection<Key>>();
            _uilmFileCollection = new Mock<IMongoCollection<UilmFile>>();
            _bsonCollection = new Mock<IMongoCollection<BsonDocument>>();
            _exportedFileCollection = new Mock<IMongoCollection<UilmExportedFile>>();
            _blocksLanguageCollection = new Mock<IMongoCollection<BlocksLanguage>>();
            _moduleCollection = new Mock<IMongoCollection<BlocksLanguageModule>>();

            _dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(_database.Object);
            _database.Setup(x => x.GetCollection<BlocksLanguageKey>(It.IsAny<string>(), null)).Returns(_blkCollection.Object);
            _database.Setup(x => x.GetCollection<Key>(It.IsAny<string>(), null)).Returns(_keyCollection.Object);
            _database.Setup(x => x.GetCollection<UilmFile>(It.IsAny<string>(), null)).Returns(_uilmFileCollection.Object);
            _database.Setup(x => x.GetCollection<BsonDocument>(It.IsAny<string>(), null)).Returns(_bsonCollection.Object);
            _database.Setup(x => x.GetCollection<UilmExportedFile>(It.IsAny<string>(), null)).Returns(_exportedFileCollection.Object);
            _database.Setup(x => x.GetCollection<BlocksLanguage>(It.IsAny<string>(), null)).Returns(_blocksLanguageCollection.Object);
            _database.Setup(x => x.GetCollection<BlocksLanguageModule>(It.IsAny<string>(), null)).Returns(_moduleCollection.Object);

            _repo = new KeyRepository(_dbContextProvider.Object);
        }

        #region SaveKeyAsync

        [Fact]
        public async Task SaveKeyAsync_UpsertsKey()
        {
            _blkCollection.Setup(x => x.ReplaceOneAsync(
                It.IsAny<FilterDefinition<BlocksLanguageKey>>(),
                It.IsAny<BlocksLanguageKey>(),
                It.IsAny<ReplaceOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync(Mock.Of<ReplaceOneResult>());

            var key = new BlocksLanguageKey { ItemId = "k1", KeyName = "k", ModuleId = "m" };
            await _repo.SaveKeyAsync(key);

            _blkCollection.Verify(x => x.ReplaceOneAsync(
                It.IsAny<FilterDefinition<BlocksLanguageKey>>(),
                key,
                It.Is<ReplaceOptions>(o => o.IsUpsert),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        #endregion

        #region DeleteAsync

        [Fact]
        public async Task DeleteAsync_CallsDeleteOneAsync()
        {
            _blkCollection.Setup(x => x.DeleteOneAsync(
                It.IsAny<FilterDefinition<BlocksLanguageKey>>(),
                It.IsAny<CancellationToken>())).ReturnsAsync(Mock.Of<DeleteResult>());

            await _repo.DeleteAsync("item-1");

            _blkCollection.Verify(x => x.DeleteOneAsync(
                It.IsAny<FilterDefinition<BlocksLanguageKey>>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        #endregion

        #region GetByIdAsync

        [Fact]
        public async Task GetByIdAsync_ReturnsKey_WhenFound()
        {
            var expected = new Key { ItemId = "k1", KeyName = "testKey", ModuleId = "m1" };
            MockCursorHelper.SetupFindAsync(_keyCollection, new List<Key> { expected });

            var result = await _repo.GetByIdAsync("k1");

            result.Should().NotBeNull();
            result.ItemId.Should().Be("k1");
        }

        [Fact]
        public async Task GetByIdAsync_ReturnsNull_WhenNotFound()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_keyCollection);

            var result = await _repo.GetByIdAsync("nonexistent");

            result.Should().BeNull();
        }

        #endregion

        #region GetKeysByKeyNamesAsync

        [Fact]
        public async Task GetKeysByKeyNamesAsync_ReturnsMatchingKeys()
        {
            var keys = new List<Key>
            {
                new Key { ItemId = "k1", KeyName = "key1", ModuleId = "m1" },
                new Key { ItemId = "k2", KeyName = "key2", ModuleId = "m1" }
            };
            MockCursorHelper.SetupFindAsync(_keyCollection, keys);

            var result = await _repo.GetKeysByKeyNamesAsync(new[] { "key1", "key2" });

            result.Should().HaveCount(2);
        }

        [Fact]
        public async Task GetKeysByKeyNamesAsync_WithModuleId_FiltersCorrectly()
        {
            var keys = new List<Key> { new Key { ItemId = "k1", KeyName = "key1", ModuleId = "m1" } };
            MockCursorHelper.SetupFindAsync(_keyCollection, keys);

            var result = await _repo.GetKeysByKeyNamesAsync(new[] { "key1" }, "m1");

            result.Should().HaveCount(1);
        }

        [Fact]
        public async Task GetKeysByKeyNamesAsync_WithEmptyModuleId_IgnoresModuleFilter()
        {
            var keys = new List<Key> { new Key { ItemId = "k1", KeyName = "key1", ModuleId = "m1" } };
            MockCursorHelper.SetupFindAsync(_keyCollection, keys);

            var result = await _repo.GetKeysByKeyNamesAsync(new[] { "key1" }, "");

            result.Should().HaveCount(1);
        }

        [Fact]
        public async Task GetKeysByKeyNamesAsync_ReturnsEmpty_WhenNoMatch()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_keyCollection);

            var result = await _repo.GetKeysByKeyNamesAsync(new[] { "missing" });

            result.Should().BeEmpty();
        }

        #endregion

        #region GetAllKeysAsync

        [Fact]
        public async Task GetAllKeysAsync_ReturnsKeysAndCount()
        {
            var keys = new List<Key>
            {
                new Key { ItemId = "k1", KeyName = "key1", ModuleId = "m1" },
                new Key { ItemId = "k2", KeyName = "key2", ModuleId = "m1" }
            };
            MockCursorHelper.SetupFindAsync(_keyCollection, keys);
            MockCursorHelper.SetupCountDocuments(_keyCollection, 2);

            var request = new GetKeysRequest { PageNumber = 0, PageSize = 10 };
            var result = await _repo.GetAllKeysAsync(request);

            result.Keys.Should().HaveCount(2);
            result.TotalCount.Should().Be(2);
        }

        [Fact]
        public async Task GetAllKeysAsync_WithSearchText_FiltersKeys()
        {
            var keys = new List<Key> { new Key { ItemId = "k1", KeyName = "searchable", ModuleId = "m1" } };
            MockCursorHelper.SetupFindAsync(_keyCollection, keys);
            MockCursorHelper.SetupCountDocuments(_keyCollection, 1);

            var request = new GetKeysRequest
            {
                PageNumber = 0,
                PageSize = 10,
                KeySearchText = "search"
            };

            var result = await _repo.GetAllKeysAsync(request);
            result.Keys.Should().HaveCount(1);
        }

        [Fact]
        public async Task GetAllKeysAsync_WithSearchKey_FiltersKeyName()
        {
            var keys = new List<Key> { new Key { ItemId = "k1", KeyName = "welcome_msg", ModuleId = "m1" } };
            MockCursorHelper.SetupFindAsync(_keyCollection, keys);
            MockCursorHelper.SetupCountDocuments(_keyCollection, 1);

            var request = new GetKeysRequest
            {
                PageNumber = 0,
                PageSize = 10,
                SearchKey = "welcome"
            };

            var result = await _repo.GetAllKeysAsync(request);
            result.Keys.Should().HaveCount(1);
        }

        [Fact]
        public async Task GetAllKeysAsync_WithSearchKeyAndResourceSearchFilters_FiltersBoth()
        {
            var keys = new List<Key>
            {
                new Key
                {
                    ItemId = "k1",
                    KeyName = "greeting",
                    ModuleId = "m1",
                    Resources = new[] { new Resource { Culture = "en", Value = "Hello" } }
                }
            };
            MockCursorHelper.SetupFindAsync(_keyCollection, keys);
            MockCursorHelper.SetupCountDocuments(_keyCollection, 1);

            var request = new GetKeysRequest
            {
                PageNumber = 0,
                PageSize = 10,
                SearchKey = "greet",
                ResourceSearchFilters = new[]
                {
                    new ResourceSearchFilter { Culture = "en", SearchText = "Hello" }
                }
            };

            var result = await _repo.GetAllKeysAsync(request);
            result.Keys.Should().HaveCount(1);
        }

        [Fact]
        public async Task GetAllKeysAsync_WithKeySearchTextAndSearchKey_AppliesBothFilters()
        {
            var keys = new List<Key> { new Key { ItemId = "k1", KeyName = "test_key", ModuleId = "m1" } };
            MockCursorHelper.SetupFindAsync(_keyCollection, keys);
            MockCursorHelper.SetupCountDocuments(_keyCollection, 1);

            var request = new GetKeysRequest
            {
                PageNumber = 0,
                PageSize = 10,
                KeySearchText = "test",
                SearchKey = "test_key"
            };

            var result = await _repo.GetAllKeysAsync(request);
            result.Keys.Should().HaveCount(1);
        }

        [Fact]
        public async Task GetAllKeysAsync_WithSingleModuleId_FiltersCorrectly()
        {
            var keys = new List<Key> { new Key { ItemId = "k1", KeyName = "key1", ModuleId = "m1" } };
            MockCursorHelper.SetupFindAsync(_keyCollection, keys);
            MockCursorHelper.SetupCountDocuments(_keyCollection, 1);

            var request = new GetKeysRequest
            {
                PageNumber = 0,
                PageSize = 10,
                ModuleIds = new[] { "m1" }
            };

            var result = await _repo.GetAllKeysAsync(request);
            result.Keys.Should().HaveCount(1);
        }

        [Fact]
        public async Task GetAllKeysAsync_WithMultipleModuleIds_FiltersCorrectly()
        {
            var keys = new List<Key>
            {
                new Key { ItemId = "k1", KeyName = "key1", ModuleId = "m1" },
                new Key { ItemId = "k2", KeyName = "key2", ModuleId = "m2" }
            };
            MockCursorHelper.SetupFindAsync(_keyCollection, keys);
            MockCursorHelper.SetupCountDocuments(_keyCollection, 2);

            var request = new GetKeysRequest
            {
                PageNumber = 0,
                PageSize = 10,
                ModuleIds = new[] { "m1", "m2" }
            };

            var result = await _repo.GetAllKeysAsync(request);
            result.Keys.Should().HaveCount(2);
        }

        [Fact]
        public async Task GetAllKeysAsync_WithDateRange_StartDateOnly()
        {
            MockCursorHelper.SetupFindAsync(_keyCollection, new List<Key>());
            MockCursorHelper.SetupCountDocuments(_keyCollection, 0);

            var request = new GetKeysRequest
            {
                PageNumber = 0,
                PageSize = 10,
                CreateDateRange = new DateRange { StartDate = DateTime.UtcNow.AddDays(-7) }
            };

            var result = await _repo.GetAllKeysAsync(request);
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task GetAllKeysAsync_WithDateRange_EndDateOnly()
        {
            MockCursorHelper.SetupFindAsync(_keyCollection, new List<Key>());
            MockCursorHelper.SetupCountDocuments(_keyCollection, 0);

            var request = new GetKeysRequest
            {
                PageNumber = 0,
                PageSize = 10,
                CreateDateRange = new DateRange { EndDate = DateTime.UtcNow }
            };

            var result = await _repo.GetAllKeysAsync(request);
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task GetAllKeysAsync_WithDateRange_BothDates()
        {
            MockCursorHelper.SetupFindAsync(_keyCollection, new List<Key>());
            MockCursorHelper.SetupCountDocuments(_keyCollection, 0);

            var request = new GetKeysRequest
            {
                PageNumber = 0,
                PageSize = 10,
                CreateDateRange = new DateRange
                {
                    StartDate = DateTime.UtcNow.AddDays(-7),
                    EndDate = DateTime.UtcNow
                }
            };

            var result = await _repo.GetAllKeysAsync(request);
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task GetAllKeysAsync_WithDateRange_DefaultDates_NoFilter()
        {
            MockCursorHelper.SetupFindAsync(_keyCollection, new List<Key>());
            MockCursorHelper.SetupCountDocuments(_keyCollection, 0);

            var request = new GetKeysRequest
            {
                PageNumber = 0,
                PageSize = 10,
                CreateDateRange = new DateRange()
            };

            var result = await _repo.GetAllKeysAsync(request);
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task GetAllKeysAsync_WithDescendingSort()
        {
            MockCursorHelper.SetupFindAsync(_keyCollection, new List<Key>());
            MockCursorHelper.SetupCountDocuments(_keyCollection, 0);

            var request = new GetKeysRequest
            {
                PageNumber = 0,
                PageSize = 10,
                SortProperty = "KeyName",
                IsDescending = true
            };

            var result = await _repo.GetAllKeysAsync(request);
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task GetAllKeysAsync_WithAscendingSort_DefaultProperty()
        {
            MockCursorHelper.SetupFindAsync(_keyCollection, new List<Key>());
            MockCursorHelper.SetupCountDocuments(_keyCollection, 0);

            var request = new GetKeysRequest
            {
                PageNumber = 0,
                PageSize = 10,
                IsDescending = false
            };

            var result = await _repo.GetAllKeysAsync(request);
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task GetAllKeysAsync_WithEmptyModuleIdsArray_NoModuleFilter()
        {
            MockCursorHelper.SetupFindAsync(_keyCollection, new List<Key>());
            MockCursorHelper.SetupCountDocuments(_keyCollection, 0);

            var request = new GetKeysRequest
            {
                PageNumber = 0,
                PageSize = 10,
                ModuleIds = new string[0]
            };

            var result = await _repo.GetAllKeysAsync(request);
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task GetAllKeysAsync_WithSingleEmptyStringModuleId_NoModuleFilter()
        {
            MockCursorHelper.SetupFindAsync(_keyCollection, new List<Key>());
            MockCursorHelper.SetupCountDocuments(_keyCollection, 0);

            var request = new GetKeysRequest
            {
                PageNumber = 0,
                PageSize = 10,
                ModuleIds = new[] { "" }
            };

            var result = await _repo.GetAllKeysAsync(request);
            result.Should().NotBeNull();
        }

        #endregion

        #region GetKeyByNameAsync

        [Fact]
        public async Task GetKeyByNameAsync_ReturnsKey_WhenFound()
        {
            var key = new BlocksLanguageKey { ItemId = "k1", KeyName = "testKey", ModuleId = "m1" };
            MockCursorHelper.SetupFindAsync(_blkCollection, new List<BlocksLanguageKey> { key });

            var result = await _repo.GetKeyByNameAsync("testKey", "m1");

            result.Should().NotBeNull();
            result.KeyName.Should().Be("testKey");
        }

        [Fact]
        public async Task GetKeyByNameAsync_ReturnsNull_WhenNotFound()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_blkCollection);

            var result = await _repo.GetKeyByNameAsync("missing", "m1");

            result.Should().BeNull();
        }

        #endregion

        #region GetAllKeysByModuleAsync

        [Fact]
        public async Task GetAllKeysByModuleAsync_ReturnsKeysForModule()
        {
            var keys = new List<Key>
            {
                new Key { ItemId = "k1", KeyName = "key1", ModuleId = "m1" },
                new Key { ItemId = "k2", KeyName = "key2", ModuleId = "m1" }
            };
            MockCursorHelper.SetupFindAsync(_keyCollection, keys);

            var result = await _repo.GetAllKeysByModuleAsync("m1");

            result.Should().HaveCount(2);
        }

        [Fact]
        public async Task GetAllKeysByModuleAsync_ReturnsEmpty_WhenNoKeys()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_keyCollection);

            var result = await _repo.GetAllKeysByModuleAsync("m1");

            result.Should().BeEmpty();
        }

        #endregion

        #region GetUilmResourceKeysWithPage

        [Fact]
        public async Task GetUilmResourceKeysWithPage_ReturnsPaginatedResults()
        {
            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey { ItemId = "k1", KeyName = "key1", ModuleId = "m1" }
            };
            MockCursorHelper.SetupFindAsync(_blkCollection, keys);

            var result = await _repo.GetUilmResourceKeysWithPage(0, 10);

            result.Should().NotBeNull();
            result.Count().Should().Be(1);
        }

        #endregion

        #region SaveNewUilmFiles

        [Fact]
        public async Task SaveNewUilmFiles_InsertsMany_ReturnsTrue()
        {
            _uilmFileCollection.Setup(x => x.InsertManyAsync(
                It.IsAny<IEnumerable<UilmFile>>(),
                It.IsAny<InsertManyOptions>(),
                It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var files = new List<UilmFile>
            {
                new UilmFile { Id = "f1", TenantId = "t", ModuleName = "mod", Language = "en", Content = "c" }
            };

            var result = await _repo.SaveNewUilmFiles(files);
            result.Should().BeTrue();
        }

        #endregion

        #region DeleteOldUilmFiles

        [Fact]
        public async Task DeleteOldUilmFiles_CallsDeleteManyAsync()
        {
            var mockDeleteResult = new Mock<DeleteResult>();
            mockDeleteResult.Setup(x => x.DeletedCount).Returns(3);

            _uilmFileCollection.Setup(x => x.DeleteManyAsync(
                It.IsAny<FilterDefinition<UilmFile>>(),
                It.IsAny<CancellationToken>())).ReturnsAsync(mockDeleteResult.Object);

            var files = new List<UilmFile>
            {
                new UilmFile { Id = "f1", TenantId = "t", ModuleName = "mod1", Language = "en", Content = "c" },
                new UilmFile { Id = "f2", TenantId = "t", ModuleName = "mod2", Language = "en", Content = "c" }
            };

            var result = await _repo.DeleteOldUilmFiles(files);

            result.Should().Be(3);
        }

        #endregion

        #region GetUilmFile

        [Fact]
        public async Task GetUilmFile_ReturnsFile_WhenFound()
        {
            var uilmFile = new UilmFile { Id = "f1", TenantId = "t", ModuleName = "mod", Language = "en", Content = "content" };
            MockCursorHelper.SetupFindAsyncWithProjection<BsonDocument, UilmFile>(_bsonCollection, new List<UilmFile> { uilmFile });

            var request = new GetUilmFileRequest { Language = "en", ModuleName = "mod" };
            var result = await _repo.GetUilmFile(request);

            result.Should().NotBeNull();
            result.Language.Should().Be("en");
        }

        [Fact]
        public async Task GetUilmFile_ReturnsNull_WhenNotFound()
        {
            MockCursorHelper.SetupFindAsyncWithProjectionEmpty<BsonDocument, UilmFile>(_bsonCollection);

            var request = new GetUilmFileRequest { Language = "fr", ModuleName = "mod" };
            var result = await _repo.GetUilmFile(request);

            result.Should().BeNull();
        }

        #endregion

        #region UpdateUilmResourceKeys

        [Fact]
        public async Task UpdateUilmResourceKeys_CallsBulkWriteAsync()
        {
            _blkCollection.Setup(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageKey>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync((BulkWriteResult<BlocksLanguageKey>)null!);

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey { ItemId = "k1", KeyName = "key1", ModuleId = "m1" },
                new BlocksLanguageKey { ItemId = "k2", KeyName = "key2", ModuleId = "m1" }
            };

            var result = await _repo.UpdateUilmResourceKeys(keys);
            result.Should().BeNull();
        }

        #endregion

        #region UpdateUilmResourceKeysForChangeAll

        [Fact]
        public async Task UpdateUilmResourceKeysForChangeAll_DelegatesToUpdateUilmResourceKeys()
        {
            _blkCollection.Setup(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageKey>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync((BulkWriteResult<BlocksLanguageKey>)null!);

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey { ItemId = "k1", KeyName = "key1", ModuleId = "m1" }
            };

            var result = await _repo.UpdateUilmResourceKeysForChangeAll(keys);
            result.Should().BeNull();
        }

        #endregion

        #region InsertUilmResourceKeys

        [Fact]
        public async Task InsertUilmResourceKeys_WithTenantId_CallsInsertMany()
        {
            _blkCollection.Setup(x => x.InsertManyAsync(
                It.IsAny<IEnumerable<BlocksLanguageKey>>(),
                It.IsAny<InsertManyOptions>(),
                It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey { ItemId = "k1", KeyName = "key1", ModuleId = "m1" }
            };

            await _repo.InsertUilmResourceKeys(keys, "tenant-1");

            _blkCollection.Verify(x => x.InsertManyAsync(
                keys,
                It.IsAny<InsertManyOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task InsertUilmResourceKeys_WithoutTenantId_CallsInsertMany()
        {
            _blkCollection.Setup(x => x.InsertManyAsync(
                It.IsAny<IEnumerable<BlocksLanguageKey>>(),
                It.IsAny<InsertManyOptions>(),
                It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey { ItemId = "k1", KeyName = "key1", ModuleId = "m1" }
            };

            await _repo.InsertUilmResourceKeys(keys);

            _blkCollection.Verify(x => x.InsertManyAsync(
                keys,
                It.IsAny<InsertManyOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        #endregion

        #region SaveUilmExportedFileAsync

        [Fact]
        public async Task SaveUilmExportedFileAsync_CallsInsertOne()
        {
            _exportedFileCollection.Setup(x => x.InsertOneAsync(
                It.IsAny<UilmExportedFile>(),
                It.IsAny<InsertOneOptions>(),
                It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var file = new UilmExportedFile
            {
                FileId = "file-1",
                FileName = "export.json",
                CreateDate = DateTime.UtcNow,
                CreatedBy = "user-1"
            };

            await _repo.SaveUilmExportedFileAsync(file);

            _exportedFileCollection.Verify(x => x.InsertOneAsync(
                file,
                It.IsAny<InsertOneOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        #endregion

        #region GetUilmExportedFilesAsync

        [Fact]
        public async Task GetUilmExportedFilesAsync_ReturnsFilesAndCount()
        {
            var files = new List<UilmExportedFile>
            {
                new UilmExportedFile { FileId = "f1", FileName = "export1.json", CreateDate = DateTime.UtcNow, CreatedBy = "user1" }
            };
            MockCursorHelper.SetupFindAsync(_exportedFileCollection, files);
            MockCursorHelper.SetupCountDocuments(_exportedFileCollection, 1);

            var request = new GetUilmExportedFilesRequest { PageNumber = 0, PageSize = 10 };
            var result = await _repo.GetUilmExportedFilesAsync(request);

            result.Should().NotBeNull();
            result.UilmExportedFiles.Should().HaveCount(1);
            result.TotalCount.Should().Be(1);
        }

        [Fact]
        public async Task GetUilmExportedFilesAsync_WithSearchText_FiltersFiles()
        {
            MockCursorHelper.SetupFindAsync(_exportedFileCollection, new List<UilmExportedFile>());
            MockCursorHelper.SetupCountDocuments(_exportedFileCollection, 0);

            var request = new GetUilmExportedFilesRequest
            {
                PageNumber = 0,
                PageSize = 10,
                SearchText = "export"
            };

            var result = await _repo.GetUilmExportedFilesAsync(request);
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task GetUilmExportedFilesAsync_WithDateRange_FiltersFiles()
        {
            MockCursorHelper.SetupFindAsync(_exportedFileCollection, new List<UilmExportedFile>());
            MockCursorHelper.SetupCountDocuments(_exportedFileCollection, 0);

            var request = new GetUilmExportedFilesRequest
            {
                PageNumber = 0,
                PageSize = 10,
                CreateDateRange = new DateRange
                {
                    StartDate = DateTime.UtcNow.AddDays(-7),
                    EndDate = DateTime.UtcNow
                }
            };

            var result = await _repo.GetUilmExportedFilesAsync(request);
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task GetUilmExportedFilesAsync_WithStartDateOnly()
        {
            MockCursorHelper.SetupFindAsync(_exportedFileCollection, new List<UilmExportedFile>());
            MockCursorHelper.SetupCountDocuments(_exportedFileCollection, 0);

            var request = new GetUilmExportedFilesRequest
            {
                PageNumber = 0,
                PageSize = 10,
                CreateDateRange = new DateRange { StartDate = DateTime.UtcNow.AddDays(-7) }
            };

            var result = await _repo.GetUilmExportedFilesAsync(request);
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task GetUilmExportedFilesAsync_WithEndDateOnly()
        {
            MockCursorHelper.SetupFindAsync(_exportedFileCollection, new List<UilmExportedFile>());
            MockCursorHelper.SetupCountDocuments(_exportedFileCollection, 0);

            var request = new GetUilmExportedFilesRequest
            {
                PageNumber = 0,
                PageSize = 10,
                CreateDateRange = new DateRange { EndDate = DateTime.UtcNow }
            };

            var result = await _repo.GetUilmExportedFilesAsync(request);
            result.Should().NotBeNull();
        }

        #endregion

        #region DeleteCollectionsAsync

        [Fact]
        public async Task DeleteCollectionsAsync_ValidCollections_DeletesAndReturnsCount()
        {
            var mockDeleteResult = new Mock<DeleteResult>();
            mockDeleteResult.Setup(x => x.DeletedCount).Returns(5);

            _bsonCollection.Setup(x => x.DeleteManyAsync(
                It.IsAny<FilterDefinition<BsonDocument>>(),
                It.IsAny<CancellationToken>())).ReturnsAsync(mockDeleteResult.Object);

            var collections = new List<string> { "BlocksLanguageKeys", "BlocksLanguages" };
            var result = await _repo.DeleteCollectionsAsync(collections);

            result.Should().ContainKey("BlocksLanguageKeys").WhoseValue.Should().Be(5);
            result.Should().ContainKey("BlocksLanguages").WhoseValue.Should().Be(5);
        }

        [Fact]
        public async Task DeleteCollectionsAsync_InvalidCollection_ReturnsMinusOne()
        {
            var collections = new List<string> { "InvalidCollection" };
            var result = await _repo.DeleteCollectionsAsync(collections);

            result.Should().ContainKey("InvalidCollection").WhoseValue.Should().Be(-1);
        }

        [Fact]
        public async Task DeleteCollectionsAsync_MixedCollections_HandlesBoth()
        {
            var mockDeleteResult = new Mock<DeleteResult>();
            mockDeleteResult.Setup(x => x.DeletedCount).Returns(10);

            _bsonCollection.Setup(x => x.DeleteManyAsync(
                It.IsAny<FilterDefinition<BsonDocument>>(),
                It.IsAny<CancellationToken>())).ReturnsAsync(mockDeleteResult.Object);

            var collections = new List<string> { "BlocksLanguageKeys", "InvalidCollection", "UilmFiles" };
            var result = await _repo.DeleteCollectionsAsync(collections);

            result["BlocksLanguageKeys"].Should().Be(10);
            result["InvalidCollection"].Should().Be(-1);
            result["UilmFiles"].Should().Be(10);
        }

        [Fact]
        public async Task DeleteCollectionsAsync_AllValidCollectionNames()
        {
            var mockDeleteResult = new Mock<DeleteResult>();
            mockDeleteResult.Setup(x => x.DeletedCount).Returns(1);

            _bsonCollection.Setup(x => x.DeleteManyAsync(
                It.IsAny<FilterDefinition<BsonDocument>>(),
                It.IsAny<CancellationToken>())).ReturnsAsync(mockDeleteResult.Object);

            var collections = new List<string> { "BlocksLanguageKeys", "BlocksLanguages", "BlocksLanguageModules", "UilmFiles" };
            var result = await _repo.DeleteCollectionsAsync(collections);

            result.Should().HaveCount(4);
            result.Values.Should().AllBeEquivalentTo(1L);
        }

        #endregion

        #region UpdateKeysCountOfAppAsync

        [Fact]
        public async Task UpdateKeysCountOfAppAsync_Internal_CountsAndUpdates()
        {
            MockCursorHelper.SetupCountDocuments(_bsonCollection, 42);

            _bsonCollection.Setup(x => x.UpdateOneAsync(
                It.IsAny<FilterDefinition<BsonDocument>>(),
                It.IsAny<UpdateDefinition<BsonDocument>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync(Mock.Of<UpdateResult>());

            var result = await _repo.UpdateKeysCountOfAppAsync("app1", false, "tenant", "org1");

            result.Should().BeTrue();
            // Internal path: CountDocumentsAsync on UilmResourceKeys, UpdateOneAsync on UilmApplications and BlocksLanguageApplications
            _bsonCollection.Verify(x => x.UpdateOneAsync(
                It.IsAny<FilterDefinition<BsonDocument>>(),
                It.IsAny<UpdateDefinition<BsonDocument>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()), Times.Exactly(2));
        }

        [Fact]
        public async Task UpdateKeysCountOfAppAsync_External_CountsAndUpdates()
        {
            MockCursorHelper.SetupCountDocuments(_bsonCollection, 10);

            _bsonCollection.Setup(x => x.UpdateOneAsync(
                It.IsAny<FilterDefinition<BsonDocument>>(),
                It.IsAny<UpdateDefinition<BsonDocument>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync(Mock.Of<UpdateResult>());

            var result = await _repo.UpdateKeysCountOfAppAsync("app1", true, "tenant", "org1");

            result.Should().BeTrue();
            // External path: CountDocumentsAsync on BlocksLanguageKeys, UpdateOneAsync on BlocksLanguageApplications
            _bsonCollection.Verify(x => x.UpdateOneAsync(
                It.IsAny<FilterDefinition<BsonDocument>>(),
                It.IsAny<UpdateDefinition<BsonDocument>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        #endregion

        #region InsertUilmApplications

        [Fact]
        public async Task InsertUilmApplications_WithList_CallsInsertMany()
        {
            _moduleCollection.Setup(x => x.InsertManyAsync(
                It.IsAny<IEnumerable<BlocksLanguageModule>>(),
                It.IsAny<InsertManyOptions>(),
                It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "m1", ModuleName = "mod1", Name = "Module1" }
            };

            await _repo.InsertUilmApplications(modules, "tenant-1");

            _moduleCollection.Verify(x => x.InsertManyAsync(
                modules,
                It.IsAny<InsertManyOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task InsertUilmApplications_WithEnumerable_CallsInsertMany()
        {
            _moduleCollection.Setup(x => x.InsertManyAsync(
                It.IsAny<IEnumerable<BlocksLanguageModule>>(),
                It.IsAny<InsertManyOptions>(),
                It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            IEnumerable<BlocksLanguageModule> modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "m1", ModuleName = "mod1", Name = "Module1" }
            };

            await _repo.InsertUilmApplications(modules);

            _moduleCollection.Verify(x => x.InsertManyAsync(
                modules,
                It.IsAny<InsertManyOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        #endregion

        #region UpdateBulkUilmApplications

        [Fact]
        public async Task UpdateBulkUilmApplications_BulkWritesBsonAndModules()
        {
            _bsonCollection.Setup(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BsonDocument>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync((BulkWriteResult<BsonDocument>)null!);

            _moduleCollection.Setup(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageModule>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync((BulkWriteResult<BlocksLanguageModule>)null!);

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "m1", ModuleName = "mod1", Name = "Module1" }
            };

            await _repo.UpdateBulkUilmApplications(modules, "org-1", false, "tenant-1");

            _bsonCollection.Verify(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BsonDocument>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);

            _moduleCollection.Verify(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageModule>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        #endregion

        #region GetLanguageSettingAsync

        [Fact]
        public async Task GetLanguageSettingAsync_ReturnsDefaultLanguage()
        {
            var lang = new BlocksLanguage { ItemId = "l1", LanguageName = "English", LanguageCode = "en", IsDefault = true };
            MockCursorHelper.SetupFindAsync(_blocksLanguageCollection, new List<BlocksLanguage> { lang });

            var result = await _repo.GetLanguageSettingAsync("tenant");

            result.Should().NotBeNull();
            result.LanguageName.Should().Be("English");
        }

        [Fact]
        public async Task GetLanguageSettingAsync_ReturnsNull_WhenNoDefault()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_blocksLanguageCollection);

            var result = await _repo.GetLanguageSettingAsync("tenant");

            result.Should().BeNull();
        }

        #endregion

        #region GetAllLanguagesAsync

        [Fact]
        public async Task GetAllLanguagesAsync_ReturnsAllLanguages()
        {
            var languages = new List<BlocksLanguage>
            {
                new BlocksLanguage { ItemId = "l1", LanguageName = "English", LanguageCode = "en" },
                new BlocksLanguage { ItemId = "l2", LanguageName = "German", LanguageCode = "de" }
            };
            MockCursorHelper.SetupFindAsync(_blocksLanguageCollection, languages);

            var result = await _repo.GetAllLanguagesAsync("tenant");

            result.Should().HaveCount(2);
        }

        [Fact]
        public async Task GetAllLanguagesAsync_ReturnsEmpty_WhenNoLanguages()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_blocksLanguageCollection);

            var result = await _repo.GetAllLanguagesAsync("tenant");

            result.Should().BeEmpty();
        }

        #endregion

        #region GetUilmResourceKey

        [Fact]
        public async Task GetUilmResourceKey_WithExpression_ReturnsMatchingKey()
        {
            MockCursorHelper.SetupFindAsyncWithProjection<BlocksLanguageKey, BlocksLanguageKey>(
                _blkCollection, new List<BlocksLanguageKey>
                {
                    new BlocksLanguageKey { ItemId = "k1", KeyName = "key1", ModuleId = "m1" }
                });

            var result = await _repo.GetUilmResourceKey<BlocksLanguageKey>(x => x.KeyName == "key1");

            result.Should().NotBeNull();
        }

        [Fact]
        public async Task GetUilmResourceKey_WithExpressionAndTenantId_ReturnsMatchingKey()
        {
            MockCursorHelper.SetupFindAsync(_blkCollection, new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey { ItemId = "k1", KeyName = "key1", ModuleId = "m1" }
            });

            var result = await _repo.GetUilmResourceKey(x => x.KeyName == "key1", "tenant");

            result.Should().NotBeNull();
        }

        #endregion

        #region GetUilmResourceKeys

        [Fact]
        public async Task GetUilmResourceKeys_WithExpressionAndTenantId_ReturnsList()
        {
            MockCursorHelper.SetupFindAsync(_blkCollection, new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey { ItemId = "k1", KeyName = "key1", ModuleId = "m1" },
                new BlocksLanguageKey { ItemId = "k2", KeyName = "key2", ModuleId = "m1" }
            });

            var result = await _repo.GetUilmResourceKeys(x => x.ModuleId == "m1", "tenant");

            result.Should().HaveCount(2);
        }

        [Fact]
        public async Task GetUilmResourceKeys_Projected_ReturnsList()
        {
            MockCursorHelper.SetupFindAsyncWithProjection<BlocksLanguageKey, BlocksLanguageKey>(
                _blkCollection, new List<BlocksLanguageKey>
                {
                    new BlocksLanguageKey { ItemId = "k1", KeyName = "key1", ModuleId = "m1" }
                });

            var result = await _repo.GetUilmResourceKeys<BlocksLanguageKey>(x => x.ModuleId == "m1");

            result.Should().HaveCount(1);
        }

        #endregion

        #region GetUilmApplications

        [Fact]
        public async Task GetUilmApplications_Projected_ReturnsList()
        {
            MockCursorHelper.SetupFindAsyncWithProjection<BlocksLanguageModule, BlocksLanguageModule>(
                _moduleCollection, new List<BlocksLanguageModule>
                {
                    new BlocksLanguageModule { ItemId = "m1", ModuleName = "mod1", Name = "Mod1" }
                });

            var result = await _repo.GetUilmApplications<BlocksLanguageModule>(x => true);

            result.Should().HaveCount(1);
        }

        #endregion
    }
}
