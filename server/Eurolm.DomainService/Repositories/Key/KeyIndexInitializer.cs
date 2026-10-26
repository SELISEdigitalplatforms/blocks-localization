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
        /// Starts index creation for the tenant the first time it is seen in this process and
        /// returns that task; later calls for the same tenant return the same task without new work.
        /// </summary>
        public static Task EnsureStarted(string tenantId, IMongoCollection<Key> collection, ILogger logger)
        {
            return _ensured.GetOrAdd(tenantId, _ => new Lazy<Task>(() => Task.Run(() => EnsureAsync(tenantId, collection, logger)))).Value;
        }

        public static async Task EnsureAsync(string tenantId, IMongoCollection<Key> collection, ILogger logger)
        {
            try
            {
                await collection.Indexes.CreateManyAsync(Indexes);
            }
            catch (Exception ex)
            {
                logger.LogWarning("Could not ensure BlocksLanguageKeys indexes for tenant {TenantId}: {ErrorMessage}", tenantId, ex.Message);
            }
        }

        private static CreateIndexModel<Key> Model(string name, IndexKeysDefinition<Key> keys) =>
            new(keys, new CreateIndexOptions { Name = name });
    }
}
