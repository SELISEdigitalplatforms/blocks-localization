using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using System.Collections.Concurrent;

namespace Eurolm.DomainService.Repositories
{
    /// <summary>
    /// Creates the indexes the glossary IsGlobal / ModuleIds / Status filters rely on, once per tenant per process.
    /// Creation runs in the background and never fails the request; a failure is logged and the tenant's
    /// entry is dropped so the next call retries. The BlocksLanguageKeys GlossaryIds index is owned by
    /// <see cref="KeyIndexInitializer"/> (ix_keys_glossaryids), which glossary requests also start; an existing
    /// index on the same fields under another name is kept (see <see cref="TenantIndexInitializer{TDocument}.EnsureAsync"/>).
    /// </summary>
    public static class GlossaryIndexInitializer
    {
        private static readonly TenantIndexInitializer<BlocksGlossary> _initializer = new("BlocksGlossaries",
            Model("ix_isglobal", Builders<BlocksGlossary>.IndexKeys.Ascending(g => g.IsGlobal)),
            Model("ix_moduleids", Builders<BlocksGlossary>.IndexKeys.Ascending(g => g.ModuleIds)),
            Model("ix_status", Builders<BlocksGlossary>.IndexKeys.Ascending(g => g.Status)),
            // The matcher cache's revision check reads the latest LastUpdateDate.
            Model("ix_lastupdatedate", Builders<BlocksGlossary>.IndexKeys.Descending(g => g.LastUpdateDate)));

        private static readonly ConcurrentDictionary<string, Lazy<Task>> _uniqueNameChecked = new();

        public static CreateIndexModel<BlocksGlossary> UniqueNameIndex { get; } = new(
            Builders<BlocksGlossary>.IndexKeys.Ascending(g => g.NormalizedName),
            new CreateIndexOptions { Name = GlossaryRepository.NormalizedNameIndexName, Unique = true });

        public static IReadOnlyList<CreateIndexModel<BlocksGlossary>> Indexes => _initializer.Indexes;

        /// <inheritdoc cref="TenantIndexInitializer{TDocument}.EnsureStarted"/>
        public static Task EnsureStarted(string tenantId, IMongoCollection<BlocksGlossary> collection, ILogger logger) =>
            _initializer.EnsureStarted(tenantId, collection, logger);

        /// <inheritdoc cref="TenantIndexInitializer{TDocument}.EnsureAsync"/>
        public static Task<bool> EnsureAsync(string tenantId, IMongoCollection<BlocksGlossary> collection, ILogger logger) =>
            _initializer.EnsureAsync(tenantId, collection, logger);

        /// <summary>
        /// Creates ux_normalizedname for the tenant once per process, in the background, when no two glossaries
        /// share a NormalizedName (a missing value counts as null). Neither duplicates nor a failure are retried
        /// in this process.
        /// </summary>
        public static Task EnsureUniqueNameIndexStarted(string tenantId, IMongoCollection<BlocksGlossary> collection, ILogger logger) =>
            _uniqueNameChecked.GetOrAdd(tenantId, id => new Lazy<Task>(() => Task.Run(() => EnsureUniqueNameIndexAsync(id, collection, logger)))).Value;

        /// <summary>Returns true when the index was created (or already existed).</summary>
        public static async Task<bool> EnsureUniqueNameIndexAsync(string tenantId, IMongoCollection<BlocksGlossary> collection, ILogger logger)
        {
            try
            {
                var pipeline = new EmptyPipelineDefinition<BlocksGlossary>()
                    .Group<BlocksGlossary, BlocksGlossary, BsonDocument>(new BsonDocument
                    {
                        { "_id", "$" + nameof(BlocksGlossary.NormalizedName) },
                        { "n", new BsonDocument("$sum", 1) }
                    })
                    .Match(new BsonDocument("n", new BsonDocument("$gt", 1)))
                    .Count();
                var counted = await (await collection.AggregateAsync(pipeline)).FirstOrDefaultAsync();
                var duplicateGroups = counted?.Count ?? 0;
                if (duplicateGroups > 0)
                {
                    logger.LogWarning("Unique glossary name index not created for tenant {TenantId}: {DuplicateGroupCount} duplicate name groups", tenantId, duplicateGroups);
                    return false;
                }

                await collection.Indexes.CreateOneAsync(UniqueNameIndex);
                logger.LogInformation("Unique glossary name index created for tenant {TenantId}", tenantId);
                return true;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not create the unique glossary name index for tenant {TenantId}: {ErrorMessage}", tenantId, ex.Message);
                return false;
            }
        }

        private static CreateIndexModel<BlocksGlossary> Model(string name, IndexKeysDefinition<BlocksGlossary> keys) =>
            new(keys, new CreateIndexOptions { Name = name });
    }
}
