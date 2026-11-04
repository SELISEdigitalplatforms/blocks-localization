using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using System.Collections.Concurrent;

namespace Eurolm.DomainService.Repositories
{
    /// <summary>
    /// Creates a collection's indexes once per tenant per process. Creation runs in the background and a
    /// failure is only logged; a failed attempt drops the tenant's entry, so the next call for that tenant retries.
    /// </summary>
    public sealed class TenantIndexInitializer<TDocument>
    {
        private readonly ConcurrentDictionary<string, Lazy<Task>> _ensured = new();
        private readonly string _collectionName;

        public TenantIndexInitializer(string collectionName, params CreateIndexModel<TDocument>[] indexes)
        {
            _collectionName = collectionName;
            Indexes = indexes;
        }

        public IReadOnlyList<CreateIndexModel<TDocument>> Indexes { get; }

        /// <summary>
        /// Starts index creation for the tenant the first time it is seen in this process (or after a
        /// failed attempt) and returns that task; later calls for the same tenant return the same task.
        /// </summary>
        public Task EnsureStarted(string tenantId, IMongoCollection<TDocument> collection, ILogger logger)
        {
            if (_ensured.TryGetValue(tenantId, out var existing))
                return existing.Value;

            Lazy<Task> attempt = null!;
            attempt = new Lazy<Task>(() => Task.Run(async () =>
            {
                if (!await EnsureAsync(tenantId, collection, logger))
                {
                    // Only drop this attempt's entry, never one a later retry already added.
                    _ensured.TryRemove(new KeyValuePair<string, Lazy<Task>>(tenantId, attempt));
                }
            }));
            return _ensured.GetOrAdd(tenantId, attempt).Value;
        }

        /// <summary>Returns false when the indexes could not be created.</summary>
        public async Task<bool> EnsureAsync(string tenantId, IMongoCollection<TDocument> collection, ILogger logger)
        {
            try
            {
                await collection.Indexes.CreateManyAsync(Indexes);
                return true;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not ensure {CollectionName} indexes for tenant {TenantId}: {ErrorMessage}", _collectionName, tenantId, ex.Message);
                return false;
            }
        }
    }
}
