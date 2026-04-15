using Blocks.Genesis;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Shared.Entities;
using MongoDB.Driver;

namespace BlocksTemplate.DomainService.Repositories
{
    public class EnvironmentDataMigrationRepository : IEnvironmentDataMigrationRepository
    {
        private readonly IDbContextProvider _dbContextProvider;
        private const string _modulesCollectionName = "BlocksLanguageModules";
        private const string _keysCollectionName = "BlocksLanguageKeys";

        public EnvironmentDataMigrationRepository(IDbContextProvider dbContextProvider)
        {
            _dbContextProvider = dbContextProvider;
        }

        public async Task<List<BlocksLanguageModule>> GetAllModulesAsync(string tenantId)
        {
            var database = _dbContextProvider.GetDatabase(tenantId);
            var collection = database.GetCollection<BlocksLanguageModule>(_modulesCollectionName);
            return await collection.Find(_ => true).ToListAsync();
        }

        public async Task<List<BlocksLanguageKey>> GetAllKeysAsync(string tenantId)
        {
            var database = _dbContextProvider.GetDatabase(tenantId);
            var collection = database.GetCollection<BlocksLanguageKey>(_keysCollectionName);
            return await collection.Find(_ => true).ToListAsync();
        }

        public async Task<List<BlocksLanguageKey>> GetExistingKeysByItemIdsAsync(List<string> itemIds, string tenantId)
        {
            if (!itemIds.Any()) return new List<BlocksLanguageKey>();

            var database = _dbContextProvider.GetDatabase(tenantId);
            var collection = database.GetCollection<BlocksLanguageKey>(_keysCollectionName);
            var filter = Builders<BlocksLanguageKey>.Filter.In(k => k.ItemId, itemIds);
            return await collection.Find(filter).ToListAsync();
        }

        public async Task UpdateMigrationTrackerAsync(string trackerId, ServiceMigrationStatus LanguageServiceStatus)
        {
            var database = _dbContextProvider.GetDatabase();
            var collection = database.GetCollection<MigrationTracker>("MigrationTrackers");

            var filter = Builders<MigrationTracker>.Filter.Eq(t => t.ItemId, trackerId);

            var update = Builders<MigrationTracker>.Update
                .Set(t => t.LastUpdateDate, DateTime.UtcNow)
                .Set(t => t.LanguageService, LanguageServiceStatus);

            await collection.UpdateOneAsync(filter, update, new UpdateOptions { IsUpsert = true });
        }

        public async Task BulkUpsertModulesAsync(List<BlocksLanguageModule> modules, string tenantId, bool shouldOverwrite)
        {
            if (!modules.Any()) return;

            var database = _dbContextProvider.GetDatabase(tenantId);
            var collection = database.GetCollection<BlocksLanguageModule>(_modulesCollectionName);

            if (shouldOverwrite)
            {
                // Replace existing + insert new
                var bulkOps = modules.Select(module =>
                {
                    var filter = Builders<BlocksLanguageModule>.Filter.Eq(m => m.ItemId, module.ItemId);
                    return new ReplaceOneModel<BlocksLanguageModule>(filter, module) { IsUpsert = true };
                }).ToList();

                await collection.BulkWriteAsync(bulkOps);
            }
            else
            {
                // Only insert new (use $setOnInsert to avoid overwriting existing data)
                var bulkOps = modules.Select(module =>
                {
                    var filter = Builders<BlocksLanguageModule>.Filter.Eq(m => m.ItemId, module.ItemId);
                    var update = Builders<BlocksLanguageModule>.Update
                        .SetOnInsert(m => m.ItemId, module.ItemId)
                        .SetOnInsert(m => m.ModuleName, module.ModuleName)
                        .SetOnInsert(m => m.Name, module.Name)
                        .SetOnInsert(m => m.CreateDate, module.CreateDate)
                        .SetOnInsert(m => m.LastUpdateDate, module.LastUpdateDate)
                        .SetOnInsert(m => m.TenantId, module.TenantId)
                        .SetOnInsert(m => m.CreatedBy, module.CreatedBy)
                        .SetOnInsert(m => m.LastUpdatedBy, module.LastUpdatedBy);

                    return new UpdateOneModel<BlocksLanguageModule>(filter, update) { IsUpsert = true };
                }).ToList();

                await collection.BulkWriteAsync(bulkOps);
            }
        }

        public async Task<BulkUpsertResult> BulkUpsertKeysAsync(List<BlocksLanguageKey> keys, List<BlocksLanguageKey> existingTargetKeys, string tenantId, bool shouldOverwrite)
        {
            var result = new BulkUpsertResult();
            if (!keys.Any()) return result;

            var database = _dbContextProvider.GetDatabase(tenantId);
            var collection = database.GetCollection<BlocksLanguageKey>(_keysCollectionName);

            // Create a dictionary for quick lookup of existing keys by ItemId
            var existingKeysDict = existingTargetKeys?.ToDictionary(k => k.ItemId, k => k) ?? new Dictionary<string, BlocksLanguageKey>();

            if (shouldOverwrite)
            {
                // Merge resources and replace existing + insert new
                var keysToUpsert = keys.Select(key =>
                {
                    if (existingKeysDict.TryGetValue(key.ItemId, out var existingKey) && existingKey.Resources != null && key.Resources != null)
                    {
                        // Merge resources: new resources override existing ones by culture, remaining existing resources are kept
                        key.Resources = MergeResources(existingKey.Resources, key.Resources);
                    }
                    return key;
                }).ToList();

                var bulkOps = keysToUpsert.Select(key =>
                {
                    var filter = Builders<BlocksLanguageKey>.Filter.Eq(k => k.ItemId, key.ItemId);
                    return new ReplaceOneModel<BlocksLanguageKey>(filter, key) { IsUpsert = true };
                }).ToList();

                var bulkResult = await collection.BulkWriteAsync(bulkOps);
                
                // When shouldOverwrite is true, all keys are considered "upserted" for timeline purposes
                result.UpsertedKeys = keysToUpsert.ToList();
                result.InsertedKeys = keysToUpsert.Where(k => bulkResult.Upserts.Any(u => u.Id == k.ItemId)).ToList();
                result.UpdatedKeys = keysToUpsert.Except(result.InsertedKeys).ToList();
            }
            else
            {
                // Get existing keys first to determine what will actually be inserted
                var keyIds = keys.Select(k => k.ItemId).ToList();
                var existingKeys = await GetExistingKeysByItemIdsAsync(keyIds, tenantId);
                var existingKeyIds = existingKeys.Select(k => k.ItemId).ToHashSet();
                
                // Only keys that don't exist will be inserted
                var keysToInsert = keys.Where(k => !existingKeyIds.Contains(k.ItemId)).ToList();
                
                if (keysToInsert.Any())
                {
                    // Only insert new (use $setOnInsert to avoid overwriting existing data)
                    var bulkOps = keys.Select(key =>
                    {
                        var filter = Builders<BlocksLanguageKey>.Filter.Eq(k => k.ItemId, key.ItemId);
                        var update = Builders<BlocksLanguageKey>.Update
                            .SetOnInsert(k => k.ItemId, key.ItemId)
                            .SetOnInsert(k => k.KeyName, key.KeyName)
                            .SetOnInsert(k => k.ModuleId, key.ModuleId)
                            .SetOnInsert(k => k.Value, key.Value)
                            .SetOnInsert(k => k.Resources, key.Resources)
                            .SetOnInsert(k => k.Routes, key.Routes)
                            .SetOnInsert(k => k.IsPartiallyTranslated, key.IsPartiallyTranslated)
                            .SetOnInsert(k => k.CreateDate, key.CreateDate)
                            .SetOnInsert(k => k.LastUpdateDate, key.LastUpdateDate)
                            .SetOnInsert(k => k.TenantId, key.TenantId)
                            .SetOnInsert(k => k.CreatedBy, key.CreatedBy)
                            .SetOnInsert(k => k.LastUpdatedBy, key.LastUpdatedBy);
                        
                        return new UpdateOneModel<BlocksLanguageKey>(filter, update) { IsUpsert = true };
                    }).ToList();

                    await collection.BulkWriteAsync(bulkOps);
                }
                
                // Only the keys that were actually inserted should be in the result
                result.InsertedKeys = keysToInsert;
                result.UpsertedKeys = keysToInsert; // For timeline creation, we only care about inserted keys when shouldOverwrite is false
            }

            return result;
        }

        /// <summary>
        /// Merges existing and new resources by culture.
        /// - If a culture exists in both, the new resource replaces the existing one.
        /// - If a culture only exists in new resources, it is added.
        /// - All remaining existing resources (cultures not in new) are kept.
        /// </summary>
        private static Resource[] MergeResources(Resource[] existingResources, Resource[] newResources)
        {
            var newResourcesByCulture = newResources.ToDictionary(r => r.Culture, r => r);
            var mergedResources = new List<Resource>();

            // First, add all existing resources that are NOT in new resources (keep them as-is)
            foreach (var existingResource in existingResources)
            {
                if (!newResourcesByCulture.ContainsKey(existingResource.Culture))
                {
                    mergedResources.Add(existingResource);
                }
            }

            // Then, add all new resources (they override existing ones with same culture)
            mergedResources.AddRange(newResources);

            return mergedResources.ToArray();
        }

        public async Task<List<BlocksLanguageModule>> GetExistingModulesByNamesAsync(List<string> moduleNames, string tenantId)
        {
            if (!moduleNames.Any()) return new List<BlocksLanguageModule>();

            var database = _dbContextProvider.GetDatabase(tenantId);
            var collection = database.GetCollection<BlocksLanguageModule>(_modulesCollectionName);
            var filter = Builders<BlocksLanguageModule>.Filter.In(m => m.ModuleName, moduleNames);
            return await collection.Find(filter).ToListAsync();
        }

        public async Task<List<BlocksLanguageKey>> GetExistingKeysByModuleNameAndKeyNameAsync(
            List<(string ModuleName, string KeyName)> moduleKeyPairs,
            Dictionary<string, string> moduleNameToIdMap,
            string tenantId)
        {
            if (!moduleKeyPairs.Any()) return new List<BlocksLanguageKey>();

            var database = _dbContextProvider.GetDatabase(tenantId);
            var collection = database.GetCollection<BlocksLanguageKey>(_keysCollectionName);

            // Build OR filter for each ModuleId + KeyName combination
            var filters = moduleKeyPairs
                .Where(pair => moduleNameToIdMap.ContainsKey(pair.ModuleName))
                .Select(pair =>
                {
                    var moduleId = moduleNameToIdMap[pair.ModuleName];
                    return Builders<BlocksLanguageKey>.Filter.And(
                        Builders<BlocksLanguageKey>.Filter.Eq(k => k.ModuleId, moduleId),
                        Builders<BlocksLanguageKey>.Filter.Eq(k => k.KeyName, pair.KeyName)
                    );
                }).ToList();

            if (!filters.Any()) return new List<BlocksLanguageKey>();

            var combinedFilter = Builders<BlocksLanguageKey>.Filter.Or(filters);
            return await collection.Find(combinedFilter).ToListAsync();
        }

        public async Task BulkUpsertModulesByNameAsync(List<BlocksLanguageModule> modules, string tenantId, bool shouldOverwrite)
        {
            if (!modules.Any()) return;

            var database = _dbContextProvider.GetDatabase(tenantId);
            var collection = database.GetCollection<BlocksLanguageModule>(_modulesCollectionName);

            if (shouldOverwrite)
            {
                // Replace existing + insert new using ModuleName as the unique key
                var bulkOps = modules.Select(module =>
                {
                    var filter = Builders<BlocksLanguageModule>.Filter.Eq(m => m.ModuleName, module.ModuleName);
                    return new ReplaceOneModel<BlocksLanguageModule>(filter, module) { IsUpsert = true };
                }).ToList();

                await collection.BulkWriteAsync(bulkOps);
            }
            else
            {
                // Only insert new (use $setOnInsert to avoid overwriting existing data)
                var bulkOps = modules.Select(module =>
                {
                    var filter = Builders<BlocksLanguageModule>.Filter.Eq(m => m.ModuleName, module.ModuleName);
                    var update = Builders<BlocksLanguageModule>.Update
                        .SetOnInsert(m => m.ItemId, module.ItemId)
                        .SetOnInsert(m => m.ModuleName, module.ModuleName)
                        .SetOnInsert(m => m.Name, module.Name)
                        .SetOnInsert(m => m.CreateDate, module.CreateDate)
                        .SetOnInsert(m => m.LastUpdateDate, module.LastUpdateDate)
                        .SetOnInsert(m => m.TenantId, module.TenantId)
                        .SetOnInsert(m => m.CreatedBy, module.CreatedBy)
                        .SetOnInsert(m => m.LastUpdatedBy, module.LastUpdatedBy);

                    return new UpdateOneModel<BlocksLanguageModule>(filter, update) { IsUpsert = true };
                }).ToList();

                await collection.BulkWriteAsync(bulkOps);
            }
        }

        public async Task<BulkUpsertResult> BulkUpsertKeysByModuleNameAndKeyNameAsync(
            List<BlocksLanguageKey> keys,
            List<BlocksLanguageKey> existingTargetKeys,
            Dictionary<string, string> targetModuleNameToIdMap,
            string tenantId,
            bool shouldOverwrite)
        {
            var result = new BulkUpsertResult();
            if (!keys.Any()) return result;

            var database = _dbContextProvider.GetDatabase(tenantId);
            var collection = database.GetCollection<BlocksLanguageKey>(_keysCollectionName);

            // Create a dictionary for quick lookup of existing keys by ModuleId + KeyName (handle duplicates)
            var existingKeysDict = existingTargetKeys?
                .GroupBy(k => $"{k.ModuleId}:{k.KeyName}")
                .ToDictionary(g => g.Key, g => g.First())
                ?? new Dictionary<string, BlocksLanguageKey>();

            if (shouldOverwrite)
            {
                // Merge resources and replace existing + insert new
                var keysToUpsert = keys.Select(key =>
                {
                    var lookupKey = $"{key.ModuleId}:{key.KeyName}";
                    if (existingKeysDict.TryGetValue(lookupKey, out var existingKey) && existingKey.Resources != null && key.Resources != null)
                    {
                        // Merge resources: new resources override existing ones by culture, remaining existing resources are kept
                        key.Resources = MergeResources(existingKey.Resources, key.Resources);
                    }
                    return key;
                }).ToList();

                var bulkOps = keysToUpsert.Select(key =>
                {
                    // Filter by ModuleId + KeyName combination
                    var filter = Builders<BlocksLanguageKey>.Filter.And(
                        Builders<BlocksLanguageKey>.Filter.Eq(k => k.ModuleId, key.ModuleId),
                        Builders<BlocksLanguageKey>.Filter.Eq(k => k.KeyName, key.KeyName)
                    );
                    return new ReplaceOneModel<BlocksLanguageKey>(filter, key) { IsUpsert = true };
                }).ToList();

                await collection.BulkWriteAsync(bulkOps);

                // When shouldOverwrite is true, all keys are considered "upserted" for timeline purposes
                result.UpsertedKeys = keysToUpsert.ToList();
                result.InsertedKeys = keysToUpsert.Where(k => !existingKeysDict.ContainsKey($"{k.ModuleId}:{k.KeyName}")).ToList();
                result.UpdatedKeys = keysToUpsert.Except(result.InsertedKeys).ToList();
            }
            else
            {
                // Get existing keys first to determine what will actually be inserted
                var keysToInsert = keys.Where(k => !existingKeysDict.ContainsKey($"{k.ModuleId}:{k.KeyName}")).ToList();

                if (keysToInsert.Any())
                {
                    // Only insert new (use $setOnInsert to avoid overwriting existing data)
                    var bulkOps = keysToInsert.Select(key =>
                    {
                        var filter = Builders<BlocksLanguageKey>.Filter.And(
                            Builders<BlocksLanguageKey>.Filter.Eq(k => k.ModuleId, key.ModuleId),
                            Builders<BlocksLanguageKey>.Filter.Eq(k => k.KeyName, key.KeyName)
                        );
                        var update = Builders<BlocksLanguageKey>.Update
                            .SetOnInsert(k => k.ItemId, key.ItemId)
                            .SetOnInsert(k => k.KeyName, key.KeyName)
                            .SetOnInsert(k => k.ModuleId, key.ModuleId)
                            .SetOnInsert(k => k.Value, key.Value)
                            .SetOnInsert(k => k.Resources, key.Resources)
                            .SetOnInsert(k => k.Routes, key.Routes)
                            .SetOnInsert(k => k.IsPartiallyTranslated, key.IsPartiallyTranslated)
                            .SetOnInsert(k => k.CreateDate, key.CreateDate)
                            .SetOnInsert(k => k.LastUpdateDate, key.LastUpdateDate)
                            .SetOnInsert(k => k.TenantId, key.TenantId)
                            .SetOnInsert(k => k.CreatedBy, key.CreatedBy)
                            .SetOnInsert(k => k.LastUpdatedBy, key.LastUpdatedBy);

                        return new UpdateOneModel<BlocksLanguageKey>(filter, update) { IsUpsert = true };
                    }).ToList();

                    await collection.BulkWriteAsync(bulkOps);
                }

                // Only the keys that were actually inserted should be in the result
                result.InsertedKeys = keysToInsert;
                result.UpsertedKeys = keysToInsert;
            }

            return result;
        }
    }
}
