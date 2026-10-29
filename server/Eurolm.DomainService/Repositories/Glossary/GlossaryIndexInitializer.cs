using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using System.Collections.Concurrent;

namespace Eurolm.DomainService.Repositories
{
    /// <summary>
    /// Creates the indexes the glossary IsGlobal / ModuleIds / Status filters rely on, once per tenant per process.
    /// Creation runs in the background and never fails the request; a failure is logged and the tenant's
    /// entry is dropped so the next call retries. The BlocksLanguageKeys GlossaryIds index is owned by
    /// <see cref="KeyIndexInitializer"/> (ix_keys_glossaryids), which glossary requests also start: a second
    /// index on the same key under another name would make MongoDB reject the whole createIndexes call.
    /// </summary>
    public static class GlossaryIndexInitializer
    {
        private static readonly ConcurrentDictionary<string, Lazy<Task>> _ensured = new();

        public static IReadOnlyList<CreateIndexModel<BlocksGlossary>> Indexes { get; } = new[]
        {
            Model("ix_isglobal", Builders<BlocksGlossary>.IndexKeys.Ascending(g => g.IsGlobal)),
            Model("ix_moduleids", Builders<BlocksGlossary>.IndexKeys.Ascending(g => g.ModuleIds)),
            Model("ix_status", Builders<BlocksGlossary>.IndexKeys.Ascending(g => g.Status))
        };

        /// <summary>
        /// Starts index creation for the tenant the first time it is seen in this process (or after a failed
        /// attempt) and returns that task; later calls for the same tenant return the same task.
        /// </summary>
        public static Task EnsureStarted(string tenantId, IMongoCollection<BlocksGlossary> collection, ILogger logger)
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
        public static async Task<bool> EnsureAsync(string tenantId, IMongoCollection<BlocksGlossary> collection, ILogger logger)
        {
            try
            {
                await collection.Indexes.CreateManyAsync(Indexes);
                return true;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not ensure BlocksGlossaries indexes for tenant {TenantId}: {ErrorMessage}", tenantId, ex.Message);
                return false;
            }
        }

        private static CreateIndexModel<BlocksGlossary> Model(string name, IndexKeysDefinition<BlocksGlossary> keys) =>
            new(keys, new CreateIndexOptions { Name = name });
    }
}
