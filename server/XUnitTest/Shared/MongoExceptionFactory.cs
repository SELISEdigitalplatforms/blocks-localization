using System.Collections.Generic;
using System.Net;
using System.Reflection;
using MongoDB.Bson;
using MongoDB.Driver;
using MongoDB.Driver.Core.Clusters;
using MongoDB.Driver.Core.Connections;
using MongoDB.Driver.Core.Servers;

namespace XUnitTest.Shared
{
    /// <summary>
    /// Builds the driver exceptions a unique index produces. Some of their parts only have
    /// internal constructors, so those are created by reflection.
    /// </summary>
    public static class MongoExceptionFactory
    {
        public const int DuplicateKeyCode = 11000;

        private static ConnectionId Connection() =>
            new(new ServerId(new ClusterId(), new DnsEndPoint("localhost", 27017)));

        public static MongoCommandException Command(int code) =>
            new(Connection(), $"command failed with code {code}", new BsonDocument("createIndexes", "test"),
                new BsonDocument { { "ok", 0 }, { "code", code }, { "errmsg", $"error {code}" } });

        public static MongoWriteException DuplicateKeyWrite()
        {
            var error = (WriteError)Activator.CreateInstance(
                typeof(WriteError), BindingFlags.Instance | BindingFlags.NonPublic, null,
                new object[] { ServerErrorCategory.DuplicateKey, DuplicateKeyCode, "E11000 duplicate key error", new BsonDocument() }, null)!;
            return new MongoWriteException(Connection(), error, null, null);
        }

        public static BulkWriteError BulkError(int index, int code = DuplicateKeyCode)
        {
            var category = code == DuplicateKeyCode ? ServerErrorCategory.DuplicateKey : ServerErrorCategory.Uncategorized;
            return (BulkWriteError)Activator.CreateInstance(
                typeof(BulkWriteError), BindingFlags.Instance | BindingFlags.NonPublic, null,
                new object[] { index, category, code, $"error {code}", new BsonDocument() }, null)!;
        }

        public static MongoBulkWriteException<T> BulkWrite<T>(
            IReadOnlyList<WriteModel<T>> processed, IEnumerable<BulkWriteError> errors, IEnumerable<WriteModel<T>> unprocessed)
        {
            var result = new BulkWriteResult<T>.Acknowledged(processed.Count, 0, 0, 0, 0, processed, new List<BulkWriteUpsert>());
            return new MongoBulkWriteException<T>(Connection(), result, errors, null, unprocessed);
        }
    }
}
