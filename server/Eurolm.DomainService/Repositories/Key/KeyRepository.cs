using Blocks.Genesis;
using Eurolm.DomainService.Repositories.UilmStorage;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.UilmStorage;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using System.Linq.Expressions;
using System.Text.RegularExpressions;

namespace Eurolm.DomainService.Repositories
{
    public class KeyRepository : IKeyRepository
    {
        private readonly IDbContextProvider _dbContextProvider;
        private readonly ILogger<KeyRepository> _logger;
        private const string _collectionName = "BlocksLanguageKeys";
        private const string BlocksLanguageModulesCollection = "BlocksLanguageModules";
        private const string KeyNameField = "KeyName";
        private const string CreateDateField = "CreateDate";
        private const string MatchStage = "$match";
        private const string GroupStage = "$group";
        private const string SortStage = "$sort";
        private const string LimitStage = "$limit";

        public const int DefaultKeyPageSize = 10;
        public const int MaxKeyPageSize = 1000;
        public static readonly TimeSpan KeyListQueryMaxTime = TimeSpan.FromSeconds(15);

        public KeyRepository(IDbContextProvider dbContextProvider, ILogger<KeyRepository>? logger = null)
        {
            _dbContextProvider = dbContextProvider;
            _logger = logger ?? NullLogger<KeyRepository>.Instance;
        }


        public async Task<Key> GetByIdAsync(string itemId)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<Key>(_collectionName);
            var filter = Builders<Key>.Filter.Eq(lk => lk.ItemId, itemId);

            return await collection.Find(filter).FirstOrDefaultAsync();
        }


        public async Task<IQueryable<BlocksLanguageKey>> GetUilmResourceKeysWithPage(int page, int size, string? moduleId)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);
            var filter = string.IsNullOrEmpty(moduleId)
                ? Builders<BlocksLanguageKey>.Filter.Empty
                : Builders<BlocksLanguageKey>.Filter.Eq(k => k.ModuleId, moduleId);

            var result = await collection
                            .Find(filter)
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
            var tenantId = BlocksContext.GetContext()?.TenantId ?? "";
            var dataBase = _dbContextProvider.GetDatabase(tenantId);
            var collection = dataBase.GetCollection<Key>(_collectionName);
            _ = KeyIndexInitializer.EnsureStarted(tenantId, collection, _logger);

            var pageSize = request.PageSize <= 0 ? DefaultKeyPageSize : Math.Min(request.PageSize, MaxKeyPageSize);
            var sortField = KeyListCursor.ResolveSortField(request.SortProperty)
                ?? throw new KeyListException(KeyListErrorCodes.InvalidSortProperty, nameof(GetKeysRequest.SortProperty));
            var isDescending = request.IsDescending;

            var filter = getAllKeysFilter(request);
            var filterHash = KeyListCursor.ComputeFilterHash(filter, sortField, isDescending);

            // Validate the cursor before touching the database so a bad token never costs a query.
            var cursor = DecodeCursor(request, filterHash, sortField, isDescending);

            // _id breaks ties so rows sharing a sort value (bulk imports stamp identical dates) keep a stable order across pages.
            var sort = isDescending
                ? Builders<Key>.Sort.Descending(sortField).Descending(k => k.ItemId)
                : Builders<Key>.Sort.Ascending(sortField).Ascending(k => k.ItemId);

            var duplicatesTruncated = false;
            if (request.OnlyDuplicates)
            {
                var (ids, truncated) = await GetDuplicateKeyIdsAsync(dataBase.GetCollection<BsonDocument>(_collectionName));
                duplicatesTruncated = truncated;
                filter = Builders<Key>.Filter.And(filter, Builders<Key>.Filter.In(k => k.ItemId, ids));

                // Copies of the same key sit next to each other under the chosen sort, and the
                // tie-breakers keep paging stable and copies of one key in order.
                sort = Builders<Key>.Sort.Combine(
                    isDescending ? Builders<Key>.Sort.Descending(sortField) : Builders<Key>.Sort.Ascending(sortField),
                    Builders<Key>.Sort.Ascending(k => k.ModuleId),
                    Builders<Key>.Sort.Ascending(k => k.CreateDate),
                    Builders<Key>.Sort.Ascending(k => k.ItemId));
            }

            var find = collection
                .Find(cursor == null ? filter : filter & cursor.AfterFilter(), new FindOptions { MaxTime = KeyListQueryMaxTime });
            if (cursor == null)
            {
                // Computed in long so a huge PageNumber cannot overflow into a negative Skip.
                var skip = (long)Math.Max(request.PageNumber, 0) * pageSize;
                find = find.Skip((int)Math.Min(skip, int.MaxValue));
            }

            try
            {
                // One extra row tells us whether another page exists without a second query.
                var findKeysTask = find.Limit(pageSize + 1).Sort(sort).ToListAsync();
                var countDocumentsTask = request.IncludeTotalCount == false
                    ? Task.FromResult<long?>(null)
                    : CountAsync(collection, filter);

                await Task.WhenAll(findKeysTask, countDocumentsTask);

                var keys = findKeysTask.Result;
                string? nextCursor = null;
                if (keys.Count > pageSize)
                {
                    keys.RemoveRange(pageSize, keys.Count - pageSize);
                    if (!request.OnlyDuplicates)
                    {
                        nextCursor = KeyListCursor.Encode(keys[^1], sortField, isDescending, filterHash);
                    }
                }

                return new GetKeysQueryResponse
                {
                    Keys = keys,
                    TotalCount = countDocumentsTask.Result,
                    NextCursor = nextCursor,
                    DuplicatesTruncated = duplicatesTruncated
                };
            }
            catch (MongoExecutionTimeoutException ex)
            {
                // Search text is user content; only the tenant and the filter hash are logged.
                _logger.LogWarning(ex, "Key list query exceeded {MaxTime} for tenant {TenantId}, filter {FilterHash}", KeyListQueryMaxTime, tenantId, filterHash);
                throw new KeyListException(KeyListErrorCodes.QueryTimeout, "Query", 503, ex);
            }
        }

        /// <summary>
        /// The request's keyset cursor, or null when it pages by number.
        /// </summary>
        /// <exception cref="KeyListException">
        /// INVALID_CURSOR for a malformed token; CURSOR_MISMATCH when it was issued for another filter
        /// or sort, or sent with the duplicates filter.
        /// </exception>
        private static KeyListCursor? DecodeCursor(GetKeysRequest request, string filterHash, string sortField, bool isDescending)
        {
            var cursor = string.IsNullOrEmpty(request.Cursor) ? null : KeyListCursor.Decode(request.Cursor);
            if (cursor != null && (request.OnlyDuplicates || cursor.FilterHash != filterHash || cursor.SortField != sortField || cursor.IsDescending != isDescending))
            {
                // The duplicates view pages by offset (its order is not a keyset), so it never takes a cursor.
                throw new KeyListException(KeyListErrorCodes.CursorMismatch, nameof(GetKeysRequest.Cursor));
            }

            return cursor;
        }

        private static async Task<long?> CountAsync(IMongoCollection<Key> collection, FilterDefinition<Key> filter)
        {
            return await collection.CountDocumentsAsync(filter, new CountOptions { MaxTime = KeyListQueryMaxTime });
        }

        public async Task<MatchingKeyIds> GetMatchingKeyIdsAsync(GetKeysRequest filter, int limit)
        {
            var tenantId = BlocksContext.GetContext()?.TenantId ?? "";
            var dataBase = _dbContextProvider.GetDatabase(tenantId);
            var collection = dataBase.GetCollection<Key>(_collectionName);
            var query = getAllKeysFilter(filter);

            try
            {
                var duplicatesTruncated = false;
                if (filter.OnlyDuplicates)
                {
                    var (ids, truncated) = await GetDuplicateKeyIdsAsync(dataBase.GetCollection<BsonDocument>(_collectionName));
                    duplicatesTruncated = truncated;
                    query = Builders<Key>.Filter.And(query, Builders<Key>.Filter.In(k => k.ItemId, ids));
                }

                var documents = await collection
                    .Find(query, new FindOptions { MaxTime = KeyListQueryMaxTime })
                    .Project<BsonDocument>(Builders<Key>.Projection.Include(k => k.ItemId))
                    .Limit(limit)
                    .ToListAsync();

                return new MatchingKeyIds(documents.Select(doc => doc["_id"].ToString()!).ToList(), duplicatesTruncated);
            }
            catch (MongoExecutionTimeoutException ex)
            {
                // Search text is user content; only the tenant is logged.
                _logger.LogWarning(ex, "Bulk key target query exceeded {MaxTime} for tenant {TenantId}", KeyListQueryMaxTime, tenantId);
                throw new KeyListException(KeyListErrorCodes.QueryTimeout, BulkKeyTarget.Field, 503, ex);
            }
        }

        public async Task<List<BlocksLanguageKey>> GetKeysByIdsAsync(IReadOnlyCollection<string> itemIds)
        {
            ArgumentNullException.ThrowIfNull(itemIds);
            if (itemIds.Count == 0) return new List<BlocksLanguageKey>();

            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);

            return await collection.Find(Builders<BlocksLanguageKey>.Filter.In(k => k.ItemId, itemIds)).ToListAsync();
        }

        private const string BulkTranslateProgressCollection = "BulkTranslateProgress";

        public async Task<BulkTranslateProgress> RecordBulkTranslateBatchAsync(string operationId, bool succeeded)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BsonDocument>(BulkTranslateProgressCollection);
            var update = Builders<BsonDocument>.Update
                .Inc("Done", 1)
                .Inc("Failed", succeeded ? 0 : 1)
                .SetOnInsert(CreateDateField, DateTime.UtcNow);

            var progress = await collection.FindOneAndUpdateAsync(
                Builders<BsonDocument>.Filter.Eq("_id", operationId),
                update,
                new FindOneAndUpdateOptions<BsonDocument> { IsUpsert = true, ReturnDocument = ReturnDocument.After });

            return new BulkTranslateProgress(progress["Done"].ToInt32(), progress["Failed"].ToInt32());
        }

        public async Task DeleteBulkTranslateProgressAsync(string operationId)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BsonDocument>(BulkTranslateProgressCollection);
            await collection.DeleteOneAsync(Builders<BsonDocument>.Filter.Eq("_id", operationId));
        }

        public const int DuplicateKeyIdCap = 10_000;

        /// <summary>
        /// The ItemIds of every key in a duplicate group (same ModuleId and KeyName), ordered by
        /// KeyName, ModuleId and CreateDate and capped at <see cref="DuplicateKeyIdCap"/>.
        /// </summary>
        private static async Task<(List<string> Ids, bool Truncated)> GetDuplicateKeyIdsAsync(IMongoCollection<BsonDocument> collection)
        {
            var options = new AggregateOptions { AllowDiskUse = true };
            using var cursor = await collection.AggregateAsync(DuplicateKeyIdsPipeline(DuplicateKeyIdCap + 1), options);
            var ids = (await cursor.ToListAsync()).Select(doc => doc["_id"].ToString()!).ToList();

            var truncated = ids.Count > DuplicateKeyIdCap;
            return (truncated ? ids.Take(DuplicateKeyIdCap).ToList() : ids, truncated);
        }

        public static PipelineDefinition<BsonDocument, BsonDocument> DuplicateKeyIdsPipeline(int limit) => new[]
        {
            new BsonDocument(MatchStage, new BsonDocument
            {
                { "ModuleId", new BsonDocument("$type", "string") },
                { KeyNameField, new BsonDocument("$type", "string") },
            }),
            new BsonDocument(GroupStage, new BsonDocument
            {
                { "_id", new BsonDocument { { "ModuleId", "$ModuleId" }, { KeyNameField, "$KeyName" } } },
                { "count", new BsonDocument("$sum", 1) },
                { "members", new BsonDocument("$push", new BsonDocument { { "id", "$_id" }, { "created", "$CreateDate" } }) },
            }),
            new BsonDocument(MatchStage, new BsonDocument("count", new BsonDocument("$gt", 1))),
            new BsonDocument("$unwind", "$members"),
            new BsonDocument(SortStage, new BsonDocument
            {
                { "_id.KeyName", 1 },
                { "_id.ModuleId", 1 },
                { "members.created", 1 },
            }),
            new BsonDocument(LimitStage, limit),
            new BsonDocument("$project", new BsonDocument("_id", "$members.id")),
        };

        private static FilterDefinition<Key> getAllKeysFilter(GetKeysRequest query)
        {
            var filterBuilder = Builders<Key>.Filter;
            var matchFilters = new List<FilterDefinition<Key>>();

            AddSearchTextFilters(query, filterBuilder, matchFilters);
            AddResourceSearchFilters(query, filterBuilder, matchFilters);
            AddModuleFilter(query, filterBuilder, matchFilters);
            AddDateRangeFilters(query, filterBuilder, matchFilters);
            AddMissingLanguagesFilter(query, filterBuilder, matchFilters);
            AddGlossaryFilters(query, filterBuilder, matchFilters);

            return matchFilters.Count > 0 ? filterBuilder.And(matchFilters) : filterBuilder.Empty;
        }

        private static void AddSearchTextFilters(GetKeysRequest query, FilterDefinitionBuilder<Key> filterBuilder, List<FilterDefinition<Key>> matchFilters)
        {
            if (!string.IsNullOrWhiteSpace(query.KeySearchText))
            {
                var keyNameFilter = filterBuilder.Regex(KeyNameField, new BsonRegularExpression($".*{Regex.Escape(query.KeySearchText)}.*", "i"));
                var resourceValueFilter = filterBuilder.ElemMatch(x => x.Resources,
                    Builders<Resource>.Filter.Regex(r => r.Value, new BsonRegularExpression($".*{Regex.Escape(query.KeySearchText)}.*", "i")));
                matchFilters.Add(filterBuilder.Or(keyNameFilter, resourceValueFilter));
            }

            if (!string.IsNullOrWhiteSpace(query.SearchKey))
            {
                var searchKeyFilter = filterBuilder.Regex(KeyNameField, new BsonRegularExpression($".*{Regex.Escape(query.SearchKey)}.*", "i"));
                matchFilters.Add(searchKeyFilter);
            }
        }

        private static void AddResourceSearchFilters(GetKeysRequest query, FilterDefinitionBuilder<Key> filterBuilder, List<FilterDefinition<Key>> matchFilters)
        {
            if (query.ResourceSearchFilters == null || query.ResourceSearchFilters.Length == 0)
            {
                return;
            }

            foreach (var resourceFilter in query.ResourceSearchFilters)
            {
                if (!string.IsNullOrWhiteSpace(resourceFilter.SearchText) && !string.IsNullOrWhiteSpace(resourceFilter.Culture))
                {
                    var cultureAndValueFilter = filterBuilder.ElemMatch(x => x.Resources,
                        Builders<Resource>.Filter.And(
                            Builders<Resource>.Filter.Eq(r => r.Culture, resourceFilter.Culture),
                            Builders<Resource>.Filter.Regex(r => r.Value, new BsonRegularExpression($".*{Regex.Escape(resourceFilter.SearchText)}.*", "i"))
                        ));
                    matchFilters.Add(cultureAndValueFilter);
                }
            }
        }

        private static void AddModuleFilter(GetKeysRequest query, FilterDefinitionBuilder<Key> filterBuilder, List<FilterDefinition<Key>> matchFilters)
        {
            if (query.ModuleIds == null || query.ModuleIds.Length == 0)
            {
                return;
            }

            if (query.ModuleIds.Length == 1 && !string.IsNullOrWhiteSpace(query.ModuleIds[0]))
            {
                matchFilters.Add(filterBuilder.Eq(x => x.ModuleId, query.ModuleIds[0]));
            }
            else if (query.ModuleIds.Length > 1)
            {
                matchFilters.Add(filterBuilder.In(x => x.ModuleId, query.ModuleIds));
            }
        }

        private static void AddDateRangeFilters(GetKeysRequest query, FilterDefinitionBuilder<Key> filterBuilder, List<FilterDefinition<Key>> matchFilters)
        {
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
        }

        private static void AddMissingLanguagesFilter(GetKeysRequest query, FilterDefinitionBuilder<Key> filterBuilder, List<FilterDefinition<Key>> matchFilters)
        {
            if (query.MissingLanguages == null || query.MissingLanguages.Count == 0)
            {
                return;
            }

            // A key is "missing" a language if that language's resource is absent OR has an empty/null value.
            // Return keys that are missing at least one of the requested languages.
            var perLanguageFilters = query.MissingLanguages.Select(lang =>
                filterBuilder.Or(
                    // Resource exists for this language but value is empty/null
                    filterBuilder.ElemMatch(x => x.Resources,
                        Builders<Resource>.Filter.And(
                            Builders<Resource>.Filter.Eq(r => r.Culture, lang),
                            Builders<Resource>.Filter.Or(
                                Builders<Resource>.Filter.Eq(r => r.Value, null),
                                Builders<Resource>.Filter.Eq(r => r.Value, "")
                            )
                        )
                    ),
                    // No resource exists at all for this language
                    filterBuilder.Not(
                        filterBuilder.ElemMatch(x => x.Resources,
                            Builders<Resource>.Filter.Eq(r => r.Culture, lang)
                        )
                    )
                )
            );
            matchFilters.Add(filterBuilder.Or(perLanguageFilters));
        }

        private static void AddGlossaryFilters(GetKeysRequest query, FilterDefinitionBuilder<Key> filterBuilder, List<FilterDefinition<Key>> matchFilters)
        {
            if (!string.IsNullOrWhiteSpace(query.GlossaryId))
            {
                var tagged = filterBuilder.AnyEq(x => x.GlossaryIds, query.GlossaryId);
                var scopeModuleIds = query.GlossaryModuleIds?.Where(id => !string.IsNullOrWhiteSpace(id)).Distinct(StringComparer.Ordinal).ToArray();
                matchFilters.Add(scopeModuleIds is { Length: > 0 }
                    ? filterBuilder.Or(tagged, filterBuilder.In(x => x.ModuleId, scopeModuleIds))
                    : tagged);
            }

            if (query.HasGlossaryViolations.HasValue)
            {
                // "GlossaryViolations.0" exists only when the array has at least one entry.
                var hasViolations = filterBuilder.Exists("GlossaryViolations.0", true);
                matchFilters.Add(query.HasGlossaryViolations.Value ? hasViolations : filterBuilder.Not(hasViolations));
            }
        }

        private static List<FilterDefinition<Key>> setDateFilter(GetKeysRequest query, FilterDefinitionBuilder<Key> filterBuilder)
        {
            FilterDefinition<Key> dateFilter;
            var dateFilters = new List<FilterDefinition<Key>>();

            if (query.CreateDateRange.StartDate != default(DateTime) && query.CreateDateRange.StartDate != null && (query.CreateDateRange.EndDate == default(DateTime) || query.CreateDateRange.EndDate == null))
            {
                dateFilter = filterBuilder.Gte(CreateDateField, query.CreateDateRange.StartDate);
                dateFilters.Add(dateFilter);
            }
            else if ((query.CreateDateRange.StartDate == default(DateTime) || query.CreateDateRange.StartDate == null) && query.CreateDateRange.EndDate != default(DateTime) && query.CreateDateRange.EndDate != null)
            {
                dateFilter = filterBuilder.Lte(CreateDateField, query.CreateDateRange.EndDate);
                dateFilters.Add(dateFilter);
            }
            else if (query.CreateDateRange.StartDate != default(DateTime) && query.CreateDateRange.StartDate != null && query.CreateDateRange.EndDate != default(DateTime) && query.CreateDateRange.EndDate != null)
            {
                dateFilter = filterBuilder.And(
                    filterBuilder.Gte(CreateDateField, query.CreateDateRange.StartDate),
                    filterBuilder.Lte(CreateDateField, query.CreateDateRange.EndDate)
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

        public async Task<List<BlocksLanguageKey>> GetKeysByNameAndModuleAsync(IReadOnlyCollection<(string KeyName, string ModuleId)> keys)
        {
            ArgumentNullException.ThrowIfNull(keys);
            if (keys.Count == 0) return new List<BlocksLanguageKey>();

            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);
            var filter = Builders<BlocksLanguageKey>.Filter.In(k => k.KeyName, keys.Select(k => k.KeyName).Distinct()) &
                         Builders<BlocksLanguageKey>.Filter.In(k => k.ModuleId, keys.Select(k => k.ModuleId).Distinct());

            var requested = keys.ToHashSet();
            var found = await collection.Find(filter).ToListAsync();
            return found.Where(k => requested.Contains((k.KeyName, k.ModuleId))).ToList();
        }

        public async Task<bool> SetGlossaryIdsAsync(BlocksLanguageKey key, bool setGlossaryViolations)
        {
            ArgumentNullException.ThrowIfNull(key);

            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);

            var result = await collection.UpdateOneAsync(KeyNameAndModuleFilter(key), GlossaryIdsUpdate(key, setGlossaryViolations));
            return result.MatchedCount > 0;
        }

        public async Task<IReadOnlyList<KeyBulkSaveError>> BulkSaveKeysAsync(IReadOnlyList<KeyBulkSave> saves)
        {
            ArgumentNullException.ThrowIfNull(saves);
            if (saves.Count == 0) return Array.Empty<KeyBulkSaveError>();

            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);
            var models = saves.Select(save => save.GlossaryIdsOnly
                ? (WriteModel<BlocksLanguageKey>)new UpdateOneModel<BlocksLanguageKey>(KeyNameAndModuleFilter(save.Key), GlossaryIdsUpdate(save.Key, save.SetGlossaryViolations))
                : new ReplaceOneModel<BlocksLanguageKey>(KeyNameAndModuleFilter(save.Key), save.Key) { IsUpsert = true }).ToList();

            var errors = new List<KeyBulkSaveError>();
            try
            {
                await collection.BulkWriteAsync(models, new BulkWriteOptions { IsOrdered = false });
            }
            catch (MongoBulkWriteException<BlocksLanguageKey> ex)
            {
                if (ex.WriteConcernError != null)
                    _logger.LogWarning(ex, "Bulk key save: write concern error {WriteConcernErrorCode} for a batch of {KeyCount} keys", ex.WriteConcernError.Code, saves.Count);
                errors.AddRange(ex.WriteErrors.Select(error => new KeyBulkSaveError(error.Index, DuplicateKeyRetry.IsDuplicateKey(error), error.Message)));
            }

            await SaveMissingTagOnlyKeysAsync(collection, saves, errors);
            return errors;
        }

        /// <summary>
        /// A tag-only entry whose key was deleted after the read matched nothing; like a single save, it is then
        /// stored as a full save of the key it was mapped from.
        /// </summary>
        private async Task SaveMissingTagOnlyKeysAsync(IMongoCollection<BlocksLanguageKey> collection, IReadOnlyList<KeyBulkSave> saves, List<KeyBulkSaveError> errors)
        {
            var failed = errors.Select(e => e.Index).ToHashSet();
            var tagOnly = Enumerable.Range(0, saves.Count).Where(i => saves[i].GlossaryIdsOnly && !failed.Contains(i)).ToList();
            if (tagOnly.Count == 0) return;

            var stored = await GetKeysByNameAndModuleAsync(tagOnly.Select(i => (saves[i].Key.KeyName, saves[i].Key.ModuleId)).Distinct().ToList());
            var found = stored.Select(k => (k.KeyName, k.ModuleId)).ToHashSet();
            var missing = tagOnly.Where(i => !found.Contains((saves[i].Key.KeyName, saves[i].Key.ModuleId))).ToList();
            if (missing.Count == 0) return;

            var replacements = missing
                .Select(i => (WriteModel<BlocksLanguageKey>)new ReplaceOneModel<BlocksLanguageKey>(KeyNameAndModuleFilter(saves[i].Key), saves[i].Key) { IsUpsert = true })
                .ToList();
            try
            {
                await collection.BulkWriteAsync(replacements, new BulkWriteOptions { IsOrdered = false });
            }
            catch (MongoBulkWriteException<BlocksLanguageKey> ex)
            {
                if (ex.WriteConcernError != null)
                    _logger.LogWarning(ex, "Bulk key save: write concern error {WriteConcernErrorCode} for a batch of {KeyCount} keys", ex.WriteConcernError.Code, replacements.Count);
                errors.AddRange(ex.WriteErrors.Select(error => new KeyBulkSaveError(missing[error.Index], DuplicateKeyRetry.IsDuplicateKey(error), error.Message)));
            }
        }

        private static FilterDefinition<BlocksLanguageKey> KeyNameAndModuleFilter(BlocksLanguageKey key) =>
            Builders<BlocksLanguageKey>.Filter.Eq(k => k.KeyName, key.KeyName) &
            Builders<BlocksLanguageKey>.Filter.Eq(k => k.ModuleId, key.ModuleId);

        private static UpdateDefinition<BlocksLanguageKey> GlossaryIdsUpdate(BlocksLanguageKey key, bool setGlossaryViolations)
        {
            var update = Builders<BlocksLanguageKey>.Update
                .Set(k => k.GlossaryIds, key.GlossaryIds)
                .Set(k => k.LastUpdateDate, key.LastUpdateDate);
            return setGlossaryViolations ? update.Set(k => k.GlossaryViolations, key.GlossaryViolations) : update;
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
            // The index on (ModuleName, Language, Version) is ensured by the publish that writes the rows.
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var project = Builders<BsonDocument>.Projection.As<UilmFile>();
            var filter = Builders<BsonDocument>.Filter.Eq("Language", request.Language) & Builders<BsonDocument>.Filter.Eq("ModuleName", request.ModuleName);

            return await dataBase.GetCollection<BsonDocument>(UilmFilesCollection)
                .Find(filter)
                .Sort(Builders<BsonDocument>.Sort.Descending(nameof(UilmFile.Version)))
                .Project(project)
                .FirstOrDefaultAsync();
        }

        public async Task<List<UilmManifestRow>> GetUilmManifestRowsAsync(string? moduleName, string? language)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var match = new BsonDocument();
            if (moduleName != null) match[nameof(UilmFile.ModuleName)] = moduleName;
            if (language != null) match[nameof(UilmFile.Language)] = language;

            // Same selection as GetUilmFile: per module and language, the highest Version first (legacy rows last), on
            // the (ModuleName, Language, Version) index. Content is never returned.
            var stages = new[]
            {
                new BsonDocument("$match", match),
                new BsonDocument("$sort", new BsonDocument { { nameof(UilmFile.ModuleName), 1 }, { nameof(UilmFile.Language), 1 }, { nameof(UilmFile.Version), -1 } }),
                new BsonDocument("$group", new BsonDocument
                {
                    { "_id", new BsonDocument { { "m", "$" + nameof(UilmFile.ModuleName) }, { "l", "$" + nameof(UilmFile.Language) } } },
                    { nameof(UilmManifestRow.ModuleName), GroupFirst(nameof(UilmFile.ModuleName)) },
                    { nameof(UilmManifestRow.Language), GroupFirst(nameof(UilmFile.Language)) },
                    { nameof(UilmManifestRow.FileId), GroupFirst(nameof(UilmFile.FileId)) },
                    { nameof(UilmManifestRow.Url), GroupFirst(nameof(UilmFile.Url)) },
                    { nameof(UilmManifestRow.ContentHash), GroupFirst(nameof(UilmFile.ContentHash)) },
                    { nameof(UilmManifestRow.Size), GroupFirst(nameof(UilmFile.Size)) },
                    { nameof(UilmManifestRow.Version), GroupFirst(nameof(UilmFile.Version)) }
                }),
                new BsonDocument("$project", new BsonDocument("_id", 0))
            };
            using var cursor = await dataBase.GetCollection<BsonDocument>(UilmFilesCollection)
                .AggregateAsync(PipelineDefinition<BsonDocument, UilmManifestRow>.Create(stages));
            var rows = await cursor.ToListAsync();

            // The ledger states of the pointed-at files in one read by _id (a $lookup per row measured about three times
            // slower). It runs after the pointer read, so a file retired in between is not Live and gets no URL.
            var fileIds = rows.Where(r => r.FileId != null).Select(r => r.FileId!).Distinct().ToList();
            if (fileIds.Count == 0) return rows;
            var states = (await dataBase.GetCollection<UilmStoredFile>(UilmStoredFileRepository.CollectionName)
                    .Find(Builders<UilmStoredFile>.Filter.In(f => f.Id, fileIds))
                    .Project(f => new { f.Id, f.State })
                    .ToListAsync())
                .ToDictionary(f => f.Id, f => f.State, StringComparer.Ordinal);
            foreach (var row in rows)
            {
                row.LedgerState = row.FileId != null && states.TryGetValue(row.FileId, out var state) ? state : null;
            }
            return rows;
        }

        private static BsonDocument GroupFirst(string field) => new("$first", "$" + field);

        private const string UilmFilesCollection = "UilmFiles";

        private static readonly IReadOnlyList<CreateIndexModel<UilmFile>> UilmFileIndexes =
        [
            new(Builders<UilmFile>.IndexKeys.Ascending(f => f.ModuleName).Ascending(f => f.Language).Descending(f => f.Version),
                new CreateIndexOptions { Name = "ModuleName_1_Language_1_Version_-1" })
        ];

        private IMongoCollection<UilmFile> UilmFiles()
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            _ = MongoIndexEnsurer.EnsureAsync(dataBase, UilmFilesCollection, UilmFileIndexes, _logger);
            return dataBase.GetCollection<UilmFile>(UilmFilesCollection);
        }

        public Task<List<UilmFile>> GetUilmFilesOfModuleAsync(string moduleName) =>
            UilmFiles().Find(f => f.ModuleName == moduleName).ToListAsync();

        public async Task<UilmFilePointerWrite> ReplaceUilmFilePointerAsync(UilmFile pointer)
        {
            var collection = UilmFiles();
            var filter = Builders<UilmFile>.Filter.Eq(f => f.Id, pointer.Id)
                & (Builders<UilmFile>.Filter.Eq(f => f.Version, null) | Builders<UilmFile>.Filter.Lt(f => f.Version, pointer.Version));
            var options = new FindOneAndReplaceOptions<UilmFile, UilmFile?> { IsUpsert = true, ReturnDocument = ReturnDocument.Before };
            // A duplicate key means the upsert tried to insert a row that exists: either it has the same or a higher
            // version, or a concurrent writer inserted it first. The second attempt sees that row and decides.
            try
            {
                return new UilmFilePointerWrite(true, await collection.FindOneAndReplaceAsync(filter, pointer, options));
            }
            catch (MongoException ex) when (IsDuplicateKeyError(ex))
            {
                try
                {
                    return new UilmFilePointerWrite(true, await collection.FindOneAndReplaceAsync(filter, pointer, options));
                }
                catch (MongoException retryEx) when (IsDuplicateKeyError(retryEx))
                {
                    return new UilmFilePointerWrite(false, null);
                }
            }
        }

        /// <summary>findAndModify reports a duplicate key as a command error, other writes as a write error.</summary>
        private static bool IsDuplicateKeyError(MongoException ex) =>
            DuplicateKeyRetry.IsDuplicateKey(ex) || ex is MongoCommandException { Code: 11000 };

        public Task DeleteUilmFileDuplicatesAsync(string moduleName, string language, string keepId) =>
            UilmFiles().DeleteManyAsync(f => f.ModuleName == moduleName && f.Language == language && f.Id != keepId);

        public async Task<List<UilmFile>> DeleteUilmFilesOfOtherLanguagesAsync(string moduleName, IReadOnlyCollection<string> languages)
        {
            var collection = UilmFiles();
            var filter = Builders<UilmFile>.Filter.Eq(f => f.ModuleName, moduleName) & Builders<UilmFile>.Filter.Nin(f => f.Language, languages);
            var removed = await collection.Find(filter).ToListAsync();
            if (removed.Count > 0)
            {
                await collection.DeleteManyAsync(Builders<UilmFile>.Filter.In(f => f.Id, removed.Select(f => f.Id)));
            }
            return removed;
        }

        public async Task<HashSet<string>> GetReferencedUilmFileIdsAsync(IReadOnlyCollection<string> fileIds)
        {
            if (fileIds.Count == 0) return new HashSet<string>(StringComparer.Ordinal);
            var referenced = await UilmFiles()
                .Find(Builders<UilmFile>.Filter.In(f => f.FileId, fileIds))
                .Project(f => f.FileId)
                .ToListAsync();
            return referenced.Where(id => id != null).Select(id => id!).ToHashSet(StringComparer.Ordinal);
        }

        private const string LedgerField = "__ledger";
        private const string IdField = "_id";
        private const string NotEqual = "$ne";
        private const string ProjectStage = "$project";
        private const string GroupModule = "m";
        private const string GroupLanguage = "l";
        private const string HasFileKey = "f";
        private const string HasContentKey = "c";

        /// <summary>Joins each row's ledger entry (empty when the row has no <c>FileId</c> or the ledger doesn't know it).</summary>
        private static readonly BsonDocument LedgerLookup = new("$lookup", new BsonDocument
        {
            { "from", UilmStoredFileRepository.CollectionName },
            { "localField", nameof(UilmFile.FileId) },
            { "foreignField", IdField },
            { "as", LedgerField }
        });

        private static BsonDocument HasLedgerFile() => new("$gt", new BsonArray { new BsonDocument("$size", "$" + LedgerField), 0 });

        public async Task<List<UilmFileGroup>> GetUilmBackfillGroupsAsync(int limit)
        {
            var pipeline = PipelineDefinition<UilmFile, BsonDocument>.Create(
                new BsonDocument(MatchStage, new BsonDocument(nameof(UilmFile.Content), new BsonDocument(NotEqual, BsonNull.Value))),
                // Content isn't needed past the filter.
                new BsonDocument(ProjectStage, new BsonDocument
                {
                    { nameof(UilmFile.ModuleName), 1 }, { nameof(UilmFile.Language), 1 }, { nameof(UilmFile.FileId), 1 }
                }),
                LedgerLookup,
                new BsonDocument(MatchStage, new BsonDocument(LedgerField, new BsonDocument("$size", 0))),
                new BsonDocument(GroupStage, new BsonDocument(IdField, new BsonDocument
                {
                    { GroupModule, "$" + nameof(UilmFile.ModuleName) }, { GroupLanguage, "$" + nameof(UilmFile.Language) }
                })),
                new BsonDocument(SortStage, new BsonDocument(IdField, 1)),
                new BsonDocument(LimitStage, limit)
            );
            var groups = await (await UilmFiles().AggregateAsync(pipeline)).ToListAsync();
            return groups
                .Select(g => g[IdField].AsBsonDocument)
                .Where(id => id.GetValue(GroupModule, BsonNull.Value).IsString && id.GetValue(GroupLanguage, BsonNull.Value).IsString)
                .Select(id => new UilmFileGroup(id[GroupModule].AsString, id[GroupLanguage].AsString))
                .ToList();
        }

        public async Task<bool> ReplaceUilmFileFromBackfillAsync(UilmFile served, UilmFile pointer)
        {
            var collection = UilmFiles();
            var byPointerId = Builders<UilmFile>.Filter.Eq(f => f.Id, pointer.Id);
            if (served.Id == pointer.Id)
            {
                // Eq(null) also matches a missing field.
                var unchanged = byPointerId
                    & Builders<UilmFile>.Filter.Eq(f => f.Version, served.Version)
                    & Builders<UilmFile>.Filter.Eq(f => f.FileId, served.FileId);
                return await collection.FindOneAndReplaceAsync<UilmFile?>(unchanged, pointer) != null;
            }

            // A legacy row with a random id: the pointer row may only replace a row with its id that has neither a
            // version nor a file. A publish (or an overlapping backfill) wrote one with a version, and the upsert's
            // insert then fails on the existing id.
            var replaceable = byPointerId
                & Builders<UilmFile>.Filter.Eq(f => f.Version, null)
                & Builders<UilmFile>.Filter.Eq(f => f.FileId, null);
            try
            {
                await collection.ReplaceOneAsync(replaceable, pointer, new ReplaceOptions { IsUpsert = true });
            }
            catch (MongoException ex) when (IsDuplicateKeyError(ex))
            {
                return false;
            }

            // The served row must still be there: a publish that dropped its language, or a copy that replaced the
            // module's rows, deleted it during the upload. Then the pointer would serve stale content, so it goes.
            var stillServed = Builders<UilmFile>.Filter.Eq(f => f.Id, served.Id)
                & Builders<UilmFile>.Filter.Eq(f => f.Version, served.Version)
                & Builders<UilmFile>.Filter.Eq(f => f.FileId, served.FileId);
            if (await collection.CountDocumentsAsync(stillServed, new CountOptions { Limit = 1 }) > 0)
            {
                return true;
            }
            await collection.DeleteOneAsync(byPointerId & Builders<UilmFile>.Filter.Eq(f => f.FileId, pointer.FileId));
            return false;
        }

        public async Task<UilmFileCounts> CountUilmFilesAsync()
        {
            var content = new BsonDocument(NotEqual, new BsonArray { new BsonDocument("$ifNull", new BsonArray { "$" + nameof(UilmFile.Content), BsonNull.Value }), BsonNull.Value });
            var pipeline = PipelineDefinition<UilmFile, BsonDocument>.Create(
                new BsonDocument(ProjectStage, new BsonDocument
                {
                    { nameof(UilmFile.FileId), 1 },
                    { HasContentKey, content }
                }),
                LedgerLookup,
                new BsonDocument(GroupStage, new BsonDocument
                {
                    { IdField, new BsonDocument { { HasFileKey, HasLedgerFile() }, { HasContentKey, "$" + HasContentKey } } },
                    { "n", new BsonDocument("$sum", 1) }
                })
            );
            var buckets = await (await UilmFiles().AggregateAsync(pipeline)).ToListAsync();

            long legacy = 0;
            long withContent = 0;
            long withoutContent = 0;
            foreach (var bucket in buckets)
            {
                var key = bucket[IdField].AsBsonDocument;
                var count = bucket["n"].ToInt64();
                if (!key[HasFileKey].AsBoolean)
                {
                    legacy += count;
                }
                else if (key[HasContentKey].AsBoolean)
                {
                    withContent += count;
                }
                else
                {
                    withoutContent += count;
                }
            }
            return new UilmFileCounts(legacy, withContent, withoutContent);
        }

        public async Task<List<UilmFile>> GetUilmFilesWithLiveFileAsync(bool withContent, string? afterId, int limit)
        {
            var match = new BsonDocument
            {
                { nameof(UilmFile.FileId), new BsonDocument(NotEqual, BsonNull.Value) },
                { nameof(UilmFile.ContentHash), new BsonDocument(NotEqual, BsonNull.Value) },
                { nameof(UilmFile.Content), withContent ? new BsonDocument(NotEqual, BsonNull.Value) : BsonNull.Value }
            };
            if (afterId != null)
            {
                match.Add(IdField, new BsonDocument("$gt", afterId));
            }
            var pipeline = PipelineDefinition<UilmFile, UilmFile>.Create(
                new BsonDocument(MatchStage, match),
                new BsonDocument(SortStage, new BsonDocument(IdField, 1)),
                new BsonDocument(ProjectStage, new BsonDocument(nameof(UilmFile.Content), 0)),
                LedgerLookup,
                new BsonDocument(MatchStage, new BsonDocument(LedgerField + ".State", UilmStoredFileState.Live)),
                new BsonDocument(LimitStage, limit),
                new BsonDocument(ProjectStage, new BsonDocument(LedgerField, 0))
            );
            return await (await UilmFiles().AggregateAsync(pipeline)).ToListAsync();
        }

        private static FilterDefinition<UilmFile> SameFile(UilmFile row) =>
            Builders<UilmFile>.Filter.Eq(f => f.Id, row.Id)
            & Builders<UilmFile>.Filter.Eq(f => f.FileId, row.FileId)
            & Builders<UilmFile>.Filter.Eq(f => f.ContentHash, row.ContentHash);

        public async Task<bool> RemoveUilmFileContentAsync(UilmFile row)
        {
            var result = await UilmFiles().UpdateOneAsync(
                SameFile(row) & Builders<UilmFile>.Filter.Ne(f => f.Content, null),
                Builders<UilmFile>.Update.Unset(f => f.Content));
            return result.ModifiedCount > 0;
        }

        public async Task<bool> RestoreUilmFileContentAsync(UilmFile row, string content)
        {
            var result = await UilmFiles().UpdateOneAsync(
                SameFile(row) & Builders<UilmFile>.Filter.Eq(f => f.Content, null),
                Builders<UilmFile>.Update.Set(f => f.Content, content));
            return result.ModifiedCount > 0;
        }
        public async Task<UilmFile> GetUilmFile(GetUilmFileRequestForClient request)
        {
            var dataBase = _dbContextProvider.GetDatabase(request.projectKey);
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

        public async Task<bool> HasKeysInModuleAsync(string moduleId)
        {
            // Eq(ModuleId, null) would also match keys with no ModuleId at all.
            ArgumentException.ThrowIfNullOrWhiteSpace(moduleId);

            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);
            var filter = Builders<BlocksLanguageKey>.Filter.Eq(k => k.ModuleId, moduleId);

            var count = await collection.CountDocumentsAsync(filter, new CountOptions { Limit = 1 });
            return count > 0;
        }

        public async Task MoveKeysAsync(IReadOnlyCollection<string> itemIds, string targetModuleId)
        {
            ArgumentNullException.ThrowIfNull(itemIds);
            ArgumentException.ThrowIfNullOrWhiteSpace(targetModuleId);
            if (itemIds.Count == 0) return;

            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);
            var filter = Builders<BlocksLanguageKey>.Filter.In(k => k.ItemId, itemIds);
            var update = Builders<BlocksLanguageKey>.Update
                .Set(k => k.ModuleId, targetModuleId)
                .Set(k => k.LastUpdateDate, DateTime.UtcNow);

            await collection.UpdateManyAsync(filter, update);
        }

        public async Task<long> RemoveGlossaryIdFromKeysAsync(string glossaryId)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(glossaryId);

            var tenantId = BlocksContext.GetContext()?.TenantId ?? "";
            var dataBase = _dbContextProvider.GetDatabase(tenantId);
            _ = KeyIndexInitializer.EnsureStarted(tenantId, dataBase.GetCollection<Key>(_collectionName), _logger);

            var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);
            // A global or module term can leave violations on keys it isn't tagged on, so match those too.
            var filter = Builders<BlocksLanguageKey>.Filter.Or(
                Builders<BlocksLanguageKey>.Filter.AnyEq(k => k.GlossaryIds, glossaryId),
                Builders<BlocksLanguageKey>.Filter.ElemMatch(k => k.GlossaryViolations, v => v.GlossaryId == glossaryId));
            var update = Builders<BlocksLanguageKey>.Update
                .Pull(k => k.GlossaryIds, glossaryId)
                .PullFilter(k => k.GlossaryViolations, v => v.GlossaryId == glossaryId)
                .Set(k => k.LastUpdateDate, DateTime.UtcNow);

            var result = await collection.UpdateManyAsync(filter, update);
            return result.ModifiedCount;
        }

        public async Task SetGlossaryViolationsAsync(string keyId, List<KeyGlossaryViolation> violations)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(keyId);
            ArgumentNullException.ThrowIfNull(violations);

            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);
            var filter = Builders<BlocksLanguageKey>.Filter.Eq(k => k.ItemId, keyId);
            var update = Builders<BlocksLanguageKey>.Update.Set(k => k.GlossaryViolations, violations);

            await collection.UpdateOneAsync(filter, update);
        }

        public async Task<List<BlocksLanguageKey>> GetKeysForGlossaryRecheckAsync(GlossaryRecheckKeyScope? scope, string? afterItemId, int pageSize)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);
            var projection = Builders<BlocksLanguageKey>.Projection
                .Include(k => k.ItemId)
                .Include(k => k.ModuleId)
                .Include(k => k.GlossaryIds)
                .Include(k => k.Resources)
                .Include(k => k.GlossaryViolations)
                .Include(k => k.LastUpdateDate);

            // Keyset paging on _id: stable while the job rewrites GlossaryViolations, unlike skip/limit.
            return await collection.Find(BuildGlossaryRecheckFilter(scope, afterItemId))
                .Sort(Builders<BlocksLanguageKey>.Sort.Ascending(k => k.ItemId))
                .Limit(pageSize)
                .Project<BlocksLanguageKey>(projection)
                .ToListAsync();
        }

        public static FilterDefinition<BlocksLanguageKey> BuildGlossaryRecheckFilter(GlossaryRecheckKeyScope? scope, string? afterItemId)
        {
            var filterBuilder = Builders<BlocksLanguageKey>.Filter;
            var filters = new List<FilterDefinition<BlocksLanguageKey>>();
            if (!string.IsNullOrEmpty(afterItemId))
                filters.Add(filterBuilder.Gt(k => k.ItemId, afterItemId));

            if (scope != null)
            {
                var anyOf = new List<FilterDefinition<BlocksLanguageKey>>();
                if (scope.GlossaryIds.Count > 0)
                {
                    anyOf.Add(filterBuilder.AnyIn(k => k.GlossaryIds, scope.GlossaryIds));
                    anyOf.Add(filterBuilder.In("GlossaryViolations.GlossaryId", scope.GlossaryIds));
                }
                if (scope.ModuleIds.Count > 0)
                    anyOf.Add(filterBuilder.In(k => k.ModuleId, scope.ModuleIds));
                // An empty scope selects nothing (never every key).
                filters.Add(anyOf.Count > 0 ? filterBuilder.Or(anyOf) : filterBuilder.In(k => k.ItemId, Array.Empty<string>()));
            }

            return filters.Count > 0 ? filterBuilder.And(filters) : filterBuilder.Empty;
        }

        public async Task<long> SetGlossaryViolationsManyAsync(IReadOnlyList<GlossaryViolationUpdate> updates)
        {
            ArgumentNullException.ThrowIfNull(updates);
            if (updates.Count == 0) return 0;

            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);
            // Only GlossaryViolations is set; resources and every other field stay as stored.
            var models = updates.Select(u => (WriteModel<BlocksLanguageKey>)new UpdateOneModel<BlocksLanguageKey>(
                    BuildUnchangedKeyFilter(u.KeyId, u.ReadLastUpdateDate),
                    Builders<BlocksLanguageKey>.Update.Set(k => k.GlossaryViolations, u.Violations))
                { IsUpsert = false })
                .ToList();

            var result = await collection.BulkWriteAsync(models, new BulkWriteOptions { IsOrdered = false });
            return result.ModifiedCount;
        }

        /// <summary>The key, only while its LastUpdateDate is still the one read (a missing field reads as default).</summary>
        public static FilterDefinition<BlocksLanguageKey> BuildUnchangedKeyFilter(string keyId, DateTime readLastUpdateDate)
        {
            var filterBuilder = Builders<BlocksLanguageKey>.Filter;
            var unchanged = readLastUpdateDate == default
                ? filterBuilder.Or(filterBuilder.Exists(k => k.LastUpdateDate, false), filterBuilder.Eq(k => k.LastUpdateDate, default(DateTime)))
                : filterBuilder.Eq(k => k.LastUpdateDate, readLastUpdateDate);
            return filterBuilder.And(filterBuilder.Eq(k => k.ItemId, keyId), unchanged);
        }

        public async Task<GlossaryKeyUsage> GetGlossaryKeyUsageAsync(string glossaryId, int pageNumber, int pageSize)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(glossaryId);

            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);
            var tagged = Builders<BlocksLanguageKey>.Filter.AnyEq(k => k.GlossaryIds, glossaryId);
            var skip = (int)Math.Min((long)Math.Max(pageNumber, 0) * pageSize, int.MaxValue);

            var pageTask = collection.Find(tagged)
                .Sort(Builders<BlocksLanguageKey>.Sort.Ascending(k => k.KeyName).Ascending(k => k.ItemId))
                .Skip(skip)
                .Limit(pageSize)
                .Project(k => new GlossaryUsageKey { ItemId = k.ItemId, KeyName = k.KeyName, ModuleId = k.ModuleId })
                .ToListAsync();

            var tagFilter = new BsonDocument("GlossaryIds", glossaryId);
            var violationFilter = new BsonDocument("GlossaryViolations.GlossaryId", glossaryId);
            var pipeline = new[]
            {
                new BsonDocument(MatchStage, new BsonDocument("$or", new BsonArray { tagFilter, violationFilter })),
                new BsonDocument("$facet", new BsonDocument
                {
                    { "keyCount", new BsonArray { new BsonDocument(MatchStage, tagFilter), new BsonDocument("$count", "n") } },
                    { "moduleIds", new BsonArray { new BsonDocument(MatchStage, tagFilter), new BsonDocument("$group", new BsonDocument("_id", "$ModuleId")) } },
                    { "violationKeyCount", new BsonArray { new BsonDocument(MatchStage, violationFilter), new BsonDocument("$count", "n") } }
                })
            };
            var rawCollection = dataBase.GetCollection<BsonDocument>(_collectionName);
            async Task<BsonDocument?> FacetAsync()
            {
                using var cursor = await rawCollection.AggregateAsync<BsonDocument>(pipeline);
                return await cursor.FirstOrDefaultAsync();
            }
            var facetTask = FacetAsync();

            await Task.WhenAll(pageTask, facetTask);

            var facet = facetTask.Result ?? new BsonDocument();
            static long Count(BsonDocument facet, string name) =>
                facet.TryGetValue(name, out var value) && value.AsBsonArray.Count > 0
                    ? value.AsBsonArray[0]["n"].ToInt64()
                    : 0;

            return new GlossaryKeyUsage
            {
                KeyCount = Count(facet, "keyCount"),
                Keys = pageTask.Result,
                ModuleIds = facet.TryGetValue("moduleIds", out var modules)
                    ? modules.AsBsonArray.Select(m => m["_id"]).Where(id => id.IsString).Select(id => id.AsString).OrderBy(id => id, StringComparer.Ordinal).ToList()
                    : new List<string>(),
                ViolationKeyCount = Count(facet, "violationKeyCount")
            };
        }

        public async Task<long> CountKeysAffectedByGlossaryAsync(string glossaryId, bool isGlobal, IReadOnlyCollection<string> moduleIds)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(glossaryId);
            ArgumentNullException.ThrowIfNull(moduleIds);

            var collection = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "")
                .GetCollection<BlocksLanguageKey>(_collectionName);
            if (isGlobal) return await collection.EstimatedDocumentCountAsync();

            var filter = Builders<BlocksLanguageKey>.Filter;
            var affected = new List<FilterDefinition<BlocksLanguageKey>>
            {
                filter.AnyEq(k => k.GlossaryIds, glossaryId),
                filter.ElemMatch(k => k.GlossaryViolations, v => v.GlossaryId == glossaryId)
            };
            if (moduleIds.Count > 0) affected.Add(filter.In(k => k.ModuleId, moduleIds));
            return await collection.CountDocumentsAsync(filter.Or(affected));
        }

        public async Task<long> RemoveStaleGlossaryIdsAsync(IReadOnlyCollection<string> existingGlossaryIds, bool dryRun, int batchSize = 200)
        {
            ArgumentNullException.ThrowIfNull(existingGlossaryIds);

            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);
            var stale = Builders<BlocksLanguageKey>.Filter.ElemMatch<string>("GlossaryIds", new BsonDocument("$nin", new BsonArray(existingGlossaryIds)));

            var affected = await collection.Find(stale)
                .Project(k => new BlocksLanguageKey { ItemId = k.ItemId, GlossaryIds = k.GlossaryIds })
                .ToListAsync();
            var existing = existingGlossaryIds as ISet<string> ?? new HashSet<string>(existingGlossaryIds, StringComparer.Ordinal);
            long removed = affected.Sum(k => (long)(k.GlossaryIds?.Count(id => !existing.Contains(id)) ?? 0));
            if (dryRun || affected.Count == 0) return removed;

            // Pull exactly the stale ids found above, so an id that became valid since is never removed.
            var staleIds = affected.SelectMany(k => k.GlossaryIds ?? new List<string>()).Where(id => !existing.Contains(id)).Distinct(StringComparer.Ordinal);
            var pull = Builders<BlocksLanguageKey>.Update.PullFilter<string>("GlossaryIds", new BsonDocument("$in", new BsonArray(staleIds)));
            foreach (var chunk in affected.Select(k => k.ItemId).Chunk(batchSize))
            {
                await collection.UpdateManyAsync(Builders<BlocksLanguageKey>.Filter.In(k => k.ItemId, chunk), pull);
            }
            return removed;
        }

        public async Task<long> RemoveStaleGlossaryViolationsAsync(IReadOnlyCollection<string> existingGlossaryIds, bool dryRun, int batchSize = 200)
        {
            ArgumentNullException.ThrowIfNull(existingGlossaryIds);

            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);
            var stale = Builders<BlocksLanguageKey>.Filter.ElemMatch(k => k.GlossaryViolations,
                Builders<KeyGlossaryViolation>.Filter.Nin(v => v.GlossaryId, existingGlossaryIds));

            var affected = await collection.Find(stale)
                .Project(k => new BlocksLanguageKey { ItemId = k.ItemId, GlossaryViolations = k.GlossaryViolations })
                .ToListAsync();
            var existing = existingGlossaryIds as ISet<string> ?? new HashSet<string>(existingGlossaryIds, StringComparer.Ordinal);
            var staleIds = affected
                .SelectMany(k => k.GlossaryViolations ?? new List<KeyGlossaryViolation>())
                .Where(v => !existing.Contains(v.GlossaryId))
                .ToList();
            if (dryRun || affected.Count == 0) return staleIds.Count;

            var pull = Builders<BlocksLanguageKey>.Update.PullFilter(k => k.GlossaryViolations,
                Builders<KeyGlossaryViolation>.Filter.In(v => v.GlossaryId, staleIds.Select(v => v.GlossaryId).Distinct(StringComparer.Ordinal)));
            foreach (var chunk in affected.Select(k => k.ItemId).Chunk(batchSize))
            {
                await collection.UpdateManyAsync(Builders<BlocksLanguageKey>.Filter.In(k => k.ItemId, chunk), pull);
            }
            return staleIds.Count;
        }

        public async Task DeleteKeysAsync(IReadOnlyCollection<string> itemIds)
        {
            ArgumentNullException.ThrowIfNull(itemIds);
            if (itemIds.Count == 0) return;

            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);
            var filter = Builders<BlocksLanguageKey>.Filter.In(k => k.ItemId, itemIds);

            await collection.DeleteManyAsync(filter);
        }

        public async Task<BulkKeyDeleteResult> DeleteKeysWithSnapshotsAsync(IReadOnlyCollection<string> itemIds)
        {
            ArgumentNullException.ThrowIfNull(itemIds);
            if (itemIds.Count == 0) return new BulkKeyDeleteResult(new(), new());

            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);
            // Keep the same 500-ID service batches, while bounding the number of active Mongo operations.
            using var concurrency = new SemaphoreSlim(64);
            var tasks = itemIds.Select(async itemId =>
            {
                await concurrency.WaitAsync();
                try
                {
                    var deleted = await collection.FindOneAndDeleteAsync(
                        Builders<BlocksLanguageKey>.Filter.Eq(k => k.ItemId, itemId));
                    return (ItemId: itemId, Deleted: deleted, Error: (string?)null);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to delete bulk key {KeyId}", itemId);
                    return (ItemId: itemId, Deleted: (BlocksLanguageKey?)null, Error: ex.Message);
                }
                finally
                {
                    concurrency.Release();
                }
            }).ToArray();
            var results = await Task.WhenAll(tasks);
            var deletedKeys = results.Where(result => result.Deleted != null).Select(result => result.Deleted!).ToList();
            var errors = results.Where(result => result.Deleted == null)
                .ToDictionary(result => result.ItemId, result => result.Error ?? "Key not found");
            return new BulkKeyDeleteResult(deletedKeys, errors);
        }

        public async Task<long?> UpdateUilmResourceKeysForChangeAll(List<BlocksLanguageKey> uilmResourceKeys)
        {
            return await UpdateUilmResourceKeys(uilmResourceKeys);
        }

        public async Task<long?> UpdateUilmResourceKeys(List<BlocksLanguageKey> uilmResourceKeys)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");

            IMongoCollection<BlocksLanguageKey> collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);
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
                // Only the worker's glossary check sets violations; other callers pass keys without them,
                // which must not wipe the stored ones.
                if (uilmResourceKey.GlossaryViolations != null)
                {
                    update = update.Set(x => x.GlossaryViolations, uilmResourceKey.GlossaryViolations);
                }

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
            return await dataBase.GetCollection<BlocksLanguageKey>(_collectionName).Find(expression).ToListAsync();
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
            await dataBase.GetCollection<BlocksLanguageKey>(_collectionName).InsertManyAsync(entities);
        }

        public async Task InsertUilmResourceKeys(IEnumerable<BlocksLanguageKey> entities)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            await dataBase.GetCollection<BlocksLanguageKey>(_collectionName).InsertManyAsync(entities);
        }

        public async Task<List<BlocksLanguageKey>> InsertOrMergeResourceKeysAsync(List<BlocksLanguageKey> keys)
        {
            if (keys.Count == 0)
            {
                return new List<BlocksLanguageKey>();
            }

            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageKey>(_collectionName);
            try
            {
                // Unordered, so one rejected key does not stop the others.
                await collection.InsertManyAsync(keys, new InsertManyOptions { IsOrdered = false });
                return new List<BlocksLanguageKey>();
            }
            catch (MongoBulkWriteException<BlocksLanguageKey> ex) when (DuplicateKeyRetry.IsOnlyDuplicateKeyErrors(ex))
            {
                var lost = ex.WriteErrors.Select(error => keys[error.Index]).ToList();
                await UpsertResourceKeysWithMergeAsync(lost);
                return lost;
            }
        }

        public async Task<List<BlocksLanguageModule>> InsertModulesSkippingTakenNamesAsync(List<BlocksLanguageModule> modules)
        {
            if (modules.Count == 0)
            {
                return new List<BlocksLanguageModule>();
            }

            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageModule>(BlocksLanguageModulesCollection);
            try
            {
                await collection.InsertManyAsync(modules, new InsertManyOptions { IsOrdered = false });
                return new List<BlocksLanguageModule>();
            }
            catch (MongoBulkWriteException<BlocksLanguageModule> ex) when (DuplicateKeyRetry.IsOnlyDuplicateKeyErrors(ex))
            {
                return ex.WriteErrors.Select(error => modules[error.Index]).ToList();
            }
        }

        /// <summary>
        /// Upserts resource keys with atomic resource merging to handle concurrent imports.
        /// Uses ModuleId + KeyName as the unique identifier for upsert operations.
        /// Concurrent calls merge resources at the database level; the unique ModuleId + KeyName
        /// index (when the tenant has it) guarantees a single row per key.
        /// </summary>
        public async Task<(long upsertedCount, long modifiedCount)> UpsertResourceKeysWithMergeAsync(IEnumerable<BlocksLanguageKey> entities, string? tenantId = null)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageKey>("BlocksLanguageKeys");

            var bulkOps = new List<WriteModel<BlocksLanguageKey>>();

            foreach (var entity in entities)
            {
                // Use ModuleId + KeyName as the unique key for upsert (not ItemId)
                // This ensures concurrent imports for the same key merge correctly
                var filter = Builders<BlocksLanguageKey>.Filter.And(
                    Builders<BlocksLanguageKey>.Filter.Eq(x => x.ModuleId, entity.ModuleId),
                    Builders<BlocksLanguageKey>.Filter.Eq(x => x.KeyName, entity.KeyName)
                );

                // Build update with resource merging
                // For each resource in the entity, we update or add it to the Resources array
                var updateDefinitions = new List<UpdateDefinition<BlocksLanguageKey>>
                {
                    Builders<BlocksLanguageKey>.Update.Set(x => x.LastUpdateDate, entity.LastUpdateDate),
                    Builders<BlocksLanguageKey>.Update.Set(x => x.IsPartiallyTranslated, entity.IsPartiallyTranslated),
                    Builders<BlocksLanguageKey>.Update.SetOnInsert(x => x.ItemId, entity.ItemId ?? Guid.NewGuid().ToString()),
                    Builders<BlocksLanguageKey>.Update.SetOnInsert(x => x.CreateDate, entity.CreateDate),
                    Builders<BlocksLanguageKey>.Update.SetOnInsert(x => x.ModuleId, entity.ModuleId),
                    Builders<BlocksLanguageKey>.Update.SetOnInsert(x => x.KeyName, entity.KeyName),
                    Builders<BlocksLanguageKey>.Update.SetOnInsert(x => x.TenantId, entity.TenantId)
                };

                // Set Routes if provided
                if (entity.Routes != null && entity.Routes.Any())
                {
                    updateDefinitions.Add(Builders<BlocksLanguageKey>.Update.Set(x => x.Routes, entity.Routes));
                }

                // Set Context if provided
                if (!string.IsNullOrEmpty(entity.Context))
                {
                    updateDefinitions.Add(Builders<BlocksLanguageKey>.Update.Set(x => x.Context, entity.Context));
                }

                var update = Builders<BlocksLanguageKey>.Update.Combine(updateDefinitions);

                var upsertOp = new UpdateOneModel<BlocksLanguageKey>(filter, update) { IsUpsert = true };
                bulkOps.Add(upsertOp);
            }

            if (!bulkOps.Any())
            {
                return (0, 0);
            }

            var result = await DuplicateKeyRetry.BulkWriteAsync(collection, bulkOps);

            // Now merge resources in a second pass for keys that have resources
            // This is done separately to handle the complex array merging
            await MergeResourcesForKeysAsync(collection, entities);

            return (result.Upserted, result.Modified);
        }

        /// <summary>
        /// Merges resources for each key using MongoDB's array update operators.
        /// This handles the case where multiple concurrent imports add different language resources.
        /// </summary>
        private static async Task MergeResourcesForKeysAsync(IMongoCollection<BlocksLanguageKey> collection, IEnumerable<BlocksLanguageKey> entities)
        {
            foreach (var entity in entities)
            {
                if (entity.Resources == null || !entity.Resources.Any())
                    continue;

                var filter = Builders<BlocksLanguageKey>.Filter.And(
                    Builders<BlocksLanguageKey>.Filter.Eq(x => x.ModuleId, entity.ModuleId),
                    Builders<BlocksLanguageKey>.Filter.Eq(x => x.KeyName, entity.KeyName)
                );

                // For each resource, update if exists or add if not
                foreach (var resource in entity.Resources)
                {
                    if (string.IsNullOrEmpty(resource.Culture))
                        continue;

                    // Only update if the resource has a value (don't overwrite with empty values)
                    if (string.IsNullOrEmpty(resource.Value))
                        continue;

                    // Try to update existing resource with matching culture
                    var existingResourceFilter = Builders<BlocksLanguageKey>.Filter.And(
                        filter,
                        Builders<BlocksLanguageKey>.Filter.ElemMatch(x => x.Resources, r => r.Culture == resource.Culture)
                    );

                    var updateExisting = Builders<BlocksLanguageKey>.Update.Set("Resources.$", resource);
                    var updateResult = await collection.UpdateOneAsync(existingResourceFilter, updateExisting);

                    // If no existing resource was updated, add the new resource
                    if (updateResult.ModifiedCount == 0)
                    {
                        var addResourceUpdate = Builders<BlocksLanguageKey>.Update.Push(x => x.Resources, resource);
                        await collection.UpdateOneAsync(filter, addResourceUpdate);
                    }
                }
            }
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
                    .SetOnInsert(x => x.ItemId, Guid.NewGuid().ToString())
                    .SetOnInsert(x => x.CreateDate, DateTime.UtcNow);
                var filterForUpsert = Builders<BlocksLanguageModule>.Filter.Eq(x => x.ItemId, uilmApplication.ItemId);
                bulkOpsExtUpserts.Add(new UpdateOneModel<BlocksLanguageModule>(filterForUpsert, upsert) { IsUpsert = true });
            }

            await dataBase.GetCollection<BsonDocument>("UilmApplications")
                .BulkWriteAsync(bulkOpsInt);

            if (bulkOpsExt.Count > 0)
            {
                await dataBase.GetCollection<BsonDocument>(BlocksLanguageModulesCollection)
                    .BulkWriteAsync(bulkOpsExt);
            }

            if (bulkOpsExtUpserts.Count > 0)
            {
                await dataBase.GetCollection<BlocksLanguageModule>(BlocksLanguageModulesCollection)
                    .BulkWriteAsync(bulkOpsExtUpserts);
            }
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
                resourceKeyCount = await dataBase.GetCollection<BsonDocument>(_collectionName).CountDocumentsAsync(countFilter);
                await dataBase.GetCollection<BsonDocument>("BlocksLanguageApplications")
                .UpdateOneAsync(filter, Builders<BsonDocument>.Update.Set("NumberOfKeys", resourceKeyCount));
            }

            return true;
        }

        public async Task InsertUilmApplications(List<BlocksLanguageModule> uilmApplicationsToBeInserted, string clientTenantId)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            await dataBase.GetCollection<BlocksLanguageModule>(BlocksLanguageModulesCollection).InsertManyAsync(uilmApplicationsToBeInserted);
        }

        public async Task InsertUilmApplications(IEnumerable<BlocksLanguageModule> entities)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            await dataBase.GetCollection<BlocksLanguageModule>(BlocksLanguageModulesCollection).InsertManyAsync(entities);
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

            var validCollections = new List<string> { _collectionName, "BlocksLanguages", "BlocksLanguageModules", "UilmFiles" };

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

        private static FilterDefinition<UilmExportedFile> GetUilmExportedFilesFilter(GetUilmExportedFilesRequest request)
        {
            var builder = Builders<UilmExportedFile>.Filter;
            var filters = new List<FilterDefinition<UilmExportedFile>>();

            // Case-insensitive "contains" search on FileName; the text is escaped so it matches literally
            if (!string.IsNullOrEmpty(request.SearchText))
            {
                var regexFilter = builder.Regex(x => x.FileName, new MongoDB.Bson.BsonRegularExpression(Regex.Escape(request.SearchText), "i"));
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
