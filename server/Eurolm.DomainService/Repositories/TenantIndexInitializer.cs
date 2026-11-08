using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
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

        /// <summary>
        /// Creates the indexes whose fields no existing index already covers. Returns false when they could not be created.
        /// </summary>
        /// <remarks>
        /// Indexes are matched by fields and direction, not by name: MongoDB rejects a second index on the same
        /// fields under another name ("Index already exists with a different name"), and one rejected index
        /// fails the whole createIndexes call. Tenant databases restored from older dumps carry such indexes
        /// (for example blk_lkey_glossaryids for ix_keys_glossaryids), so those are kept and skipped.
        /// </remarks>
        public async Task<bool> EnsureAsync(string tenantId, IMongoCollection<TDocument> collection, ILogger logger)
        {
            try
            {
                var existing = await GetExistingKeySignaturesAsync(collection);
                var missing = Indexes.Where(model => !existing.Contains(KeySignature(Render(model.Keys)))).ToList();
                if (missing.Count > 0)
                {
                    await collection.Indexes.CreateManyAsync(missing);
                }
                return true;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not ensure {CollectionName} indexes for tenant {TenantId}: {ErrorMessage}", _collectionName, tenantId, ex.Message);
                return false;
            }
        }

        private static async Task<HashSet<string>> GetExistingKeySignaturesAsync(IMongoCollection<TDocument> collection)
        {
            using var cursor = await collection.Indexes.ListAsync();
            var indexes = await cursor.ToListAsync();
            return indexes
                .Where(index => index.TryGetValue("key", out var key) && key.IsBsonDocument)
                .Select(index => KeySignature(index["key"].AsBsonDocument))
                .ToHashSet(StringComparer.Ordinal);
        }

        private static BsonDocument Render(IndexKeysDefinition<TDocument> keys)
        {
            var registry = BsonSerializer.SerializerRegistry;
            return keys.Render(new RenderArgs<TDocument>(registry.GetSerializer<TDocument>(), registry));
        }

        /// <summary>
        /// Field order and direction, e.g. "KeyName:1,ItemId:1". A numeric direction compares by sign, so an index
        /// stored as { GlossaryIds: 1.0 } (shell, mongorestore) matches { GlossaryIds: 1 }; "text"/"hashed" stay as is.
        /// </summary>
        public static string KeySignature(BsonDocument keys) =>
            string.Join(",", keys.Elements.Select(e =>
                e.Name + ":" + (e.Value.IsNumeric ? Math.Sign(e.Value.ToDouble()).ToString() : e.Value.ToString())));
    }
}
