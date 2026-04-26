using MongoDB.Driver;
using Moq;

namespace XUnitTest.Shared
{
    public static class MockCursorHelper
    {
        public static Mock<IAsyncCursor<T>> CreateCursor<T>(List<T> items)
        {
            var cursor = new Mock<IAsyncCursor<T>>();
            cursor.Setup(_ => _.Current).Returns(items);
            cursor.SetupSequence(_ => _.MoveNext(It.IsAny<CancellationToken>()))
                .Returns(true)
                .Returns(false);
            cursor.SetupSequence(_ => _.MoveNextAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(true)
                .ReturnsAsync(false);
            return cursor;
        }

        public static Mock<IAsyncCursor<T>> CreateEmptyCursor<T>()
        {
            var cursor = new Mock<IAsyncCursor<T>>();
            cursor.Setup(_ => _.Current).Returns(new List<T>());
            cursor.Setup(_ => _.MoveNext(It.IsAny<CancellationToken>())).Returns(false);
            cursor.Setup(_ => _.MoveNextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(false);
            return cursor;
        }

        public static void SetupFindAsync<T>(Mock<IMongoCollection<T>> collection, List<T> items)
        {
            var cursor = CreateCursor(items);
            collection.Setup(x => x.FindAsync(
                It.IsAny<FilterDefinition<T>>(),
                It.IsAny<FindOptions<T, T>>(),
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(cursor.Object);
        }

        public static void SetupFindAsyncEmpty<T>(Mock<IMongoCollection<T>> collection)
        {
            var cursor = CreateEmptyCursor<T>();
            collection.Setup(x => x.FindAsync(
                It.IsAny<FilterDefinition<T>>(),
                It.IsAny<FindOptions<T, T>>(),
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(cursor.Object);
        }

        /// <summary>
        /// Sets up FindAsync with projection (TDocument -> TProjection).
        /// Used for Find().Project().FirstOrDefaultAsync() chains.
        /// </summary>
        public static void SetupFindAsyncWithProjection<TDocument, TProjection>(
            Mock<IMongoCollection<TDocument>> collection, List<TProjection> items)
        {
            var cursor = CreateCursor(items);
            collection.Setup(x => x.FindAsync(
                It.IsAny<FilterDefinition<TDocument>>(),
                It.IsAny<FindOptions<TDocument, TProjection>>(),
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(cursor.Object);
        }

        public static void SetupFindAsyncWithProjectionEmpty<TDocument, TProjection>(
            Mock<IMongoCollection<TDocument>> collection)
        {
            var cursor = CreateEmptyCursor<TProjection>();
            collection.Setup(x => x.FindAsync(
                It.IsAny<FilterDefinition<TDocument>>(),
                It.IsAny<FindOptions<TDocument, TProjection>>(),
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(cursor.Object);
        }

        public static void SetupCountDocuments<T>(Mock<IMongoCollection<T>> collection, long count)
        {
            collection.Setup(x => x.CountDocumentsAsync(
                It.IsAny<FilterDefinition<T>>(),
                It.IsAny<CountOptions>(),
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(count);
        }
    }
}
