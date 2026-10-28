using Eurolm.DomainService.Repositories;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using Moq;
using Xunit;

namespace XUnitTest.Repositories
{
    public class GlossaryIndexInitializerTests
    {
        // The initializer caches per tenant for the whole process, so every test uses its own tenant id.
        private static string NewTenant(string prefix) => prefix + "-" + Guid.NewGuid().ToString("N");

        private static (Mock<IMongoCollection<BlocksGlossary>> Collection, Mock<IMongoIndexManager<BlocksGlossary>> Indexes) NewCollection()
        {
            var indexes = new Mock<IMongoIndexManager<BlocksGlossary>>();
            indexes
                .Setup(x => x.CreateManyAsync(It.IsAny<IEnumerable<CreateIndexModel<BlocksGlossary>>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<string>());
            var collection = new Mock<IMongoCollection<BlocksGlossary>>();
            collection.Setup(x => x.Indexes).Returns(indexes.Object);
            return (collection, indexes);
        }

        private static void VerifyCreateMany(Mock<IMongoIndexManager<BlocksGlossary>> indexes, Func<Times> times) =>
            indexes.Verify(x => x.CreateManyAsync(It.IsAny<IEnumerable<CreateIndexModel<BlocksGlossary>>>(), It.IsAny<CancellationToken>()), times);

        [Fact]
        public void Indexes_cover_IsGlobal_and_ModuleIds_by_name()
        {
            var registry = BsonSerializer.SerializerRegistry;
            var args = new RenderArgs<BlocksGlossary>(registry.GetSerializer<BlocksGlossary>(), registry);

            var rendered = GlossaryIndexInitializer.Indexes
                .Select(m => (m.Options.Name, Keys: m.Keys.Render(args).ToJson()))
                .ToList();

            rendered.Should().BeEquivalentTo(new[]
            {
                ("ix_isglobal", BsonDocument.Parse("{ IsGlobal: 1 }").ToJson()),
                ("ix_moduleids", BsonDocument.Parse("{ ModuleIds: 1 }").ToJson())
            });
        }

        [Fact]
        public async Task Indexes_are_ensured_once_per_tenant_per_process()
        {
            var (collection, indexes) = NewCollection();
            var tenant = NewTenant("once");

            var first = GlossaryIndexInitializer.EnsureStarted(tenant, collection.Object, NullLogger.Instance);
            var second = GlossaryIndexInitializer.EnsureStarted(tenant, collection.Object, NullLogger.Instance);
            await first;
            var third = GlossaryIndexInitializer.EnsureStarted(tenant, collection.Object, NullLogger.Instance);

            second.Should().BeSameAs(first);
            third.Should().BeSameAs(first);
            VerifyCreateMany(indexes, Times.Once);
        }

        [Fact]
        public async Task A_failure_is_logged_never_thrown_and_retried_on_the_next_call()
        {
            var indexes = new Mock<IMongoIndexManager<BlocksGlossary>>();
            indexes
                .SetupSequence(x => x.CreateManyAsync(It.IsAny<IEnumerable<CreateIndexModel<BlocksGlossary>>>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("not authorized"))
                .ReturnsAsync(new List<string>());
            var collection = new Mock<IMongoCollection<BlocksGlossary>>();
            collection.Setup(x => x.Indexes).Returns(indexes.Object);
            var logger = new Mock<ILogger>();
            var tenant = NewTenant("retry");

            var failed = GlossaryIndexInitializer.EnsureStarted(tenant, collection.Object, logger.Object);
            await failed.Invoking(t => t).Should().NotThrowAsync();

            var retried = GlossaryIndexInitializer.EnsureStarted(tenant, collection.Object, logger.Object);
            await retried;
            var afterSuccess = GlossaryIndexInitializer.EnsureStarted(tenant, collection.Object, logger.Object);

            retried.Should().NotBeSameAs(failed);
            afterSuccess.Should().BeSameAs(retried);
            VerifyCreateMany(indexes, () => Times.Exactly(2));
            logger.Verify(x => x.Log(LogLevel.Warning, It.IsAny<EventId>(), It.IsAny<It.IsAnyType>(),
                It.Is<Exception?>(e => e is InvalidOperationException && e.Message == "not authorized"),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()), Times.Once);
        }

        [Fact]
        public async Task EnsureAsync_reports_failure_without_throwing()
        {
            var indexes = new Mock<IMongoIndexManager<BlocksGlossary>>();
            indexes
                .Setup(x => x.CreateManyAsync(It.IsAny<IEnumerable<CreateIndexModel<BlocksGlossary>>>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("boom"));
            var collection = new Mock<IMongoCollection<BlocksGlossary>>();
            collection.Setup(x => x.Indexes).Returns(indexes.Object);

            var ok = await GlossaryIndexInitializer.EnsureAsync("tenant-x", collection.Object, NullLogger.Instance);

            ok.Should().BeFalse();
        }

        [Fact]
        public async Task Each_tenant_gets_its_own_indexes_in_its_own_collection()
        {
            var (collectionA, indexesA) = NewCollection();
            var (collectionB, indexesB) = NewCollection();

            var a = GlossaryIndexInitializer.EnsureStarted(NewTenant("a"), collectionA.Object, NullLogger.Instance);
            var b = GlossaryIndexInitializer.EnsureStarted(NewTenant("b"), collectionB.Object, NullLogger.Instance);
            await Task.WhenAll(a, b);

            a.Should().NotBeSameAs(b);
            VerifyCreateMany(indexesA, Times.Once);
            VerifyCreateMany(indexesB, Times.Once);
        }

        [Fact]
        public async Task Repository_calls_ensure_indexes_in_the_context_tenant_database()
        {
            var tenant = NewTenant("repo");
            XUnitTest.Shared.TestBlocksContext.Set(tenant);
            var (collection, indexes) = NewCollection();
            var database = new Mock<IMongoDatabase>();
            database.Setup(x => x.GetCollection<BlocksGlossary>("BlocksGlossaries", null)).Returns(collection.Object);
            var provider = new Mock<Blocks.Genesis.IDbContextProvider>();
            provider.Setup(x => x.GetDatabase(tenant)).Returns(database.Object);
            collection.Setup(x => x.DeleteOneAsync(It.IsAny<FilterDefinition<BlocksGlossary>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Mock.Of<DeleteResult>());

            await new GlossaryRepository(provider.Object).DeleteAsync("g1");
            // The build runs in the background; wait on the cached task for this tenant.
            await GlossaryIndexInitializer.EnsureStarted(tenant, collection.Object, NullLogger.Instance);

            VerifyCreateMany(indexes, Times.Once);
            provider.Verify(x => x.GetDatabase(It.Is<string>(t => t != tenant)), Times.Never);
        }

        [Fact]
        public async Task Repository_calls_also_ensure_the_key_indexes_including_GlossaryIds()
        {
            var tenant = NewTenant("repo-keys");
            XUnitTest.Shared.TestBlocksContext.Set(tenant);
            var (glossaries, _) = NewCollection();
            var keyIndexes = new Mock<IMongoIndexManager<Eurolm.DomainService.Services.Key>>();
            keyIndexes
                .Setup(x => x.CreateManyAsync(It.IsAny<IEnumerable<CreateIndexModel<Eurolm.DomainService.Services.Key>>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<string>());
            var keys = new Mock<IMongoCollection<Eurolm.DomainService.Services.Key>>();
            keys.Setup(x => x.Indexes).Returns(keyIndexes.Object);
            var database = new Mock<IMongoDatabase>();
            database.Setup(x => x.GetCollection<BlocksGlossary>("BlocksGlossaries", null)).Returns(glossaries.Object);
            database.Setup(x => x.GetCollection<Eurolm.DomainService.Services.Key>("BlocksLanguageKeys", null)).Returns(keys.Object);
            var provider = new Mock<Blocks.Genesis.IDbContextProvider>();
            provider.Setup(x => x.GetDatabase(tenant)).Returns(database.Object);
            glossaries.Setup(x => x.DeleteOneAsync(It.IsAny<FilterDefinition<BlocksGlossary>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Mock.Of<DeleteResult>());

            await new GlossaryRepository(provider.Object).DeleteAsync("g1");
            // The build runs in the background; wait on the cached task for this tenant.
            await KeyIndexInitializer.EnsureStarted(tenant, keys.Object, NullLogger.Instance);

            keyIndexes.Verify(x => x.CreateManyAsync(
                It.Is<IEnumerable<CreateIndexModel<Eurolm.DomainService.Services.Key>>>(models =>
                    models.Any(m => m.Options.Name == "ix_keys_glossaryids")),
                It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
