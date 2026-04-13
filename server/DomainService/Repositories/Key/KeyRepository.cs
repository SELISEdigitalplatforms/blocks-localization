using Blocks.Genesis;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Shared.Entities;
using MongoDB.Bson;
using MongoDB.Driver;
using System.Linq.Expressions;

namespace BlocksTemplate.DomainService.Repositories
{
    public class KeyRepository : IKeyRepository
    {
        private readonly IDbContextProvider _dbContextProvider;
        private const string _collectionName = "BlocksLanguageKeys";

        public KeyRepository(IDbContextProvider dbContextProvider)
        {
            _dbContextProvider = dbContextProvider;
        }


        public async Task<Key> GetByIdAsync(string itemId)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<Key>(_collectionName);
            var filter = Builders<Key>.Filter.Eq(lk => lk.ItemId, itemId);

            return await collection.Find(filter).FirstOrDefaultAsync();
        }


        public async Task<IQueryable<BlocksLanguageKey>> GetUilmResourceKeysWithPage(int page, int size)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);

            var result = await collection
                            .Find(_ => true)
                            .Skip(page * size)
                            .Limit(size)
                            .ToListAsync();
            return result.AsQueryable();
        }

        public async Task<List<Key>> GetKeysByKeyNamesAsync(string[] keyNames, string? moduleId = null)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<Key>(_collectionName);
            var filter = Builders<Key>.Filter.In(k => k.KeyName, keyNames);

            if (!string.IsNullOrWhiteSpace(moduleId))
            {
                filter &= Builders<Key>.Filter.Eq(k => k.ModuleId, moduleId);
            }

            return await collection.Find(filter).ToListAsync();
        }

        public async Task<GetKeysQueryResponse> GetAllKeysAsync(GetKeysRequest request)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<Key>(_collectionName);

            var filter = getAllKeysFilter(request);

            var sort = !string.IsNullOrWhiteSpace(request.SortProperty) && request.IsDescending ? Builders<Key>.Sort.Descending(request.SortProperty) : Builders<Key>.Sort.Ascending(request.SortProperty ?? "KeyName");

            var findKeysTask = collection
                .Find(filter)
                .Skip(request.PageNumber * request.PageSize)
                .Limit(request.PageSize)
                .Sort(sort)
                .ToListAsync();

            var countDocumentsTask = collection.CountDocumentsAsync(filter);

            await Task.WhenAll(findKeysTask, countDocumentsTask);

            return new GetKeysQueryResponse
            {
                Keys = findKeysTask.Result,
                TotalCount = countDocumentsTask.Result
            };
        }

        private static FilterDefinition<Key> getAllKeysFilter(GetKeysRequest query)
        {
            var filterBuilder = Builders<Key>.Filter;
            var matchFilters = new List<FilterDefinition<Key>>();

            if (!string.IsNullOrWhiteSpace(query.KeySearchText))
            {
                var keyNameFilter = filterBuilder.Regex("KeyName", new BsonRegularExpression($".*{query.KeySearchText}.*", "i"));
                var resourceValueFilter = filterBuilder.ElemMatch(x => x.Resources,
                    Builders<Resource>.Filter.Regex(r => r.Value, new BsonRegularExpression($".*{query.KeySearchText}.*", "i")));
                matchFilters.Add(filterBuilder.Or(keyNameFilter, resourceValueFilter));
            }

            if (!string.IsNullOrWhiteSpace(query.SearchKey))
            {
                var searchKeyFilter = filterBuilder.Regex("KeyName", new BsonRegularExpression($".*{query.SearchKey}.*", "i"));
                matchFilters.Add(searchKeyFilter);
            }

            if (query.ResourceSearchFilters != null && query.ResourceSearchFilters.Length > 0)
            {
                foreach (var resourceFilter in query.ResourceSearchFilters)
                {
                    if (!string.IsNullOrWhiteSpace(resourceFilter.SearchText) && !string.IsNullOrWhiteSpace(resourceFilter.Culture))
                    {
                        var cultureAndValueFilter = filterBuilder.ElemMatch(x => x.Resources,
                            Builders<Resource>.Filter.And(
                                Builders<Resource>.Filter.Eq(r => r.Culture, resourceFilter.Culture),
                                Builders<Resource>.Filter.Regex(r => r.Value, new BsonRegularExpression($".*{resourceFilter.SearchText}.*", "i"))
                            ));
                        matchFilters.Add(cultureAndValueFilter);
                    }
                }
            }

            if (query.ModuleIds != null && query.ModuleIds.Length > 0)
            {
                if (query.ModuleIds.Length == 1 && !string.IsNullOrWhiteSpace(query.ModuleIds[0]))
                {
                    matchFilters.Add(filterBuilder.Eq(x => x.ModuleId, query.ModuleIds[0]));
                }
                else if (query.ModuleIds.Length > 1)
                {
                    matchFilters.Add(filterBuilder.In(x => x.ModuleId, query.ModuleIds));
                }
            }

            if (query.CreateDateRange != null)
            {
                List<FilterDefinition<Key>> dateFilters = setDateFilter(query, filterBuilder);
                if (dateFilters.Count > 0)
                {
                    matchFilters.Add(filterBuilder.And(dateFilters));
                }
            }

            if (query.LastUpdateDateRange != null)
            {
                List<FilterDefinition<Key>> dateFilters = setLastUpdateDateFilter(query, filterBuilder);
                if (dateFilters.Count > 0)
                {
                    matchFilters.Add(filterBuilder.And(dateFilters));
                }
            }
            return matchFilters.Count > 0 ? filterBuilder.And(matchFilters) : filterBuilder.Empty;
        }

        private static List<FilterDefinition<Key>> setDateFilter(GetKeysRequest query, FilterDefinitionBuilder<Key> filterBuilder)
        {
            FilterDefinition<Key> dateFilter;
            var dateFilters = new List<FilterDefinition<Key>>();

            if (query.CreateDateRange.StartDate != default(DateTime) && query.CreateDateRange.StartDate != null && (query.CreateDateRange.EndDate == default(DateTime) || query.CreateDateRange.EndDate == null))
            {
                dateFilter = filterBuilder.Gte("CreateDate", query.CreateDateRange.StartDate);
                dateFilters.Add(dateFilter);
            }
            else if ((query.CreateDateRange.StartDate == default(DateTime) || query.CreateDateRange.StartDate == null) && query.CreateDateRange.EndDate != default(DateTime) && query.CreateDateRange.EndDate != null)
            {
                dateFilter = filterBuilder.Lte("CreateDate", query.CreateDateRange.EndDate);
                dateFilters.Add(dateFilter);
            }
            else if (query.CreateDateRange.StartDate != default(DateTime) && query.CreateDateRange.StartDate != null && query.CreateDateRange.EndDate != default(DateTime) && query.CreateDateRange.EndDate != null)
            {
                dateFilter = filterBuilder.And(
                    filterBuilder.Gte("CreateDate", query.CreateDateRange.StartDate),
                    filterBuilder.Lte("CreateDate", query.CreateDateRange.EndDate)
                );
                dateFilters.Add(dateFilter);
            }
            return dateFilters;
        }

        private static List<FilterDefinition<Key>> setLastUpdateDateFilter(GetKeysRequest query, FilterDefinitionBuilder<Key> filterBuilder)
        {
            FilterDefinition<Key> dateFilter;
            var dateFilters = new List<FilterDefinition<Key>>();

            if (query.LastUpdateDateRange.StartDate != default(DateTime) && query.LastUpdateDateRange.StartDate != null && (query.LastUpdateDateRange.EndDate == default(DateTime) || query.LastUpdateDateRange.EndDate == null))
            {
                dateFilter = filterBuilder.Gte("LastUpdateDate", query.LastUpdateDateRange.StartDate);
                dateFilters.Add(dateFilter);
            }
            else if ((query.LastUpdateDateRange.StartDate == default(DateTime) || query.LastUpdateDateRange.StartDate == null) && query.LastUpdateDateRange.EndDate != default(DateTime) && query.LastUpdateDateRange.EndDate != null)
            {
                dateFilter = filterBuilder.Lte("LastUpdateDate", query.LastUpdateDateRange.EndDate);
                dateFilters.Add(dateFilter);
            }
            else if (query.LastUpdateDateRange.StartDate != default(DateTime) && query.LastUpdateDateRange.StartDate != null && query.LastUpdateDateRange.EndDate != default(DateTime) && query.LastUpdateDateRange.EndDate != null)
            {
                dateFilter = filterBuilder.And(
                    filterBuilder.Gte("LastUpdateDate", query.LastUpdateDateRange.StartDate),
                    filterBuilder.Lte("LastUpdateDate", query.LastUpdateDateRange.EndDate)
                );
                dateFilters.Add(dateFilter);
            }
            return dateFilters;
        }

        public async Task<BlocksLanguageKey> GetKeyByNameAsync(string KeyName, string moduleId)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);

            var filter = Builders<BlocksLanguageKey>.Filter.Eq(mc => mc.KeyName, KeyName) &
                     Builders<BlocksLanguageKey>.Filter.Eq(mc => mc.ModuleId, moduleId);

            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task SaveKeyAsync(BlocksLanguageKey key)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);

            var filter = Builders<BlocksLanguageKey>.Filter.Eq(mc => mc.KeyName, key.KeyName) &
                         Builders<BlocksLanguageKey>.Filter.Eq(mc => mc.ModuleId, key.ModuleId);

            await collection.ReplaceOneAsync(
                filter,
                key,
                new ReplaceOptions { IsUpsert = true });
        }

        public async Task<List<Key>> GetAllKeysByModuleAsync(string moduleId)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<Key>(_collectionName);

            var filterBuilder = Builders<Key>.Filter;
            var matchFilters = new List<FilterDefinition<Key>>
            {
                filterBuilder.Eq(x => x.ModuleId, moduleId)
            };
            var filter = filterBuilder.And(matchFilters);

            return await collection
                .Find(filter)
                .ToListAsync();
        }

        public async Task<bool> SaveNewUilmFiles(List<UilmFile> uilmfiles)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            await dataBase.GetCollection<UilmFile>($"{nameof(UilmFile)}s")
                .InsertManyAsync(uilmfiles);

            return true;
        }

        public async Task<long> DeleteOldUilmFiles(List<UilmFile> uilmfiles)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var modules = uilmfiles.Select(x => x.ModuleName).Distinct();
            var filter = Builders<UilmFile>.Filter.In(x => x.ModuleName, modules);
            var result = await dataBase.GetCollection<UilmFile>($"{nameof(UilmFile)}s")
                .DeleteManyAsync(filter);

            return result.DeletedCount;
        }

        public async Task<UilmFile> GetUilmFile(GetUilmFileRequest request)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var project = Builders<BsonDocument>.Projection.As<UilmFile>();
            var filter = Builders<BsonDocument>.Filter.Eq("Language", request.Language) & Builders<BsonDocument>.Filter.Eq("ModuleName", request.ModuleName);

            return await dataBase.GetCollection<BsonDocument>("UilmFiles")
                .Find(filter)
                .Project(project)
                .FirstOrDefaultAsync();
        }

        public async Task DeleteAsync(string itemId)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);
            var filter = Builders<BlocksLanguageKey>.Filter.Eq(lk => lk.ItemId, itemId);

            await collection.DeleteOneAsync(filter);
        }

        public async Task<long?> UpdateUilmResourceKeysForChangeAll(List<BlocksLanguageKey> uilmResourceKeys)
        {
            //if (!isExternal)
            //{
            return await UpdateUilmResourceKeys(uilmResourceKeys);
            //}
        //     var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
        //     var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);

        //     List<WriteModel<BlocksLanguageKey>> bulkOps = new List<WriteModel<BlocksLanguageKey>>();

        //     foreach (BlocksLanguageKey uilmResourceKey in uilmResourceKeys)
        //     {
        //         FilterDefinition<BlocksLanguageKey> filter = Builders<BlocksLanguageKey>.Filter.Empty;

        //         UpdateDefinition<BlocksLanguageKey> update = Builders<BlocksLanguageKey>.Update
        //             .Set(x => x.Resources, uilmResourceKey.Resources)
        //             .Set(x => x.ModuleId, uilmResourceKey.ModuleId)
        //             .Set(x => x.KeyName, uilmResourceKey.KeyName)
        //             .Set(x => x.LastUpdateDate, uilmResourceKey.LastUpdateDate)
        //             .Set(x => x.IsPartiallyTranslated, uilmResourceKey.IsPartiallyTranslated)
        //             .SetOnInsert(x => x.ItemId, Guid.NewGuid().ToString());

        //         UpdateOneModel<BlocksLanguageKey> upsertOne = new UpdateOneModel<BlocksLanguageKey>(filter, update) { IsUpsert = true };
        //         bulkOps.Add(upsertOne);
        //     }

        //     var response = await collection.BulkWriteAsync(bulkOps);
        //     return response?.ModifiedCount;
        }

        public async Task<long?> UpdateUilmResourceKeys(List<BlocksLanguageKey> uilmResourceKeys)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");

            IMongoCollection<BlocksLanguageKey> collection = dataBase.GetCollection<BlocksLanguageKey>("BlocksLanguageKeys");
            List<WriteModel<BlocksLanguageKey>> bulkOps = new List<WriteModel<BlocksLanguageKey>>();

            foreach (BlocksLanguageKey uilmResourceKey in uilmResourceKeys)
            {
                FilterDefinition<BlocksLanguageKey> filter = Builders<BlocksLanguageKey>.Filter.Eq(x => x.ItemId, uilmResourceKey.ItemId);
                UpdateDefinition<BlocksLanguageKey> update = Builders<BlocksLanguageKey>.Update
                    .Set(x => x.Resources, uilmResourceKey.Resources)
                    .Set(x => x.ModuleId, uilmResourceKey.ModuleId)
                    .Set(x => x.KeyName, uilmResourceKey.KeyName)
                    .Set(x => x.LastUpdateDate, uilmResourceKey.LastUpdateDate)
                    .Set(x => x.IsPartiallyTranslated, uilmResourceKey.IsPartiallyTranslated);

                UpdateOneModel<BlocksLanguageKey> upsertOne = new UpdateOneModel<BlocksLanguageKey>(filter, update) { IsUpsert = true };
                bulkOps.Add(upsertOne);
            }

            var response = await collection.BulkWriteAsync(bulkOps);
            return response?.ModifiedCount;
        }

        public async Task<T> GetUilmResourceKey<T>(Expression<Func<BlocksLanguageKey, bool>> expression)
        {
            var project = Builders<BlocksLanguageKey>.Projection.As<T>();
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            return await dataBase.GetCollection<BlocksLanguageKey>($"{nameof(BlocksLanguageKey)}s")
                .Find(expression).Project(project).FirstOrDefaultAsync();
        }

        public async Task<BlocksLanguageKey> GetUilmResourceKey(Expression<Func<BlocksLanguageKey, bool>> expression, string tenantId)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            return await dataBase.GetCollection<BlocksLanguageKey>($"{nameof(BlocksLanguageKey)}s")
                .Find(expression).FirstOrDefaultAsync();
        }

        public async Task<List<BlocksLanguageKey>> GetUilmResourceKeys(Expression<Func<BlocksLanguageKey, bool>> expression, string tenantId)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            return await dataBase.GetCollection<BlocksLanguageKey>("BlocksLanguageKeys").Find(expression).ToListAsync();
        }

        public async Task<List<T>> GetUilmResourceKeys<T>(Expression<Func<BlocksLanguageKey, bool>> expression)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var project = Builders<BlocksLanguageKey>.Projection.As<T>();
            return await dataBase.GetCollection<BlocksLanguageKey>($"{nameof(BlocksLanguageKey)}s")
                .Find(expression).Project(project).ToListAsync();
        }

        public async Task InsertUilmResourceKeys(IEnumerable<BlocksLanguageKey> entities, string tenantId)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            await dataBase.GetCollection<BlocksLanguageKey>("BlocksLanguageKeys").InsertManyAsync(entities);
        }

        public async Task InsertUilmResourceKeys(IEnumerable<BlocksLanguageKey> entities)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            await dataBase.GetCollection<BlocksLanguageKey>("BlocksLanguageKeys").InsertManyAsync(entities);
        }

        public async Task UpdateBulkUilmApplications(List<BlocksLanguageModule> uilmApplicationsToBeUpdated, string organizationId, bool isExternal, string clientTenantId)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");

            List<WriteModel<BsonDocument>> bulkOpsInt = new List<WriteModel<BsonDocument>>();
            List<WriteModel<BsonDocument>> bulkOpsExt = new List<WriteModel<BsonDocument>>();
            List<WriteModel<BlocksLanguageModule>> bulkOpsExtUpserts = new List<WriteModel<BlocksLanguageModule>>();

            foreach (BlocksLanguageModule uilmApplication in uilmApplicationsToBeUpdated)
            {
                var filter = Builders<BsonDocument>.Filter.Eq("_id", uilmApplication.ItemId);
                var update = Builders<BsonDocument>.Update.Set("Name", uilmApplication.Name);

                bulkOpsInt.Add(new UpdateOneModel<BsonDocument>(filter, update));

                var upsert = Builders<BlocksLanguageModule>.Update.Set(x => x.Name, uilmApplication.Name)
                    .SetOnInsert(x => x.ItemId, Guid.NewGuid().ToString());
                var filterForUpsert = Builders<BlocksLanguageModule>.Filter.Eq(x => x.ItemId, uilmApplication.ItemId);
                bulkOpsExtUpserts.Add(new UpdateOneModel<BlocksLanguageModule>(filterForUpsert, upsert) { IsUpsert = true });
            }

            await dataBase.GetCollection<BsonDocument>("UilmApplications")
                .BulkWriteAsync(bulkOpsInt);

            if (bulkOpsExt.Count > 0)
            {
                await dataBase.GetCollection<BsonDocument>("BlocksLanguageModules")
                    .BulkWriteAsync(bulkOpsExt);
            }

            if (bulkOpsExtUpserts.Count > 0)
            {
                await dataBase.GetCollection<BlocksLanguageModule>("BlocksLanguageModules")
                    .BulkWriteAsync(bulkOpsExtUpserts);
            }

            return;
        }

        public async Task<bool> UpdateKeysCountOfAppAsync(string appId, bool isExternal, string tenantId, string organizationId)
        {
            long resourceKeyCount = 0;
            var filter = Builders<BsonDocument>.Filter.Eq("_id", appId);
            var countFilter = Builders<BsonDocument>.Filter.Eq("AppId", appId);
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");

            if (!isExternal)
            {
                resourceKeyCount = await dataBase.GetCollection<BsonDocument>("UilmResourceKeys").CountDocumentsAsync(countFilter);
                await dataBase.GetCollection<BsonDocument>("UilmApplications")
                .UpdateOneAsync(filter, Builders<BsonDocument>.Update.Set("NumberOfKeys", resourceKeyCount));

                var bfilter = Builders<BsonDocument>.Filter.Eq("OrganizationId", organizationId)
                        & Builders<BsonDocument>.Filter.Eq("ActualId", appId);
                await dataBase.GetCollection<BsonDocument>("BlocksLanguageApplications")
                    .UpdateOneAsync(bfilter, Builders<BsonDocument>.Update.Set("NumberOfKeys", resourceKeyCount));
            }
            else
            {
                countFilter &= Builders<BsonDocument>.Filter.Eq("OrganizationId", organizationId);
                resourceKeyCount = await dataBase.GetCollection<BsonDocument>("BlocksLanguageKeys").CountDocumentsAsync(countFilter);
                await dataBase.GetCollection<BsonDocument>("BlocksLanguageApplications")
                .UpdateOneAsync(filter, Builders<BsonDocument>.Update.Set("NumberOfKeys", resourceKeyCount));
            }

            return true;
        }

        public async Task InsertUilmApplications(List<BlocksLanguageModule> uilmApplicationsToBeInserted, string clientTenantId)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            await dataBase.GetCollection<BlocksLanguageModule>("BlocksLanguageModules").InsertManyAsync(uilmApplicationsToBeInserted);
        }

        public async Task InsertUilmApplications(IEnumerable<BlocksLanguageModule> entities)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            await dataBase.GetCollection<BlocksLanguageModule>("BlocksLanguageModules").InsertManyAsync(entities);
        }

        public async Task<List<T>> GetUilmApplications<T>(Expression<Func<BlocksLanguageModule, bool>> expression)
        {
            var project = Builders<BlocksLanguageModule>.Projection.As<T>();
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            return await dataBase.GetCollection<BlocksLanguageModule>($"{nameof(BlocksLanguageModule)}s")
                .Find(expression).Project(project).ToListAsync();
        }

        public async Task<BlocksLanguage> GetLanguageSettingAsync(string clientTenantId)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            return await dataBase.GetCollection<BlocksLanguage>("BlocksLanguages").Find(x => x.IsDefault).FirstOrDefaultAsync();
        }

        public async Task<List<BlocksLanguage>> GetAllLanguagesAsync(string clientTenantId)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            return await dataBase.GetCollection<BlocksLanguage>("BlocksLanguages").Find(_ => true).ToListAsync();
        }

        public async Task<Dictionary<string, long>> DeleteCollectionsAsync(List<string> collections)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var result = new Dictionary<string, long>();

            var validCollections = new List<string> { "BlocksLanguageKeys", "BlocksLanguages", "BlocksLanguageModules", "UilmFiles" };

            foreach (var collection in collections)
            {
                if (validCollections.Contains(collection))
                {
                    var deleteResult = await dataBase.GetCollection<BsonDocument>(collection).DeleteManyAsync(Builders<BsonDocument>.Filter.Empty);
                    result[collection] = deleteResult.DeletedCount;
                }
                else
                {
                    result[collection] = -1; // Invalid collection
                }
            }

            return result;
        }

        public async Task SaveUilmExportedFileAsync(UilmExportedFile exportedFile)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<UilmExportedFile>("UilmExportedFiles");
            
            await collection.InsertOneAsync(exportedFile);
        }

        public async Task<GetUilmExportedFilesQueryResponse> GetUilmExportedFilesAsync(GetUilmExportedFilesRequest request)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<UilmExportedFile>("UilmExportedFiles");

            var filter = GetUilmExportedFilesFilter(request);
            var sort = Builders<UilmExportedFile>.Sort.Descending(x => x.CreateDate);

            var findFilesTask = collection
                .Find(filter)
                .Skip(request.PageNumber * request.PageSize)
                .Limit(request.PageSize)
                .Sort(sort)
                .ToListAsync();

            var countDocumentsTask = collection.CountDocumentsAsync(filter);

            await Task.WhenAll(findFilesTask, countDocumentsTask);

            return new GetUilmExportedFilesQueryResponse
            {
                UilmExportedFiles = findFilesTask.Result,
                TotalCount = countDocumentsTask.Result
            };
        }

        private FilterDefinition<UilmExportedFile> GetUilmExportedFilesFilter(GetUilmExportedFilesRequest request)
        {
            var builder = Builders<UilmExportedFile>.Filter;
            var filters = new List<FilterDefinition<UilmExportedFile>>();

            // Apply regex-based search filter on FileName if SearchText is provided
            if (!string.IsNullOrEmpty(request.SearchText))
            {
                var regexFilter = builder.Regex(x => x.FileName, new MongoDB.Bson.BsonRegularExpression(request.SearchText, "i")); // "i" for case-insensitive
                filters.Add(regexFilter);
            }

            // Apply date range filter on CreateDate
            if (request.CreateDateRange != null)
            {
                if (request.CreateDateRange.StartDate.HasValue)
                {
                    filters.Add(builder.Gte(x => x.CreateDate, request.CreateDateRange.StartDate.Value));
                }
                if (request.CreateDateRange.EndDate.HasValue)
                {
                    filters.Add(builder.Lte(x => x.CreateDate, request.CreateDateRange.EndDate.Value));
                }
            }

            return filters.Count > 0 ? builder.And(filters) : builder.Empty;
        }
    }
}
