using Microsoft.Extensions.Logging;
using MongoDB.Driver;

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
        private static readonly TenantIndexInitializer<BlocksGlossary> _initializer = new("BlocksGlossaries",
            Model("ix_isglobal", Builders<BlocksGlossary>.IndexKeys.Ascending(g => g.IsGlobal)),
            Model("ix_moduleids", Builders<BlocksGlossary>.IndexKeys.Ascending(g => g.ModuleIds)),
            Model("ix_status", Builders<BlocksGlossary>.IndexKeys.Ascending(g => g.Status)),
            // The matcher cache's revision check reads the latest LastUpdateDate.
            Model("ix_lastupdatedate", Builders<BlocksGlossary>.IndexKeys.Descending(g => g.LastUpdateDate)));

        public static IReadOnlyList<CreateIndexModel<BlocksGlossary>> Indexes => _initializer.Indexes;

        /// <inheritdoc cref="TenantIndexInitializer{TDocument}.EnsureStarted"/>
        public static Task EnsureStarted(string tenantId, IMongoCollection<BlocksGlossary> collection, ILogger logger) =>
            _initializer.EnsureStarted(tenantId, collection, logger);

        /// <inheritdoc cref="TenantIndexInitializer{TDocument}.EnsureAsync"/>
        public static Task<bool> EnsureAsync(string tenantId, IMongoCollection<BlocksGlossary> collection, ILogger logger) =>
            _initializer.EnsureAsync(tenantId, collection, logger);

        private static CreateIndexModel<BlocksGlossary> Model(string name, IndexKeysDefinition<BlocksGlossary> keys) =>
            new(keys, new CreateIndexOptions { Name = name });
    }
}
