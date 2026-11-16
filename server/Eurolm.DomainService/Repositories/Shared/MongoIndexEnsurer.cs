using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using System.Collections.Concurrent;

namespace Eurolm.DomainService.Repositories
{
    /// <summary>
    /// Creates a collection's indexes once per (database, collection) per process.
    /// Indexes are a performance aid, not a correctness requirement: creation runs in the background,
    /// a failure is logged once as a warning and is not retried until the process restarts,
    /// so the request that triggers it is never blocked or failed by it.
    /// </summary>
    public static class MongoIndexEnsurer
    {
        private static readonly ConcurrentDictionary<(string Database, string Collection), Lazy<Task>> _ensured = new();

        /// <summary>
        /// Starts index creation the first time a (database, collection) pair is seen in this process and
        /// returns that task; later calls for the same pair return the same task without new work.
        /// The task never faults: failures are logged.
        /// </summary>
        public static Task EnsureAsync<TDocument>(
            IMongoDatabase database,
            string collectionName,
            IReadOnlyList<CreateIndexModel<TDocument>> indexModels,
            ILogger logger)
        {
            var key = (database.DatabaseNamespace.DatabaseName, collectionName);
            return _ensured.GetOrAdd(
                key,
                static (k, args) => new Lazy<Task>(() => Task.Run(() => CreateAsync(args.Database, k.Collection, args.IndexModels, args.Logger))),
                (Database: database, IndexModels: indexModels, Logger: logger)).Value;
        }

        private static async Task CreateAsync<TDocument>(
            IMongoDatabase database,
            string collectionName,
            IReadOnlyList<CreateIndexModel<TDocument>> indexModels,
            ILogger logger)
        {
            try
            {
                await database.GetCollection<TDocument>(collectionName).Indexes.CreateManyAsync(indexModels);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not ensure {Collection} indexes in database {Database}",
                    collectionName, database.DatabaseNamespace.DatabaseName);
            }
        }
    }
}
