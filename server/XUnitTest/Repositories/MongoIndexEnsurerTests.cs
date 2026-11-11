using Eurolm.DomainService.Repositories;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;

namespace XUnitTest.Repositories
{
    public class MongoIndexEnsurerTests
    {
        private static readonly IReadOnlyList<CreateIndexModel<BsonDocument>> Models = new[]
        {
            new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys.Descending("CreateDate"), new CreateIndexOptions { Name = "ix_test" })
        };

        private readonly Mock<ILogger> _logger = new();

        // The ensurer caches per (database name, collection) for the whole process, so every test uses its own names.
        private static (Mock<IMongoDatabase> Database, Mock<IMongoIndexManager<BsonDocument>> Indexes) Database(string? name = null)
        {
            var database = new Mock<IMongoDatabase>();
            database.Setup(d => d.DatabaseNamespace).Returns(new DatabaseNamespace(name ?? "ensurer-" + Guid.NewGuid().ToString("N")));
            var indexes = new Mock<IMongoIndexManager<BsonDocument>>();
            var collection = new Mock<IMongoCollection<BsonDocument>>();
            collection.Setup(c => c.Indexes).Returns(indexes.Object);
            database.Setup(d => d.GetCollection<BsonDocument>(It.IsAny<string>(), null)).Returns(collection.Object);
            return (database, indexes);
        }

        private static void VerifyCreated(Mock<IMongoIndexManager<BsonDocument>> indexes, Times times) =>
            indexes.Verify(i => i.CreateManyAsync(It.IsAny<IEnumerable<CreateIndexModel<BsonDocument>>>(), It.IsAny<CancellationToken>()), times);

        private void VerifyWarnings(Times times) =>
            _logger.Verify(l => l.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.IsAny<It.IsAnyType>(),
                It.IsAny<Exception?>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()), times);

        [Fact]
        public async Task EnsureAsync_CreatesTheIndexesOnce_AndLaterCallsReturnTheSameTask()
        {
            var (database, indexes) = Database();

            var first = MongoIndexEnsurer.EnsureAsync(database.Object, "Things", Models, _logger.Object);
            await first;
            var second = MongoIndexEnsurer.EnsureAsync(database.Object, "Things", Models, _logger.Object);
            await second;

            second.Should().BeSameAs(first);
            indexes.Verify(i => i.CreateManyAsync(Models, It.IsAny<CancellationToken>()), Times.Once);
            database.Verify(d => d.GetCollection<BsonDocument>("Things", null), Times.Once);
            VerifyWarnings(Times.Never());
        }

        [Fact]
        public async Task EnsureAsync_KeysByDatabaseNameAndCollection()
        {
            var name = "ensurer-" + Guid.NewGuid().ToString("N");
            var (database, indexes) = Database(name);
            var (sameNameOtherInstance, sameNameIndexes) = Database(name);
            var (otherDatabase, otherIndexes) = Database();

            await MongoIndexEnsurer.EnsureAsync(database.Object, "Things", Models, _logger.Object);
            await MongoIndexEnsurer.EnsureAsync(database.Object, "Others", Models, _logger.Object);
            await MongoIndexEnsurer.EnsureAsync(sameNameOtherInstance.Object, "Things", Models, _logger.Object);
            await MongoIndexEnsurer.EnsureAsync(otherDatabase.Object, "Things", Models, _logger.Object);

            VerifyCreated(indexes, Times.Exactly(2));
            VerifyCreated(sameNameIndexes, Times.Never());
            VerifyCreated(otherIndexes, Times.Once());
        }

        [Fact]
        public async Task EnsureAsync_Failure_LogsOneWarning_DoesNotThrow_AndIsNotRetried()
        {
            var (database, indexes) = Database();
            indexes.Setup(i => i.CreateManyAsync(It.IsAny<IEnumerable<CreateIndexModel<BsonDocument>>>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("Index already exists with a different name"));

            var first = MongoIndexEnsurer.EnsureAsync(database.Object, "Things", Models, _logger.Object);
            var act = () => first;
            await act.Should().NotThrowAsync();
            await MongoIndexEnsurer.EnsureAsync(database.Object, "Things", Models, _logger.Object);

            first.IsCompletedSuccessfully.Should().BeTrue();
            VerifyCreated(indexes, Times.Once());
            VerifyWarnings(Times.Once());
            _logger.Verify(l => l.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.IsAny<It.IsAnyType>(),
                It.Is<Exception?>(e => e is InvalidOperationException),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()), Times.Once);
        }

        [Fact]
        public async Task EnsureAsync_ConcurrentFirstCalls_CreateOnce()
        {
            var (database, indexes) = Database();
            // Hold the first creation open so that every caller races while it is still running.
            var gate = new TaskCompletionSource<IEnumerable<string>>(TaskCreationOptions.RunContinuationsAsynchronously);
            indexes.Setup(i => i.CreateManyAsync(It.IsAny<IEnumerable<CreateIndexModel<BsonDocument>>>(), It.IsAny<CancellationToken>()))
                .Returns(gate.Task);
            using var start = new Barrier(20);

            var callers = Enumerable.Range(0, 20)
                .Select(_ => Task.Run<Task>(() =>
                {
                    start.SignalAndWait();
                    return MongoIndexEnsurer.EnsureAsync(database.Object, "Things", Models, _logger.Object);
                }))
                .ToList();
            var ensured = await Task.WhenAll(callers.Select(c => c.WaitAsync(TimeSpan.FromSeconds(10))));
            gate.SetResult(new[] { "ix_test" });
            await Task.WhenAll(ensured);

            ensured.Distinct().Should().ContainSingle();
            VerifyCreated(indexes, Times.Once());
        }
    }
}
