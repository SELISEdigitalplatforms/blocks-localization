using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Shared.Entities;
using FluentAssertions;
using Moq;
using MongoDB.Driver;
using Xunit;
using BlocksTemplate.XUnitTest.Shared;

namespace BlocksTemplate.XUnitTest.Repositories
{
    public class EnvironmentDataMigrationRepositoryTests
    {
        private readonly Mock<IDbContextProvider> _dbContextProvider;
        private readonly Mock<IMongoDatabase> _database;
        private readonly Mock<IMongoCollection<BlocksLanguageModule>> _moduleCollection;
        private readonly Mock<IMongoCollection<BlocksLanguageKey>> _keyCollection;
        private readonly Mock<IMongoCollection<MigrationTracker>> _trackerCollection;
        private readonly EnvironmentDataMigrationRepository _repo;

        public EnvironmentDataMigrationRepositoryTests()
        {
            _dbContextProvider = new Mock<IDbContextProvider>();
            _database = new Mock<IMongoDatabase>();
            _moduleCollection = new Mock<IMongoCollection<BlocksLanguageModule>>();
            _keyCollection = new Mock<IMongoCollection<BlocksLanguageKey>>();
            _trackerCollection = new Mock<IMongoCollection<MigrationTracker>>();

            _dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(_database.Object);
            _dbContextProvider.Setup(x => x.GetDatabase()).Returns(_database.Object);
            _database.Setup(x => x.GetCollection<BlocksLanguageModule>(It.IsAny<string>(), null)).Returns(_moduleCollection.Object);
            _database.Setup(x => x.GetCollection<BlocksLanguageKey>(It.IsAny<string>(), null)).Returns(_keyCollection.Object);
            _database.Setup(x => x.GetCollection<MigrationTracker>(It.IsAny<string>(), null)).Returns(_trackerCollection.Object);

            _repo = new EnvironmentDataMigrationRepository(_dbContextProvider.Object);
        }

        #region GetAllModulesAsync

        [Fact]
        public async Task GetAllModulesAsync_ReturnsModules()
        {
            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "m1", ModuleName = "mod1", Name = "Module1" },
                new BlocksLanguageModule { ItemId = "m2", ModuleName = "mod2", Name = "Module2" }
            };
            MockCursorHelper.SetupFindAsync(_moduleCollection, modules);

            var result = await _repo.GetAllModulesAsync("tenant1");

            result.Should().HaveCount(2);
            _dbContextProvider.Verify(x => x.GetDatabase("tenant1"), Times.Once);
        }

        [Fact]
        public async Task GetAllModulesAsync_ReturnsEmpty()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_moduleCollection);

            var result = await _repo.GetAllModulesAsync("tenant1");

            result.Should().BeEmpty();
        }

        #endregion

        #region GetAllKeysAsync

        [Fact]
        public async Task GetAllKeysAsync_ReturnsKeys()
        {
            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey { ItemId = "k1", KeyName = "key1", ModuleId = "m1" }
            };
            MockCursorHelper.SetupFindAsync(_keyCollection, keys);

            var result = await _repo.GetAllKeysAsync("tenant1");

            result.Should().HaveCount(1);
        }

        [Fact]
        public async Task GetAllKeysAsync_ReturnsEmpty()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_keyCollection);

            var result = await _repo.GetAllKeysAsync("tenant1");

            result.Should().BeEmpty();
        }

        #endregion

        #region GetExistingKeysByItemIdsAsync

        [Fact]
        public async Task GetExistingKeysByItemIdsAsync_EmptyList_ReturnsEmpty()
        {
            var result = await _repo.GetExistingKeysByItemIdsAsync(new List<string>(), "tenant1");

            result.Should().BeEmpty();
        }

        [Fact]
        public async Task GetExistingKeysByItemIdsAsync_WithIds_ReturnsMatchingKeys()
        {
            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey { ItemId = "k1", KeyName = "key1", ModuleId = "m1" }
            };
            MockCursorHelper.SetupFindAsync(_keyCollection, keys);

            var result = await _repo.GetExistingKeysByItemIdsAsync(new List<string> { "k1" }, "tenant1");

            result.Should().HaveCount(1);
        }

        #endregion

        #region GetExistingModulesByNamesAsync

        [Fact]
        public async Task GetExistingModulesByNamesAsync_EmptyList_ReturnsEmpty()
        {
            var result = await _repo.GetExistingModulesByNamesAsync(new List<string>(), "tenant1");

            result.Should().BeEmpty();
        }

        [Fact]
        public async Task GetExistingModulesByNamesAsync_WithNames_ReturnsMatchingModules()
        {
            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "m1", ModuleName = "mod1", Name = "Module1" }
            };
            MockCursorHelper.SetupFindAsync(_moduleCollection, modules);

            var result = await _repo.GetExistingModulesByNamesAsync(new List<string> { "mod1" }, "tenant1");

            result.Should().HaveCount(1);
        }

        #endregion

        #region GetExistingKeysByModuleNameAndKeyNameAsync

        [Fact]
        public async Task GetExistingKeysByModuleNameAndKeyNameAsync_EmptyList_ReturnsEmpty()
        {
            var result = await _repo.GetExistingKeysByModuleNameAndKeyNameAsync(
                new List<(string, string)>(),
                new Dictionary<string, string>(),
                "tenant1");

            result.Should().BeEmpty();
        }

        [Fact]
        public async Task GetExistingKeysByModuleNameAndKeyNameAsync_WithPairs_ReturnsKeys()
        {
            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey { ItemId = "k1", KeyName = "key1", ModuleId = "m1" }
            };
            MockCursorHelper.SetupFindAsync(_keyCollection, keys);

            var pairs = new List<(string, string)> { ("mod1", "key1") };
            var moduleMap = new Dictionary<string, string> { { "mod1", "m1" } };

            var result = await _repo.GetExistingKeysByModuleNameAndKeyNameAsync(pairs, moduleMap, "tenant1");

            result.Should().HaveCount(1);
        }

        [Fact]
        public async Task GetExistingKeysByModuleNameAndKeyNameAsync_NoMatchingModules_ReturnsEmpty()
        {
            var pairs = new List<(string, string)> { ("mod1", "key1") };
            var moduleMap = new Dictionary<string, string>(); // empty - no matching modules

            var result = await _repo.GetExistingKeysByModuleNameAndKeyNameAsync(pairs, moduleMap, "tenant1");

            result.Should().BeEmpty();
        }

        #endregion

        #region UpdateMigrationTrackerAsync

        [Fact]
        public async Task UpdateMigrationTrackerAsync_CallsUpdateOneAsync()
        {
            _trackerCollection.Setup(x => x.UpdateOneAsync(
                It.IsAny<FilterDefinition<MigrationTracker>>(),
                It.IsAny<UpdateDefinition<MigrationTracker>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync(Mock.Of<UpdateResult>());

            var status = new ServiceMigrationStatus { IsCompleted = true };
            await _repo.UpdateMigrationTrackerAsync("tracker1", status);

            _trackerCollection.Verify(x => x.UpdateOneAsync(
                It.IsAny<FilterDefinition<MigrationTracker>>(),
                It.IsAny<UpdateDefinition<MigrationTracker>>(),
                It.Is<UpdateOptions>(o => o.IsUpsert),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        #endregion

        #region BulkUpsertModulesAsync

        [Fact]
        public async Task BulkUpsertModulesAsync_EmptyList_DoesNothing()
        {
            await _repo.BulkUpsertModulesAsync(new List<BlocksLanguageModule>(), "tenant1", true);

            _moduleCollection.Verify(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageModule>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task BulkUpsertModulesAsync_WithOverwrite_UsesReplaceOneModel()
        {
            _moduleCollection.Setup(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageModule>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync((BulkWriteResult<BlocksLanguageModule>)null!);

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "m1", ModuleName = "mod1", Name = "Module1" }
            };

            await _repo.BulkUpsertModulesAsync(modules, "tenant1", true);

            _moduleCollection.Verify(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageModule>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task BulkUpsertModulesAsync_WithoutOverwrite_UsesUpdateOneModel()
        {
            _moduleCollection.Setup(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageModule>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync((BulkWriteResult<BlocksLanguageModule>)null!);

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "m1", ModuleName = "mod1", Name = "Module1" }
            };

            await _repo.BulkUpsertModulesAsync(modules, "tenant1", false);

            _moduleCollection.Verify(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageModule>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        #endregion

        #region BulkUpsertModulesByNameAsync

        [Fact]
        public async Task BulkUpsertModulesByNameAsync_EmptyList_DoesNothing()
        {
            await _repo.BulkUpsertModulesByNameAsync(new List<BlocksLanguageModule>(), "tenant1", true);

            _moduleCollection.Verify(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageModule>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task BulkUpsertModulesByNameAsync_WithOverwrite_CallsBulkWrite()
        {
            _moduleCollection.Setup(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageModule>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync((BulkWriteResult<BlocksLanguageModule>)null!);

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "m1", ModuleName = "mod1", Name = "Module1" }
            };

            await _repo.BulkUpsertModulesByNameAsync(modules, "tenant1", true);

            _moduleCollection.Verify(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageModule>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task BulkUpsertModulesByNameAsync_WithoutOverwrite_CallsBulkWrite()
        {
            _moduleCollection.Setup(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageModule>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync((BulkWriteResult<BlocksLanguageModule>)null!);

            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "m1", ModuleName = "mod1", Name = "Module1" }
            };

            await _repo.BulkUpsertModulesByNameAsync(modules, "tenant1", false);

            _moduleCollection.Verify(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageModule>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        #endregion

        #region BulkUpsertKeysAsync

        [Fact]
        public async Task BulkUpsertKeysAsync_EmptyList_ReturnsEmptyResult()
        {
            var result = await _repo.BulkUpsertKeysAsync(new List<BlocksLanguageKey>(), new List<BlocksLanguageKey>(), "tenant1", true);

            result.Should().NotBeNull();
            result.UpsertedKeys.Should().BeEmpty();
            result.InsertedKeys.Should().BeEmpty();
            result.UpdatedKeys.Should().BeEmpty();
        }

        [Fact]
        public async Task BulkUpsertKeysAsync_WithOverwrite_MergesResourcesAndBulkWrites()
        {
            var existingKey = new BlocksLanguageKey
            {
                ItemId = "k1", KeyName = "key1", ModuleId = "m1",
                Resources = new[] { new Resource { Culture = "en", Value = "Hello" }, new Resource { Culture = "de", Value = "Hallo" } }
            };
            var newKey = new BlocksLanguageKey
            {
                ItemId = "k1", KeyName = "key1", ModuleId = "m1",
                Resources = new[] { new Resource { Culture = "en", Value = "Hi" }, new Resource { Culture = "fr", Value = "Bonjour" } }
            };

            var bulkResult = new BulkWriteResult<BlocksLanguageKey>.Acknowledged(
                1, 0, 0, 0, 0,
                new List<WriteModel<BlocksLanguageKey>>(),
                new List<BulkWriteUpsert>());

            _keyCollection.Setup(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageKey>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync(bulkResult);

            var result = await _repo.BulkUpsertKeysAsync(
                new List<BlocksLanguageKey> { newKey },
                new List<BlocksLanguageKey> { existingKey },
                "tenant1", true);

            result.UpsertedKeys.Should().HaveCount(1);
            // The merged key should have resources from both: en (overwritten), de (kept), fr (new)
            result.UpsertedKeys[0].Resources.Should().HaveCount(3);
        }

        [Fact]
        public async Task BulkUpsertKeysAsync_WithoutOverwrite_OnlyInsertsNew()
        {
            var existingKey = new BlocksLanguageKey { ItemId = "k1", KeyName = "key1", ModuleId = "m1" };
            var newKey = new BlocksLanguageKey { ItemId = "k2", KeyName = "key2", ModuleId = "m1" };

            // Setup FindAsync for GetExistingKeysByItemIdsAsync
            MockCursorHelper.SetupFindAsync(_keyCollection, new List<BlocksLanguageKey> { existingKey });

            _keyCollection.Setup(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageKey>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync((BulkWriteResult<BlocksLanguageKey>)null!);

            var result = await _repo.BulkUpsertKeysAsync(
                new List<BlocksLanguageKey> { existingKey, newKey },
                new List<BlocksLanguageKey>(),
                "tenant1", false);

            result.InsertedKeys.Should().HaveCount(1);
            result.InsertedKeys[0].ItemId.Should().Be("k2");
        }

        [Fact]
        public async Task BulkUpsertKeysAsync_WithoutOverwrite_AllExist_NoInsert()
        {
            var existingKey = new BlocksLanguageKey { ItemId = "k1", KeyName = "key1", ModuleId = "m1" };

            MockCursorHelper.SetupFindAsync(_keyCollection, new List<BlocksLanguageKey> { existingKey });

            var result = await _repo.BulkUpsertKeysAsync(
                new List<BlocksLanguageKey> { existingKey },
                new List<BlocksLanguageKey>(),
                "tenant1", false);

            result.InsertedKeys.Should().BeEmpty();
            _keyCollection.Verify(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageKey>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>()), Times.Never);
        }

        #endregion

        #region BulkUpsertKeysByModuleNameAndKeyNameAsync

        [Fact]
        public async Task BulkUpsertKeysByModuleNameAndKeyNameAsync_EmptyList_ReturnsEmptyResult()
        {
            var result = await _repo.BulkUpsertKeysByModuleNameAndKeyNameAsync(
                new List<BlocksLanguageKey>(),
                new List<BlocksLanguageKey>(),
                new Dictionary<string, string>(),
                "tenant1", true);

            result.UpsertedKeys.Should().BeEmpty();
        }

        [Fact]
        public async Task BulkUpsertKeysByModuleNameAndKeyNameAsync_WithOverwrite_MergesAndBulkWrites()
        {
            var existingKey = new BlocksLanguageKey
            {
                ItemId = "k1", KeyName = "key1", ModuleId = "m1",
                Resources = new[] { new Resource { Culture = "en", Value = "Hello" } }
            };
            var newKey = new BlocksLanguageKey
            {
                ItemId = "k1", KeyName = "key1", ModuleId = "m1",
                Resources = new[] { new Resource { Culture = "fr", Value = "Bonjour" } }
            };

            _keyCollection.Setup(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageKey>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync((BulkWriteResult<BlocksLanguageKey>)null!);

            var result = await _repo.BulkUpsertKeysByModuleNameAndKeyNameAsync(
                new List<BlocksLanguageKey> { newKey },
                new List<BlocksLanguageKey> { existingKey },
                new Dictionary<string, string> { { "mod1", "m1" } },
                "tenant1", true);

            result.UpsertedKeys.Should().HaveCount(1);
        }

        [Fact]
        public async Task BulkUpsertKeysByModuleNameAndKeyNameAsync_WithoutOverwrite_OnlyInsertsNew()
        {
            var existingKey = new BlocksLanguageKey { ItemId = "k1", KeyName = "key1", ModuleId = "m1" };
            var newKey = new BlocksLanguageKey { ItemId = "k2", KeyName = "key2", ModuleId = "m1" };

            _keyCollection.Setup(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageKey>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync((BulkWriteResult<BlocksLanguageKey>)null!);

            var result = await _repo.BulkUpsertKeysByModuleNameAndKeyNameAsync(
                new List<BlocksLanguageKey> { existingKey, newKey },
                new List<BlocksLanguageKey> { existingKey },
                new Dictionary<string, string> { { "mod1", "m1" } },
                "tenant1", false);

            result.InsertedKeys.Should().HaveCount(1);
            result.InsertedKeys[0].ItemId.Should().Be("k2");
        }

        [Fact]
        public async Task BulkUpsertKeysByModuleNameAndKeyNameAsync_WithoutOverwrite_AllExist_NoInsert()
        {
            var existingKey = new BlocksLanguageKey { ItemId = "k1", KeyName = "key1", ModuleId = "m1" };

            var result = await _repo.BulkUpsertKeysByModuleNameAndKeyNameAsync(
                new List<BlocksLanguageKey> { existingKey },
                new List<BlocksLanguageKey> { existingKey },
                new Dictionary<string, string> { { "mod1", "m1" } },
                "tenant1", false);

            result.InsertedKeys.Should().BeEmpty();
        }

        #endregion

        #region MergeResources (private, tested through BulkUpsertKeysAsync)

        [Fact]
        public async Task BulkUpsertKeysAsync_WithOverwrite_NullExistingResources_UsesNewResources()
        {
            var newKey = new BlocksLanguageKey
            {
                ItemId = "k1", KeyName = "key1", ModuleId = "m1",
                Resources = new[] { new Resource { Culture = "en", Value = "Hello" } }
            };
            var existingKey = new BlocksLanguageKey
            {
                ItemId = "k1", KeyName = "key1", ModuleId = "m1",
                Resources = null
            };

            var bulkResult = new BulkWriteResult<BlocksLanguageKey>.Acknowledged(
                1, 0, 0, 0, 0,
                new List<WriteModel<BlocksLanguageKey>>(),
                new List<BulkWriteUpsert>());

            _keyCollection.Setup(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageKey>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync(bulkResult);

            var result = await _repo.BulkUpsertKeysAsync(
                new List<BlocksLanguageKey> { newKey },
                new List<BlocksLanguageKey> { existingKey },
                "tenant1", true);

            result.UpsertedKeys.Should().HaveCount(1);
        }

        [Fact]
        public async Task BulkUpsertKeysAsync_WithOverwrite_NullNewResources_KeepsExisting()
        {
            var newKey = new BlocksLanguageKey
            {
                ItemId = "k1", KeyName = "key1", ModuleId = "m1",
                Resources = null
            };
            var existingKey = new BlocksLanguageKey
            {
                ItemId = "k1", KeyName = "key1", ModuleId = "m1",
                Resources = new[] { new Resource { Culture = "en", Value = "Hello" } }
            };

            var bulkResult = new BulkWriteResult<BlocksLanguageKey>.Acknowledged(
                1, 0, 0, 0, 0,
                new List<WriteModel<BlocksLanguageKey>>(),
                new List<BulkWriteUpsert>());

            _keyCollection.Setup(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageKey>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync(bulkResult);

            var result = await _repo.BulkUpsertKeysAsync(
                new List<BlocksLanguageKey> { newKey },
                new List<BlocksLanguageKey> { existingKey },
                "tenant1", true);

            result.UpsertedKeys.Should().HaveCount(1);
        }

        #endregion
    }
}
