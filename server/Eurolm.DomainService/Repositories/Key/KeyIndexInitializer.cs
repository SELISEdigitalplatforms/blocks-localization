using Eurolm.DomainService.Services;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using System.Collections.Concurrent;

namespace Eurolm.DomainService.Repositories
{
    /// <summary>
    /// Creates the indexes the Key/Gets sorts and filters rely on, once per tenant per process.
    /// The indexes are a performance aid, not a correctness requirement: creation runs in the
    /// background and a failure is only logged, so the list request is never blocked or failed by it.
    /// A failed attempt drops the tenant's entry, so the next call for that tenant retries.
    /// </summary>
    public static class KeyIndexInitializer
    {
        private static readonly ConcurrentDictionary<string, Lazy<Task>> _ensured = new();

        public static IReadOnlyList<CreateIndexModel<Key>> Indexes { get; } = new[]
        {
            Model("ix_keys_keyname_id", Builders<Key>.IndexKeys.Ascending(k => k.KeyName).Ascending(k => k.ItemId)),
            Model("ix_keys_createdate_id", Builders<Key>.IndexKeys.Ascending(k => k.CreateDate).Ascending(k => k.ItemId)),
            Model("ix_keys_lastupdatedate_id", Builders<Key>.IndexKeys.Ascending(k => k.LastUpdateDate).Ascending(k => k.ItemId)),
            Model("ix_keys_moduleid_keyname_id", Builders<Key>.IndexKeys.Ascending(k => k.ModuleId).Ascending(k => k.KeyName).Ascending(k => k.ItemId)),
            Model("ix_keys_glossaryids", Builders<Key>.IndexKeys.Ascending(k => k.GlossaryIds))
        };

        /// <summary>
        /// Starts index creation for the tenant the first time it is seen in this process (or after a
        /// failed attempt) and returns that task; later calls for the same tenant return the same task.
        /// </summary>
        public static Task EnsureStarted(string tenantId, IMongoCollection<Key> collection, ILogger logger)
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
        public static async Task<bool> EnsureAsync(string tenantId, IMongoCollection<Key> collection, ILogger logger)
        {
            try
            {
                await collection.Indexes.CreateManyAsync(Indexes);
                return true;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not ensure BlocksLanguageKeys indexes for tenant {TenantId}: {ErrorMessage}", tenantId, ex.Message);
                return false;
            }
        }

        private static CreateIndexModel<Key> Model(string name, IndexKeysDefinition<Key> keys) =>
            new(keys, new CreateIndexOptions { Name = name });
    }
}
