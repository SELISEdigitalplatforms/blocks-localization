using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared.Entities;
using FluentAssertions;
using Moq;
using MongoDB.Bson;
using MongoDB.Driver;
using Xunit;
using KeyTimelineModel = Eurolm.DomainService.Services.KeyTimeline;

namespace XUnitTest
{
    public class RepositoryImplementationTests
    {
        [Fact]
        public async Task BlocksWebhookRepository_SaveAsync_UsesUpsertReplace()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var database = new Mock<IMongoDatabase>();
            var collection = new Mock<IMongoCollection<BlocksWebhook>>();

            dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(database.Object);
            database.Setup(x => x.GetCollection<BlocksWebhook>("BlocksWebhooks", It.IsAny<MongoCollectionSettings>()))
                .Returns(collection.Object);
            collection.Setup(x => x.ReplaceOneAsync(
                    It.IsAny<FilterDefinition<BlocksWebhook>>(),
                    It.IsAny<BlocksWebhook>(),
                    It.IsAny<ReplaceOptions>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Mock.Of<ReplaceOneResult>());

            var repository = new BlocksWebhookRepository(dbContextProvider.Object);
            var webhook = new BlocksWebhook
            {
                ItemId = "webhook-1",
                Url = "https://example.com/webhook",
                ContentType = "application/json",
                BlocksWebhookSecret = new BlocksWebhookSecret { Secret = "secret", HeaderKey = "x-signature" }
            };

            await repository.SaveAsync(webhook);

            collection.Verify(x => x.ReplaceOneAsync(
                    It.IsAny<FilterDefinition<BlocksWebhook>>(),
                    webhook,
                    It.Is<ReplaceOptions>(o => o.IsUpsert),
                    It.IsAny<CancellationToken>()),
                Times.Once);
        }

        [Fact]
        public async Task BlocksWebhookRepository_GetAsync_ReturnsFirstWebhook()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var database = new Mock<IMongoDatabase>();
            var collection = new Mock<IMongoCollection<BlocksWebhook>>();
            var cursor = new Mock<IAsyncCursor<BlocksWebhook>>();

            dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(database.Object);
            database.Setup(x => x.GetCollection<BlocksWebhook>("BlocksWebhooks", It.IsAny<MongoCollectionSettings>()))
                .Returns(collection.Object);

            var expected = new BlocksWebhook
            {
                ItemId = "webhook-1",
                Url = "https://example.com/webhook",
                ContentType = "application/json",
                BlocksWebhookSecret = new BlocksWebhookSecret { Secret = "secret", HeaderKey = "x-signature" }
            };

            cursor.SetupSequence(x => x.MoveNext(It.IsAny<CancellationToken>()))
                .Returns(true)
                .Returns(false);
            cursor.SetupSequence(x => x.MoveNextAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(true)
                .ReturnsAsync(false);
            cursor.Setup(x => x.Current).Returns(new List<BlocksWebhook> { expected });

            collection.Setup(x => x.FindAsync(
                    It.IsAny<FilterDefinition<BlocksWebhook>>(),
                    It.IsAny<FindOptions<BlocksWebhook, BlocksWebhook>>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(cursor.Object);

            var repository = new BlocksWebhookRepository(dbContextProvider.Object);

            var result = await repository.GetAsync();

            result.Should().NotBeNull();
            result.ItemId.Should().Be("webhook-1");
        }

        [Fact]
        public async Task EnvironmentDataMigrationRepository_BulkUpsertModulesAsync_EmptyInput_DoesNotTouchDatabase()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var repository = new EnvironmentDataMigrationRepository(dbContextProvider.Object);

            await repository.BulkUpsertModulesAsync(new List<BlocksLanguageModule>(), "target-tenant", shouldOverwrite: true);

            dbContextProvider.Verify(x => x.GetDatabase(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task EnvironmentDataMigrationRepository_BulkUpsertKeysAsync_EmptyInput_ReturnsEmptyResult()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var repository = new EnvironmentDataMigrationRepository(dbContextProvider.Object);

            var result = await repository.BulkUpsertKeysAsync(
                new List<BlocksLanguageKey>(),
                new List<BlocksLanguageKey>(),
                "target-tenant",
                shouldOverwrite: false);

            result.Should().NotBeNull();
            result.UpsertedKeys.Should().BeEmpty();
            result.InsertedKeys.Should().BeEmpty();
            result.UpdatedKeys.Should().BeEmpty();
            dbContextProvider.Verify(x => x.GetDatabase(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task EnvironmentDataMigrationRepository_GetExistingKeysByItemIds_EmptyInput_DoesNotTouchDatabase()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var repository = new EnvironmentDataMigrationRepository(dbContextProvider.Object);

            var result = await repository.GetExistingKeysByItemIdsAsync(new List<string>(), "target-tenant");

            result.Should().BeEmpty();
            dbContextProvider.Verify(x => x.GetDatabase(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task EnvironmentDataMigrationRepository_GetExistingModulesByNames_EmptyInput_DoesNotTouchDatabase()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var repository = new EnvironmentDataMigrationRepository(dbContextProvider.Object);

            var result = await repository.GetExistingModulesByNamesAsync(new List<string>(), "target-tenant");

            result.Should().BeEmpty();
            dbContextProvider.Verify(x => x.GetDatabase(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task EnvironmentDataMigrationRepository_GetExistingKeysByModuleNameAndKeyName_EmptyPairs_DoesNotTouchDatabase()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var repository = new EnvironmentDataMigrationRepository(dbContextProvider.Object);

            var result = await repository.GetExistingKeysByModuleNameAndKeyNameAsync(
                new List<(string ModuleName, string KeyName)>(),
                new Dictionary<string, string> { ["Orders"] = "mod-1" },
                "target-tenant");

            result.Should().BeEmpty();
            dbContextProvider.Verify(x => x.GetDatabase(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task EnvironmentDataMigrationRepository_BulkUpsertModulesByNameAsync_EmptyInput_DoesNotTouchDatabase()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var repository = new EnvironmentDataMigrationRepository(dbContextProvider.Object);

            await repository.BulkUpsertModulesByNameAsync(new List<BlocksLanguageModule>(), "target-tenant", shouldOverwrite: true);

            dbContextProvider.Verify(x => x.GetDatabase(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task EnvironmentDataMigrationRepository_BulkUpsertKeysByModuleNameAndKeyNameAsync_EmptyInput_ReturnsEmptyResult()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var repository = new EnvironmentDataMigrationRepository(dbContextProvider.Object);

            var result = await repository.BulkUpsertKeysByModuleNameAndKeyNameAsync(
                new List<BlocksLanguageKey>(),
                new List<BlocksLanguageKey>(),
                new Dictionary<string, string>(),
                "target-tenant",
                shouldOverwrite: false);

            result.UpsertedKeys.Should().BeEmpty();
            result.InsertedKeys.Should().BeEmpty();
            result.UpdatedKeys.Should().BeEmpty();
            dbContextProvider.Verify(x => x.GetDatabase(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task EnvironmentDataMigrationRepository_UpdateMigrationTrackerAsync_UsesUpsertUpdate()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var database = new Mock<IMongoDatabase>();
            var collection = new Mock<IMongoCollection<MigrationTracker>>();

            dbContextProvider.Setup(x => x.GetDatabase()).Returns(database.Object);
            database.Setup(x => x.GetCollection<MigrationTracker>("MigrationTrackers", It.IsAny<MongoCollectionSettings>()))
                .Returns(collection.Object);
            collection.Setup(x => x.UpdateOneAsync(
                    It.IsAny<FilterDefinition<MigrationTracker>>(),
                    It.IsAny<UpdateDefinition<MigrationTracker>>(),
                    It.IsAny<UpdateOptions>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Mock.Of<UpdateResult>());

            var repository = new EnvironmentDataMigrationRepository(dbContextProvider.Object);
            var status = new ServiceMigrationStatus { IsCompleted = true, QueueName = "q1" };

            await repository.UpdateMigrationTrackerAsync("tracker-1", status);

            collection.Verify(x => x.UpdateOneAsync(
                It.IsAny<FilterDefinition<MigrationTracker>>(),
                It.IsAny<UpdateDefinition<MigrationTracker>>(),
                It.Is<UpdateOptions>(o => o.IsUpsert),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task EnvironmentDataMigrationRepository_BulkUpsertKeysByModuleNameAndKeyNameAsync_WhenOverwrite_UpdatesAndMergesResources()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var database = new Mock<IMongoDatabase>();
            var collection = new Mock<IMongoCollection<BlocksLanguageKey>>();

            dbContextProvider.Setup(x => x.GetDatabase("target-tenant")).Returns(database.Object);
            database.Setup(x => x.GetCollection<BlocksLanguageKey>("BlocksLanguageKeys", It.IsAny<MongoCollectionSettings>()))
                .Returns(collection.Object);

            IEnumerable<WriteModel<BlocksLanguageKey>>? capturedBulkOps = null;
            collection.Setup(x => x.BulkWriteAsync(
                    It.IsAny<IEnumerable<WriteModel<BlocksLanguageKey>>>(),
                    It.IsAny<BulkWriteOptions>(),
                    It.IsAny<CancellationToken>()))
                .Callback<IEnumerable<WriteModel<BlocksLanguageKey>>, BulkWriteOptions, CancellationToken>((ops, _, _) =>
                {
                    capturedBulkOps = ops;
                })
                .ReturnsAsync((BulkWriteResult<BlocksLanguageKey>)null!);

            var repository = new EnvironmentDataMigrationRepository(dbContextProvider.Object);

            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "k-1",
                    ModuleId = "mod-1",
                    KeyName = "welcome",
                    Value = "new",
                    Resources = new[]
                    {
                        new Resource { Culture = "en", Value = "new-en" },
                        new Resource { Culture = "de", Value = "new-de" }
                    },
                    Routes = new List<string>(),
                    CreateDate = DateTime.UtcNow,
                    LastUpdateDate = DateTime.UtcNow,
                    TenantId = "target-tenant",
                    CreatedBy = "u",
                    LastUpdatedBy = "u"
                }
            };

            var existing = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "k-old",
                    ModuleId = "mod-1",
                    KeyName = "welcome",
                    Value = "old",
                    Resources = new[]
                    {
                        new Resource { Culture = "fr", Value = "old-fr" },
                        new Resource { Culture = "en", Value = "old-en" }
                    },
                    Routes = new List<string>()
                }
            };

            var result = await repository.BulkUpsertKeysByModuleNameAndKeyNameAsync(
                keys,
                existing,
                new Dictionary<string, string>(),
                "target-tenant",
                shouldOverwrite: true);

            result.UpsertedKeys.Should().HaveCount(1);
            result.InsertedKeys.Should().BeEmpty();
            result.UpdatedKeys.Should().HaveCount(1);

            capturedBulkOps.Should().NotBeNull();
            var replaceModel = capturedBulkOps!.Single().Should().BeOfType<ReplaceOneModel<BlocksLanguageKey>>().Subject;
            replaceModel.Replacement.Resources.Select(r => r.Culture).Should().BeEquivalentTo(new[] { "fr", "en", "de" });
            replaceModel.Replacement.Resources.Single(r => r.Culture == "en").Value.Should().Be("new-en");
        }

        [Fact]
        public async Task KeyRepository_SaveKeyAsync_UsesUpsertReplace()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var database = new Mock<IMongoDatabase>();
            var collection = new Mock<IMongoCollection<BlocksLanguageKey>>();

            dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(database.Object);
            database.Setup(x => x.GetCollection<BlocksLanguageKey>("BlocksLanguageKeys", It.IsAny<MongoCollectionSettings>()))
                .Returns(collection.Object);
            collection.Setup(x => x.ReplaceOneAsync(
                    It.IsAny<FilterDefinition<BlocksLanguageKey>>(),
                    It.IsAny<BlocksLanguageKey>(),
                    It.IsAny<ReplaceOptions>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Mock.Of<ReplaceOneResult>());

            var repository = new KeyRepository(dbContextProvider.Object);
            var key = new BlocksLanguageKey
            {
                ItemId = "key-1",
                KeyName = "welcome",
                ModuleId = "module-1",
                Value = "Welcome",
                Resources = new[] { new Resource { Culture = "en", Value = "Welcome" } },
                Routes = new List<string>()
            };

            await repository.SaveKeyAsync(key);

            collection.Verify(x => x.ReplaceOneAsync(
                    It.IsAny<FilterDefinition<BlocksLanguageKey>>(),
                    key,
                    It.Is<ReplaceOptions>(o => o.IsUpsert),
                    It.IsAny<CancellationToken>()),
                Times.Once);
        }

        [Fact]
        public async Task KeyRepository_SaveNewUilmFiles_InsertsAndReturnsTrue()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var database = new Mock<IMongoDatabase>();
            var collection = new Mock<IMongoCollection<UilmFile>>();

            dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(database.Object);
            database.Setup(x => x.GetCollection<UilmFile>("UilmFiles", It.IsAny<MongoCollectionSettings>()))
                .Returns(collection.Object);
            collection.Setup(x => x.InsertManyAsync(
                    It.IsAny<IEnumerable<UilmFile>>(),
                    It.IsAny<InsertManyOptions>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            var repository = new KeyRepository(dbContextProvider.Object);
            var files = new List<UilmFile>
            {
                new UilmFile { ModuleName = "mod-1", Language = "en" }
            };

            var result = await repository.SaveNewUilmFiles(files);

            result.Should().BeTrue();
            collection.Verify(x => x.InsertManyAsync(
                files,
                It.IsAny<InsertManyOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task KeyRepository_DeleteOldUilmFiles_DeletesAndReturnsCount()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var database = new Mock<IMongoDatabase>();
            var collection = new Mock<IMongoCollection<UilmFile>>();
            var deleteResult = new Mock<DeleteResult>();

            deleteResult.SetupGet(x => x.DeletedCount).Returns(3);
            deleteResult.SetupGet(x => x.IsAcknowledged).Returns(true);

            dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(database.Object);
            database.Setup(x => x.GetCollection<UilmFile>("UilmFiles", It.IsAny<MongoCollectionSettings>()))
                .Returns(collection.Object);
            collection.Setup(x => x.DeleteManyAsync(
                    It.IsAny<FilterDefinition<UilmFile>>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(deleteResult.Object);

            var repository = new KeyRepository(dbContextProvider.Object);
            var files = new List<UilmFile>
            {
                new UilmFile { ModuleName = "mod-1" },
                new UilmFile { ModuleName = "mod-1" },
                new UilmFile { ModuleName = "mod-2" }
            };

            var deleted = await repository.DeleteOldUilmFiles(files);

            deleted.Should().Be(3);
            collection.Verify(x => x.DeleteManyAsync(
                It.IsAny<FilterDefinition<UilmFile>>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task KeyRepository_DeleteAsync_DeletesSingleItem()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var database = new Mock<IMongoDatabase>();
            var collection = new Mock<IMongoCollection<BlocksLanguageKey>>();

            dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(database.Object);
            database.Setup(x => x.GetCollection<BlocksLanguageKey>("BlocksLanguageKeys", It.IsAny<MongoCollectionSettings>()))
                .Returns(collection.Object);
            collection.Setup(x => x.DeleteOneAsync(
                    It.IsAny<FilterDefinition<BlocksLanguageKey>>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Mock.Of<DeleteResult>());

            var repository = new KeyRepository(dbContextProvider.Object);

            await repository.DeleteAsync("item-1");

            collection.Verify(x => x.DeleteOneAsync(
                It.IsAny<FilterDefinition<BlocksLanguageKey>>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task KeyRepository_InsertUilmResourceKeys_WithTenantOverload_Inserts()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var database = new Mock<IMongoDatabase>();
            var collection = new Mock<IMongoCollection<BlocksLanguageKey>>();

            dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(database.Object);
            database.Setup(x => x.GetCollection<BlocksLanguageKey>("BlocksLanguageKeys", It.IsAny<MongoCollectionSettings>()))
                .Returns(collection.Object);
            collection.Setup(x => x.InsertManyAsync(
                    It.IsAny<IEnumerable<BlocksLanguageKey>>(),
                    It.IsAny<InsertManyOptions>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            var repository = new KeyRepository(dbContextProvider.Object);
            var entities = new List<BlocksLanguageKey> { new BlocksLanguageKey { ItemId = "k-1" } };

            await repository.InsertUilmResourceKeys(entities, "tenant-a");

            collection.Verify(x => x.InsertManyAsync(
                entities,
                It.IsAny<InsertManyOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task KeyRepository_InsertUilmApplications_Overloads_Insert()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var database = new Mock<IMongoDatabase>();
            var collection = new Mock<IMongoCollection<BlocksLanguageModule>>();

            dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(database.Object);
            database.Setup(x => x.GetCollection<BlocksLanguageModule>("BlocksLanguageModules", It.IsAny<MongoCollectionSettings>()))
                .Returns(collection.Object);
            collection.Setup(x => x.InsertManyAsync(
                    It.IsAny<IEnumerable<BlocksLanguageModule>>(),
                    It.IsAny<InsertManyOptions>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            var repository = new KeyRepository(dbContextProvider.Object);
            var entities = new List<BlocksLanguageModule> { new BlocksLanguageModule { ItemId = "m-1", Name = "Module 1" } };

            await repository.InsertUilmApplications(entities, "tenant-a");
            await repository.InsertUilmApplications(entities);

            collection.Verify(x => x.InsertManyAsync(
                entities,
                It.IsAny<InsertManyOptions>(),
                It.IsAny<CancellationToken>()), Times.Exactly(2));
        }

        [Fact]
        public async Task KeyRepository_UpdateUilmResourceKeysForChangeAll_WhenBulkWriteReturnsNull_ReturnsNull()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var database = new Mock<IMongoDatabase>();
            var collection = new Mock<IMongoCollection<BlocksLanguageKey>>();

            dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(database.Object);
            database.Setup(x => x.GetCollection<BlocksLanguageKey>("BlocksLanguageKeys", It.IsAny<MongoCollectionSettings>()))
                .Returns(collection.Object);
            collection.Setup(x => x.BulkWriteAsync(
                    It.IsAny<IEnumerable<WriteModel<BlocksLanguageKey>>>(),
                    It.IsAny<BulkWriteOptions>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync((BulkWriteResult<BlocksLanguageKey>)null!);

            var repository = new KeyRepository(dbContextProvider.Object);
            var keys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "k-1",
                    ModuleId = "mod-1",
                    KeyName = "welcome",
                    Resources = new[] { new Resource { Culture = "en", Value = "Welcome" } }
                }
            };

            var result = await repository.UpdateUilmResourceKeysForChangeAll(keys);

            result.Should().BeNull();
            collection.Verify(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageKey>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task KeyRepository_UpdateBulkUilmApplications_PerformsInternalAndUpsertBulkWrites()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var database = new Mock<IMongoDatabase>();
            var uilmApplicationsCollection = new Mock<IMongoCollection<BsonDocument>>();
            var modulesDocCollection = new Mock<IMongoCollection<BsonDocument>>();
            var modulesEntityCollection = new Mock<IMongoCollection<BlocksLanguageModule>>();

            dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(database.Object);
            database.Setup(x => x.GetCollection<BsonDocument>("UilmApplications", It.IsAny<MongoCollectionSettings>()))
                .Returns(uilmApplicationsCollection.Object);
            database.Setup(x => x.GetCollection<BsonDocument>("BlocksLanguageModules", It.IsAny<MongoCollectionSettings>()))
                .Returns(modulesDocCollection.Object);
            database.Setup(x => x.GetCollection<BlocksLanguageModule>("BlocksLanguageModules", It.IsAny<MongoCollectionSettings>()))
                .Returns(modulesEntityCollection.Object);

            uilmApplicationsCollection.Setup(x => x.BulkWriteAsync(
                    It.IsAny<IEnumerable<WriteModel<BsonDocument>>>(),
                    It.IsAny<BulkWriteOptions>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync((BulkWriteResult<BsonDocument>)null!);
            modulesEntityCollection.Setup(x => x.BulkWriteAsync(
                    It.IsAny<IEnumerable<WriteModel<BlocksLanguageModule>>>(),
                    It.IsAny<BulkWriteOptions>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync((BulkWriteResult<BlocksLanguageModule>)null!);

            var repository = new KeyRepository(dbContextProvider.Object);
            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "m-1", Name = "Orders" }
            };

            await repository.UpdateBulkUilmApplications(modules, "org-1", isExternal: false, clientTenantId: "tenant-a");

            uilmApplicationsCollection.Verify(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BsonDocument>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
            modulesDocCollection.Verify(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BsonDocument>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>()), Times.Never);
            modulesEntityCollection.Verify(x => x.BulkWriteAsync(
                It.IsAny<IEnumerable<WriteModel<BlocksLanguageModule>>>(),
                It.IsAny<BulkWriteOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task KeyRepository_UpdateKeysCountOfAppAsync_InternalBranch_UpdatesBothCollections()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var database = new Mock<IMongoDatabase>();
            var resourceKeysCollection = new Mock<IMongoCollection<BsonDocument>>();
            var uilmApplicationsCollection = new Mock<IMongoCollection<BsonDocument>>();
            var blocksLanguageApplicationsCollection = new Mock<IMongoCollection<BsonDocument>>();

            dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(database.Object);
            database.Setup(x => x.GetCollection<BsonDocument>("UilmResourceKeys", It.IsAny<MongoCollectionSettings>()))
                .Returns(resourceKeysCollection.Object);
            database.Setup(x => x.GetCollection<BsonDocument>("UilmApplications", It.IsAny<MongoCollectionSettings>()))
                .Returns(uilmApplicationsCollection.Object);
            database.Setup(x => x.GetCollection<BsonDocument>("BlocksLanguageApplications", It.IsAny<MongoCollectionSettings>()))
                .Returns(blocksLanguageApplicationsCollection.Object);

            resourceKeysCollection.Setup(x => x.CountDocumentsAsync(
                    It.IsAny<FilterDefinition<BsonDocument>>(),
                    It.IsAny<CountOptions>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(5);
            uilmApplicationsCollection.Setup(x => x.UpdateOneAsync(
                    It.IsAny<FilterDefinition<BsonDocument>>(),
                    It.IsAny<UpdateDefinition<BsonDocument>>(),
                    It.IsAny<UpdateOptions>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Mock.Of<UpdateResult>());
            blocksLanguageApplicationsCollection.Setup(x => x.UpdateOneAsync(
                    It.IsAny<FilterDefinition<BsonDocument>>(),
                    It.IsAny<UpdateDefinition<BsonDocument>>(),
                    It.IsAny<UpdateOptions>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Mock.Of<UpdateResult>());

            var repository = new KeyRepository(dbContextProvider.Object);

            var result = await repository.UpdateKeysCountOfAppAsync("app-1", isExternal: false, tenantId: "tenant-a", organizationId: "org-1");

            result.Should().BeTrue();
            resourceKeysCollection.Verify(x => x.CountDocumentsAsync(
                It.IsAny<FilterDefinition<BsonDocument>>(),
                It.IsAny<CountOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
            uilmApplicationsCollection.Verify(x => x.UpdateOneAsync(
                It.IsAny<FilterDefinition<BsonDocument>>(),
                It.IsAny<UpdateDefinition<BsonDocument>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
            blocksLanguageApplicationsCollection.Verify(x => x.UpdateOneAsync(
                It.IsAny<FilterDefinition<BsonDocument>>(),
                It.IsAny<UpdateDefinition<BsonDocument>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task KeyRepository_UpdateKeysCountOfAppAsync_ExternalBranch_UpdatesBlocksLanguageApplicationsOnly()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var database = new Mock<IMongoDatabase>();
            var blocksLanguageKeysCollection = new Mock<IMongoCollection<BsonDocument>>();
            var blocksLanguageApplicationsCollection = new Mock<IMongoCollection<BsonDocument>>();

            dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(database.Object);
            database.Setup(x => x.GetCollection<BsonDocument>("BlocksLanguageKeys", It.IsAny<MongoCollectionSettings>()))
                .Returns(blocksLanguageKeysCollection.Object);
            database.Setup(x => x.GetCollection<BsonDocument>("BlocksLanguageApplications", It.IsAny<MongoCollectionSettings>()))
                .Returns(blocksLanguageApplicationsCollection.Object);

            blocksLanguageKeysCollection.Setup(x => x.CountDocumentsAsync(
                    It.IsAny<FilterDefinition<BsonDocument>>(),
                    It.IsAny<CountOptions>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(7);
            blocksLanguageApplicationsCollection.Setup(x => x.UpdateOneAsync(
                    It.IsAny<FilterDefinition<BsonDocument>>(),
                    It.IsAny<UpdateDefinition<BsonDocument>>(),
                    It.IsAny<UpdateOptions>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Mock.Of<UpdateResult>());

            var repository = new KeyRepository(dbContextProvider.Object);

            var result = await repository.UpdateKeysCountOfAppAsync("app-1", isExternal: true, tenantId: "tenant-a", organizationId: "org-1");

            result.Should().BeTrue();
            blocksLanguageKeysCollection.Verify(x => x.CountDocumentsAsync(
                It.IsAny<FilterDefinition<BsonDocument>>(),
                It.IsAny<CountOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
            blocksLanguageApplicationsCollection.Verify(x => x.UpdateOneAsync(
                It.IsAny<FilterDefinition<BsonDocument>>(),
                It.IsAny<UpdateDefinition<BsonDocument>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task KeyTimelineRepository_SaveKeyTimelineAsync_WithNoItemId_Inserts()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var configuration = new Mock<Microsoft.Extensions.Configuration.IConfiguration>();
            var database = new Mock<IMongoDatabase>();
            var collection = new Mock<IMongoCollection<KeyTimelineModel>>();

            dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(database.Object);
            database.Setup(x => x.GetCollection<KeyTimelineModel>("KeyTimelines", It.IsAny<MongoCollectionSettings>()))
                .Returns(collection.Object);
            collection.Setup(x => x.InsertOneAsync(It.IsAny<KeyTimelineModel>(), It.IsAny<InsertOneOptions>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            var repository = new KeyTimelineRepository(dbContextProvider.Object, configuration.Object);
            var timeline = new KeyTimelineModel
            {
                ItemId = null!,
                EntityId = "entity-1",
                UserId = "user-1"
            };

            await repository.SaveKeyTimelineAsync(timeline);

            timeline.ItemId.Should().NotBeNullOrWhiteSpace();
            collection.Verify(x => x.InsertOneAsync(
                    It.IsAny<KeyTimelineModel>(),
                    It.IsAny<InsertOneOptions>(),
                    It.IsAny<CancellationToken>()),
                Times.Once);
        }

        [Fact]
        public async Task KeyTimelineRepository_SaveKeyTimelineAsync_WithItemId_Upserts()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var configuration = new Mock<Microsoft.Extensions.Configuration.IConfiguration>();
            var database = new Mock<IMongoDatabase>();
            var collection = new Mock<IMongoCollection<KeyTimelineModel>>();

            dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(database.Object);
            database.Setup(x => x.GetCollection<KeyTimelineModel>("KeyTimelines", It.IsAny<MongoCollectionSettings>()))
                .Returns(collection.Object);
            collection.Setup(x => x.ReplaceOneAsync(
                    It.IsAny<FilterDefinition<KeyTimelineModel>>(),
                    It.IsAny<KeyTimelineModel>(),
                    It.IsAny<ReplaceOptions>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Mock.Of<ReplaceOneResult>());

            var repository = new KeyTimelineRepository(dbContextProvider.Object, configuration.Object);
            var timeline = new KeyTimelineModel
            {
                ItemId = "timeline-1",
                EntityId = "entity-1",
                UserId = "user-1",
                CreateDate = DateTime.UtcNow.AddDays(-1)
            };

            await repository.SaveKeyTimelineAsync(timeline);

            timeline.LastUpdateDate.Should().BeAfter(timeline.CreateDate);
            collection.Verify(x => x.ReplaceOneAsync(
                    It.IsAny<FilterDefinition<KeyTimelineModel>>(),
                    timeline,
                    It.Is<ReplaceOptions>(o => o.IsUpsert),
                    It.IsAny<CancellationToken>()),
                Times.Once);
            collection.Verify(x => x.InsertOneAsync(
                    It.IsAny<KeyTimelineModel>(),
                    It.IsAny<InsertOneOptions>(),
                    It.IsAny<CancellationToken>()),
                Times.Never);
        }

        [Fact]
        public async Task KeyTimelineRepository_BulkSaveKeyTimelinesAsync_EmptyList_DoesNotTouchDatabase()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var configuration = new Mock<Microsoft.Extensions.Configuration.IConfiguration>();
            var repository = new KeyTimelineRepository(dbContextProvider.Object, configuration.Object);

            await repository.BulkSaveKeyTimelinesAsync(new List<KeyTimelineModel>(), "tenant-a");

            dbContextProvider.Verify(x => x.GetDatabase(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task KeyTimelineRepository_BulkSaveKeyTimelinesAsync_WithItems_SetsIdsAndDatesAndInserts()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var configuration = new Mock<Microsoft.Extensions.Configuration.IConfiguration>();
            var database = new Mock<IMongoDatabase>();
            var collection = new Mock<IMongoCollection<KeyTimelineModel>>();

            dbContextProvider.Setup(x => x.GetDatabase("target-tenant")).Returns(database.Object);
            database.Setup(x => x.GetCollection<KeyTimelineModel>("KeyTimelines", It.IsAny<MongoCollectionSettings>()))
                .Returns(collection.Object);
            collection.Setup(x => x.InsertManyAsync(
                    It.IsAny<IEnumerable<KeyTimelineModel>>(),
                    It.IsAny<InsertManyOptions>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            var repository = new KeyTimelineRepository(dbContextProvider.Object, configuration.Object);
            var timelines = new List<KeyTimelineModel>
            {
                new KeyTimelineModel { ItemId = null!, EntityId = "e-1", UserId = "u-1" },
                new KeyTimelineModel { ItemId = "existing-id", EntityId = "e-2", UserId = "u-2" }
            };

            await repository.BulkSaveKeyTimelinesAsync(timelines, "target-tenant");

            timelines[0].ItemId.Should().NotBeNullOrWhiteSpace();
            timelines[0].CreateDate.Should().NotBe(default);
            timelines[0].LastUpdateDate.Should().NotBe(default);
            timelines[1].ItemId.Should().Be("existing-id");
            timelines[1].CreateDate.Should().NotBe(default);
            timelines[1].LastUpdateDate.Should().NotBe(default);
            timelines[0].CreateDate.Should().Be(timelines[1].CreateDate);
            timelines[0].LastUpdateDate.Should().Be(timelines[1].LastUpdateDate);

            collection.Verify(x => x.InsertManyAsync(
                    timelines,
                    It.IsAny<InsertManyOptions>(),
                    It.IsAny<CancellationToken>()),
                Times.Once);
        }

        [Fact]
        public async Task LanguageRepository_SaveAsync_UsesUpsertReplace()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var database = new Mock<IMongoDatabase>();
            var collection = new Mock<IMongoCollection<BlocksLanguage>>();

            dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(database.Object);
            database.Setup(x => x.GetCollection<BlocksLanguage>("BlocksLanguages", It.IsAny<MongoCollectionSettings>()))
                .Returns(collection.Object);
            collection.Setup(x => x.ReplaceOneAsync(
                    It.IsAny<FilterDefinition<BlocksLanguage>>(),
                    It.IsAny<BlocksLanguage>(),
                    It.IsAny<ReplaceOptions>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Mock.Of<ReplaceOneResult>());

            var repository = new LanguageRepository(dbContextProvider.Object);
            var language = new BlocksLanguage
            {
                ItemId = "lang-1",
                LanguageName = "English",
                LanguageCode = "en",
                IsDefault = true
            };

            await repository.SaveAsync(language);

            collection.Verify(x => x.ReplaceOneAsync(
                    It.IsAny<FilterDefinition<BlocksLanguage>>(),
                    language,
                    It.Is<ReplaceOptions>(o => o.IsUpsert),
                    It.IsAny<CancellationToken>()),
                Times.Once);
        }

        [Fact]
        public async Task LanguageRepository_DeleteAsync_DeletesByLanguageName()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var database = new Mock<IMongoDatabase>();
            var collection = new Mock<IMongoCollection<BlocksLanguage>>();

            dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(database.Object);
            database.Setup(x => x.GetCollection<BlocksLanguage>("BlocksLanguages", It.IsAny<MongoCollectionSettings>()))
                .Returns(collection.Object);
            collection.Setup(x => x.DeleteOneAsync(
                    It.IsAny<FilterDefinition<BlocksLanguage>>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Mock.Of<DeleteResult>());

            var repository = new LanguageRepository(dbContextProvider.Object);

            await repository.DeleteAsync("English");

            collection.Verify(x => x.DeleteOneAsync(
                    It.IsAny<FilterDefinition<BlocksLanguage>>(),
                    It.IsAny<CancellationToken>()),
                Times.Once);
        }

        [Fact]
        public async Task LanguageRepository_RemoveDefault_UpdatesOtherLanguagesToFalse()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var database = new Mock<IMongoDatabase>();
            var collection = new Mock<IMongoCollection<BlocksLanguage>>();

            dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(database.Object);
            database.Setup(x => x.GetCollection<BlocksLanguage>("BlocksLanguages", It.IsAny<MongoCollectionSettings>()))
                .Returns(collection.Object);
            collection.Setup(x => x.UpdateManyAsync(
                    It.IsAny<FilterDefinition<BlocksLanguage>>(),
                    It.IsAny<UpdateDefinition<BlocksLanguage>>(),
                    It.IsAny<UpdateOptions>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Mock.Of<UpdateResult>());

            var repository = new LanguageRepository(dbContextProvider.Object);
            var language = new BlocksLanguage
            {
                ItemId = "lang-1",
                LanguageName = "English",
                LanguageCode = "en",
                IsDefault = true
            };

            await repository.RemoveDefault(language);

            collection.Verify(x => x.UpdateManyAsync(
                    It.IsAny<FilterDefinition<BlocksLanguage>>(),
                    It.IsAny<UpdateDefinition<BlocksLanguage>>(),
                    It.IsAny<UpdateOptions>(),
                    It.IsAny<CancellationToken>()),
                Times.Once);
        }

        [Fact]
        public async Task LanguageFileGenerationHistoryRepository_SaveAsync_InsertsHistory()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var database = new Mock<IMongoDatabase>();
            var collection = new Mock<IMongoCollection<LanguageFileGenerationHistory>>();

            dbContextProvider.Setup(x => x.GetDatabase("tenant-a")).Returns(database.Object);
            database.Setup(x => x.GetCollection<LanguageFileGenerationHistory>("LanguageFileGenerationHistory", It.IsAny<MongoCollectionSettings>()))
                .Returns(collection.Object);
            collection.Setup(x => x.InsertOneAsync(
                    It.IsAny<LanguageFileGenerationHistory>(),
                    It.IsAny<InsertOneOptions>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            var repository = new LanguageFileGenerationHistoryRepository(dbContextProvider.Object);
            var history = new LanguageFileGenerationHistory
            {
                ItemId = "h-1",
                ProjectKey = "tenant-a",
                Version = 1,
                ModuleId = "module-1",
                CreateDate = DateTime.UtcNow
            };

            await repository.SaveAsync(history);

            collection.Verify(x => x.InsertOneAsync(
                    history,
                    It.IsAny<InsertOneOptions>(),
                    It.IsAny<CancellationToken>()),
                Times.Once);
        }

        [Fact]
        public async Task ModuleRepository_SaveAsync_UsesUpsertReplace()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var database = new Mock<IMongoDatabase>();
            var collection = new Mock<IMongoCollection<BlocksLanguageModule>>();

            dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(database.Object);
            database.Setup(x => x.GetCollection<BlocksLanguageModule>("BlocksLanguageModules", It.IsAny<MongoCollectionSettings>()))
                .Returns(collection.Object);
            collection.Setup(x => x.ReplaceOneAsync(
                    It.IsAny<FilterDefinition<BlocksLanguageModule>>(),
                    It.IsAny<BlocksLanguageModule>(),
                    It.IsAny<ReplaceOptions>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Mock.Of<ReplaceOneResult>());

            var repository = new ModuleRepository(dbContextProvider.Object);
            var module = new BlocksLanguageModule
            {
                ItemId = "module-1",
                ModuleName = "auth",
                Name = "Authentication"
            };

            await repository.SaveAsync(module);

            collection.Verify(x => x.ReplaceOneAsync(
                    It.IsAny<FilterDefinition<BlocksLanguageModule>>(),
                    module,
                    It.Is<ReplaceOptions>(o => o.IsUpsert),
                    It.IsAny<CancellationToken>()),
                Times.Once);
        }

        [Fact]
        public async Task ModuleRepository_SaveAsync_WithEmptyModuleName_StillUsesUpsertReplace()
        {
            var dbContextProvider = new Mock<IDbContextProvider>();
            var database = new Mock<IMongoDatabase>();
            var collection = new Mock<IMongoCollection<BlocksLanguageModule>>();

            dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(database.Object);
            database.Setup(x => x.GetCollection<BlocksLanguageModule>("BlocksLanguageModules", It.IsAny<MongoCollectionSettings>()))
                .Returns(collection.Object);
            collection.Setup(x => x.ReplaceOneAsync(
                    It.IsAny<FilterDefinition<BlocksLanguageModule>>(),
                    It.IsAny<BlocksLanguageModule>(),
                    It.IsAny<ReplaceOptions>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(Mock.Of<ReplaceOneResult>());

            var repository = new ModuleRepository(dbContextProvider.Object);
            var module = new BlocksLanguageModule
            {
                ItemId = "module-2",
                ModuleName = string.Empty,
                Name = "Fallback Name"
            };

            await repository.SaveAsync(module);

            collection.Verify(x => x.ReplaceOneAsync(
                    It.IsAny<FilterDefinition<BlocksLanguageModule>>(),
                    module,
                    It.Is<ReplaceOptions>(o => o.IsUpsert),
                    It.IsAny<CancellationToken>()),
                Times.Once);
        }

    }
}
