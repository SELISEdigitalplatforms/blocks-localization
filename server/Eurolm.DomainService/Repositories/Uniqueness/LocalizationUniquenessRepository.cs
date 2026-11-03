using System.Collections.Concurrent;
using Blocks.Genesis;
using Eurolm.DomainService.Services;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Eurolm.DomainService.Repositories
{
    public class LocalizationUniquenessRepository : ILocalizationUniquenessRepository
    {
        public const string KeyCollectionName = "BlocksLanguageKeys";
        public const string ModuleCollectionName = "BlocksLanguageModules";
        public const string KeyIndexName = "ux_ModuleId_KeyName";
        public const string ModuleIndexName = "ux_ModuleName";

        private const int DuplicateKeyCode = 11000;
        private const int IndexOptionsConflictCode = 85;
        private const int IndexKeySpecsConflictCode = 86;

        // Only confirmed indexes are cached, so a tenant that was skipped is checked again next time.
        private static readonly ConcurrentDictionary<string, (bool Keys, bool Modules)> EnforcedByTenant = new();

        private readonly IDbContextProvider _dbContextProvider;
        private readonly ILogger<LocalizationUniquenessRepository> _logger;

        public LocalizationUniquenessRepository(IDbContextProvider dbContextProvider, ILogger<LocalizationUniquenessRepository> logger)
        {
            _dbContextProvider = dbContextProvider;
            _logger = logger;
        }

        /// <summary>Forgets every cached result. Tests use it to start from a known state.</summary>
        public static void ClearEnforcementCache() => EnforcedByTenant.Clear();

        public async Task<GetDuplicateSummaryResponse> GetDuplicateSummaryAsync(string tenantId)
        {
            var database = _dbContextProvider.GetDatabase(tenantId);
            var keys = database.GetCollection<BsonDocument>(KeyCollectionName);
            var modules = database.GetCollection<BsonDocument>(ModuleCollectionName);

            var (keyGroups, keyRows) = await CountDuplicateGroupsAsync(keys, "ModuleId", "KeyName");
            var (moduleGroups, moduleRows) = await CountDuplicateGroupsAsync(modules, "ModuleName");

            return new GetDuplicateSummaryResponse
            {
                KeyGroupCount = keyGroups,
                DuplicateKeyRowCount = keyRows,
                ExtraKeyCount = keyRows - keyGroups,
                ModuleGroupCount = moduleGroups,
                ExtraModuleCount = moduleRows - moduleGroups,
                KeyUniquenessEnforced = await HasIndexAsync(keys, KeyIndexName),
                ModuleUniquenessEnforced = await HasIndexAsync(modules, ModuleIndexName),
            };
        }

        public async Task<EnforceUniquenessResponse> EnsureUniqueIndexesAsync(string tenantId)
        {
            EnforcedByTenant.TryGetValue(tenantId, out var cached);
            if (cached.Keys && cached.Modules)
            {
                return new EnforceUniquenessResponse { KeyUniquenessEnforced = true, ModuleUniquenessEnforced = true };
            }

            var database = _dbContextProvider.GetDatabase(tenantId);
            var response = new EnforceUniquenessResponse();

            if (cached.Keys)
            {
                response.KeyUniquenessEnforced = true;
            }
            else
            {
                var keys = database.GetCollection<BsonDocument>(KeyCollectionName);
                var (groups, _) = await CountDuplicateGroupsAsync(keys, "ModuleId", "KeyName");
                response.KeyGroupCount = groups;
                response.KeyUniquenessEnforced = await TryCreateUniqueIndexAsync(
                    tenantId, keys, KeyIndexName, groups, "ModuleId", "KeyName");
            }

            if (cached.Modules)
            {
                response.ModuleUniquenessEnforced = true;
            }
            else
            {
                var modules = database.GetCollection<BsonDocument>(ModuleCollectionName);
                var (groups, _) = await CountDuplicateGroupsAsync(modules, "ModuleName");
                response.ModuleGroupCount = groups;
                response.ModuleUniquenessEnforced = await TryCreateUniqueIndexAsync(
                    tenantId, modules, ModuleIndexName, groups, "ModuleName");
            }

            if (response.KeyUniquenessEnforced || response.ModuleUniquenessEnforced)
            {
                EnforcedByTenant.AddOrUpdate(
                    tenantId,
                    (response.KeyUniquenessEnforced, response.ModuleUniquenessEnforced),
                    (_, previous) => (previous.Keys || response.KeyUniquenessEnforced, previous.Modules || response.ModuleUniquenessEnforced));
            }

            return response;
        }

        /// <summary>
        /// Counts groups of two or more documents that share the given fields, compared exactly as stored.
        /// Documents where any field is missing or not a string are ignored.
        /// </summary>
        private static async Task<(long Groups, long Rows)> CountDuplicateGroupsAsync(
            IMongoCollection<BsonDocument> collection, params string[] fields)
        {
            var pipeline = DuplicateGroupCountPipeline(fields);
            var options = new AggregateOptions { AllowDiskUse = true };

            using var cursor = await collection.AggregateAsync(pipeline, options);
            var result = await cursor.FirstOrDefaultAsync();
            if (result == null)
            {
                return (0, 0);
            }

            return (result["groups"].ToInt64(), result["rows"].ToInt64());
        }

        public static PipelineDefinition<BsonDocument, BsonDocument> DuplicateGroupCountPipeline(params string[] fields)
        {
            var match = new BsonDocument(fields.Select(f => new BsonElement(f, new BsonDocument("$type", "string"))));
            var groupId = new BsonDocument(fields.Select(f => new BsonElement(f, "$" + f)));

            return new[]
            {
                new BsonDocument("$match", match),
                new BsonDocument("$group", new BsonDocument { { "_id", groupId }, { "count", new BsonDocument("$sum", 1) } }),
                new BsonDocument("$match", new BsonDocument("count", new BsonDocument("$gt", 1))),
                new BsonDocument("$group", new BsonDocument
                {
                    { "_id", BsonNull.Value },
                    { "groups", new BsonDocument("$sum", 1) },
                    { "rows", new BsonDocument("$sum", "$count") },
                }),
            };
        }

        private static async Task<bool> HasIndexAsync(IMongoCollection<BsonDocument> collection, string indexName)
        {
            // Only a unique index under our name actually prevents duplicates.
            var indexes = await ListIndexesAsync(collection);
            return indexes.Any(index =>
                index.GetValue("name", BsonNull.Value) == indexName &&
                index.GetValue("unique", false).ToBoolean());
        }

        private static async Task<List<BsonDocument>> ListIndexesAsync(IMongoCollection<BsonDocument> collection)
        {
            using var cursor = await collection.Indexes.ListAsync();
            return await cursor.ToListAsync();
        }

        public static CreateIndexModel<BsonDocument> UniqueIndexModel(string indexName, params string[] fields)
        {
            var keys = new BsonDocument(fields.Select(f => new BsonElement(f, 1)));
            var partial = new BsonDocument(fields.Select(f => new BsonElement(f, new BsonDocument("$type", "string"))));

            return new CreateIndexModel<BsonDocument>(
                new BsonDocumentIndexKeysDefinition<BsonDocument>(keys),
                new CreateIndexOptions<BsonDocument>
                {
                    Name = indexName,
                    Unique = true,
                    PartialFilterExpression = new BsonDocumentFilterDefinition<BsonDocument>(partial),
                });
        }

        private async Task<bool> TryCreateUniqueIndexAsync(
            string tenantId, IMongoCollection<BsonDocument> collection, string indexName, long duplicateGroups, params string[] fields)
        {
            var collectionName = collection.CollectionNamespace.CollectionName;
            if (duplicateGroups > 0)
            {
                _logger.LogWarning(
                    "Unique index {IndexName} not created for tenant {TenantId}: {Collection} has {GroupCount} duplicate groups",
                    indexName, tenantId, collectionName, duplicateGroups);
                return false;
            }

            try
            {
                // Creating an index that already exists with the same name, keys and options is a no-op.
                await collection.Indexes.CreateOneAsync(UniqueIndexModel(indexName, fields));
                return true;
            }
            catch (MongoCommandException ex) when (ex.Code == DuplicateKeyCode)
            {
                _logger.LogWarning(ex,
                    "Unique index {IndexName} not created for tenant {TenantId}: duplicates appeared in {Collection} while it was being built",
                    indexName, tenantId, collectionName);
            }
            catch (MongoCommandException ex) when (ex.Code is IndexOptionsConflictCode or IndexKeySpecsConflictCode)
            {
                var conflicting = await DescribeConflictingIndexesAsync(collection, indexName, fields);
                _logger.LogWarning(ex,
                    "Unique index {IndexName} not created for tenant {TenantId}: {Collection} already has a conflicting index ({ErrorCode}): {ExistingIndexes}. Manual review required.",
                    indexName, tenantId, collectionName, ex.Code, conflicting);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Unique index {IndexName} not created for tenant {TenantId} on {Collection}",
                    indexName, tenantId, collectionName);
            }

            return false;
        }

        /// <summary>Names and options of indexes with our name or our key pattern, for the operator's log.</summary>
        private async Task<string> DescribeConflictingIndexesAsync(
            IMongoCollection<BsonDocument> collection, string indexName, string[] fields)
        {
            try
            {
                // Compare key fields by name and order only: a shell-created index stores 1.0, not 1.
                var indexes = await ListIndexesAsync(collection);
                var conflicting = indexes.Where(index =>
                    index.GetValue("name", BsonNull.Value) == indexName ||
                    (index.GetValue("key", BsonNull.Value) is BsonDocument key && key.Names.SequenceEqual(fields)));

                return string.Join("; ", conflicting.Select(index => index.ToJson()));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not list indexes of {Collection}", collection.CollectionNamespace.CollectionName);
                return "unavailable";
            }
        }
    }
}
