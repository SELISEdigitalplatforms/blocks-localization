using Blocks.Genesis;
using Eurolm.DomainService.Services;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using System.Text;
using System.Text.RegularExpressions;

namespace Eurolm.DomainService.Repositories
{
    public class GlossaryRepository : IGlossaryRepository
    {
        private readonly IDbContextProvider _dbContextProvider;
        private readonly ILogger<GlossaryRepository> _logger;
        private const string _collectionName = "BlocksGlossaries";
        private const string KeyCollectionName = "BlocksLanguageKeys";
        public const string NormalizedNameIndexName = "ux_normalizedname";

        public GlossaryRepository(IDbContextProvider dbContextProvider, ILogger<GlossaryRepository>? logger = null)
        {
            _dbContextProvider = dbContextProvider;
            _logger = logger ?? NullLogger<GlossaryRepository>.Instance;
        }

        /// <summary>
        /// Resolves the tenant database and starts the one-time index creation for it: the glossary
        /// IsGlobal/ModuleIds indexes and the key indexes, which include the GlossaryIds index.
        /// </summary>
        private IMongoDatabase GetDatabase(string tenantId)
        {
            var dataBase = _dbContextProvider.GetDatabase(tenantId);
            if (!string.IsNullOrEmpty(tenantId))
            {
                _ = GlossaryIndexInitializer.EnsureStarted(tenantId, dataBase.GetCollection<BlocksGlossary>(_collectionName), _logger);
                _ = KeyIndexInitializer.EnsureStarted(tenantId, dataBase.GetCollection<Key>(KeyCollectionName), _logger);
            }
            return dataBase;
        }

        private IMongoDatabase GetContextDatabase() => GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");

        public async Task<GetGlossariesResponse> GetAllAsync(GetGlossariesRequest request)
        {
            var dataBase = GetContextDatabase();
            var collection = dataBase.GetCollection<BlocksGlossary>(_collectionName);

            var filter = BuildGetsFilter(request);

            var sort = BuildGetsSort(request);

            var findTask = collection
                .Find(filter)
                .Sort(sort)
                .Skip(request.PageNumber * request.PageSize)
                .Limit(request.PageSize)
                .ToListAsync();

            var countTask = collection.CountDocumentsAsync(filter);

            await Task.WhenAll(findTask, countTask);

            return new GetGlossariesResponse
            {
                Items = findTask.Result.Select(GlossaryMapper.ToDto).ToList(),
                TotalCount = countTask.Result
            };
        }

        internal static FilterDefinition<BlocksGlossary> BuildGetsFilter(GetGlossariesRequest request)
        {
            var filterBuilder = Builders<BlocksGlossary>.Filter;
            var filters = new List<FilterDefinition<BlocksGlossary>>();

            if (!string.IsNullOrWhiteSpace(request.SearchText))
            {
                // Variants and translation values exist as fields only on structured-saved or migrated documents (A4).
                var pattern = new BsonRegularExpression($".*{Regex.Escape(request.SearchText)}.*", "i");
                filters.Add(filterBuilder.Or(
                    filterBuilder.Regex(g => g.Name, pattern),
                    filterBuilder.Regex("Variants", pattern),
                    filterBuilder.Regex("Translations.Value", pattern)));
            }

            if (request.IsGlobal.HasValue)
            {
                filters.Add(filterBuilder.Eq(g => g.IsGlobal, request.IsGlobal.Value));
            }

            if (!string.IsNullOrWhiteSpace(request.ModuleId))
            {
                filters.Add(filterBuilder.AnyEq(g => g.ModuleIds, request.ModuleId));
            }

            var structured = filterBuilder.Gte(g => g.SchemaVersion, 2);
            var isTranslateRule = filterBuilder.Or(filterBuilder.Eq(g => g.Rule, GlossaryRule.Translate), filterBuilder.Eq(g => g.Rule, null));

            if (GlossaryWireValues.TryParseRule(request.Rule, out var rule))
            {
                // Rule and MissingTranslation can only be queried on structured documents (A4).
                filters.Add(structured);
                filters.Add(rule == GlossaryRule.Translate ? isTranslateRule : filterBuilder.Eq(g => g.Rule, rule));
            }

            if (GlossaryWireValues.TryParseStatus(request.Status, out var status))
            {
                // Legacy documents have no Status and resolve to Approved.
                filters.Add(status == GlossaryStatus.Approved
                    ? filterBuilder.Or(filterBuilder.Eq(g => g.Status, GlossaryStatus.Approved), filterBuilder.Eq(g => g.Status, null))
                    : filterBuilder.Eq(g => g.Status, status));
            }

            if (!string.IsNullOrWhiteSpace(request.MissingTranslation))
            {
                var culture = request.MissingTranslation;
                filters.Add(structured);
                filters.Add(isTranslateRule);
                filters.Add(filterBuilder.Not(filterBuilder.ElemMatch(g => g.Translations,
                    Builders<GlossaryTranslation>.Filter.And(
                        Builders<GlossaryTranslation>.Filter.Eq(t => t.Language, culture),
                        Builders<GlossaryTranslation>.Filter.Ne(t => t.Value, ""),
                        Builders<GlossaryTranslation>.Filter.Ne(t => t.Value, null)))));
            }

            if (!string.IsNullOrWhiteSpace(request.Language))
            {
                filters.Add(filterBuilder.Eq(g => g.Language, request.Language.Trim()));
            }

            if (!string.IsNullOrWhiteSpace(request.Type))
            {
                // Exact match ignoring case; the value is escaped, so it is never a pattern.
                filters.Add(filterBuilder.Regex(g => g.Type, new BsonRegularExpression($"^{Regex.Escape(request.Type.Trim())}$", "i")));
            }

            switch (request.Scope?.Trim().ToLowerInvariant())
            {
                case "project":
                    filters.Add(filterBuilder.Eq(g => g.IsGlobal, true));
                    break;
                case "modules":
                    // "ModuleIds.0" exists only when the array has at least one entry.
                    filters.Add(filterBuilder.Ne(g => g.IsGlobal, true));
                    filters.Add(filterBuilder.Exists("ModuleIds.0", true));
                    break;
            }

            return filters.Count > 0 ? filterBuilder.And(filters) : filterBuilder.Empty;
        }

        /// <summary>
        /// CreateDate descending by default. ItemId always breaks ties (in the same direction) so paging never
        /// repeats or skips a glossary. Name sorts on NormalizedName: documents without it (not saved or
        /// migrated since Phase 6) sort first ascending and last descending, and are never dropped.
        /// </summary>
        public static SortDefinition<BlocksGlossary> BuildGetsSort(GetGlossariesRequest request)
        {
            var sortBuilder = Builders<BlocksGlossary>.Sort;
            var (field, defaultDescending) = request.SortBy?.Trim().ToLowerInvariant() switch
            {
                "name" => (nameof(BlocksGlossary.NormalizedName), false),
                "lastupdatedate" => (nameof(BlocksGlossary.LastUpdateDate), true),
                _ => (nameof(BlocksGlossary.CreateDate), true)
            };
            var descending = request.SortDescending ?? defaultDescending;

            return descending
                ? sortBuilder.Descending(field).Descending(g => g.ItemId)
                : sortBuilder.Ascending(field).Ascending(g => g.ItemId);
        }

        public async Task<Glossary> GetByIdAsync(string itemId)
        {
            var stored = await GetStoredByIdAsync(itemId);
            return stored == null ? null! : GlossaryMapper.ToDto(stored);
        }

        public async Task<BlocksGlossary?> GetStoredByIdAsync(string itemId)
        {
            var dataBase = GetContextDatabase();
            var collection = dataBase.GetCollection<BlocksGlossary>(_collectionName);
            var filter = Builders<BlocksGlossary>.Filter.Eq(g => g.ItemId, itemId);

            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task<List<Glossary>> GetByNameInsensitiveAsync(string name)
        {
            var normalized = Glossary.NormalizeName(name);
            if (normalized.Length == 0)
                return new List<Glossary>();

            var dataBase = GetContextDatabase();
            var collection = dataBase.GetCollection<BlocksGlossary>(_collectionName);
            var filterBuilder = Builders<BlocksGlossary>.Filter;
            var normalizedName = GlossaryMapper.NormalizedName(name);

            // Documents saved since Phase 6 compare by NormalizedName equality. Older ones (no NormalizedName)
            // fall back to the case-insensitive regex, which also matches names stored decomposed (NFD) or with
            // surrounding spaces.
            var decomposed = normalized.Normalize(NormalizationForm.FormD);
            var pattern = $@"^\s*(?:{Regex.Escape(normalized)}|{Regex.Escape(decomposed)})\s*$";
            var filter = filterBuilder.Or(
                filterBuilder.Eq(g => g.NormalizedName, normalizedName),
                filterBuilder.And(
                    filterBuilder.Eq(g => g.NormalizedName, null),
                    filterBuilder.Regex(g => g.Name, new BsonRegularExpression(pattern, "i"))));

            var candidates = await collection.Find(filter).ToListAsync();

            // Mongo's "i" folds case but does not normalize Unicode, so confirm each legacy candidate here.
            return candidates
                .Where(g => g.NormalizedName != null
                    ? string.Equals(g.NormalizedName, normalizedName, StringComparison.Ordinal)
                    : string.Equals(Glossary.NormalizeName(g.Name), normalized, StringComparison.OrdinalIgnoreCase))
                .Select(GlossaryMapper.ToDto)
                .ToList();
        }

        public async Task<List<Glossary>> GetByIdsAsync(List<string> ids)
        {
            if (ids == null || ids.Count == 0)
                return new List<Glossary>();

            return (await GetStoredByIdsAsync(ids)).Select(GlossaryMapper.ToDto).ToList();
        }

        public async Task<List<BlocksGlossary>> GetStoredByIdsAsync(IEnumerable<string> ids)
        {
            var idList = ids?.Where(id => !string.IsNullOrEmpty(id)).Distinct(StringComparer.Ordinal).ToList() ?? new List<string>();
            if (idList.Count == 0)
                return new List<BlocksGlossary>();

            var dataBase = GetContextDatabase();
            var collection = dataBase.GetCollection<BlocksGlossary>(_collectionName);
            var filter = Builders<BlocksGlossary>.Filter.In(g => g.ItemId, idList);

            return await collection.Find(filter).ToListAsync();
        }

        public async Task<List<BlocksGlossary>> GetAllEntitiesAsync(string tenantId)
        {
            var dataBase = GetDatabase(tenantId);
            var collection = dataBase.GetCollection<BlocksGlossary>(_collectionName);

            return await collection.Find(Builders<BlocksGlossary>.Filter.Empty).ToListAsync();
        }

        public async Task<long> ReplaceManyAsync(IReadOnlyList<(BlocksGlossary Glossary, int ExpectedVersion)> glossaries)
        {
            if (glossaries.Count == 0) return 0;

            var dataBase = GetContextDatabase();
            var collection = dataBase.GetCollection<BlocksGlossary>(_collectionName);
            var filterBuilder = Builders<BlocksGlossary>.Filter;

            // Each replace only matches the version that was read, so a concurrent edit is never overwritten.
            var models = glossaries.Select(item =>
            {
                var versionFilter = filterBuilder.Eq(g => g.Version, item.ExpectedVersion);
                if (item.ExpectedVersion == 0)
                    versionFilter = filterBuilder.Or(versionFilter, filterBuilder.Exists(g => g.Version, false));
                return (WriteModel<BlocksGlossary>)new ReplaceOneModel<BlocksGlossary>(
                    filterBuilder.And(filterBuilder.Eq(g => g.ItemId, item.Glossary.ItemId), versionFilter),
                    item.Glossary)
                { IsUpsert = false };
            }).ToList();

            var result = await collection.BulkWriteAsync(models, new BulkWriteOptions { IsOrdered = false });
            return result.ModifiedCount;
        }

        public async Task CreateNormalizedNameUniqueIndexAsync()
        {
            var dataBase = GetContextDatabase();
            var collection = dataBase.GetCollection<BlocksGlossary>(_collectionName);

            await collection.Indexes.CreateOneAsync(new CreateIndexModel<BlocksGlossary>(
                Builders<BlocksGlossary>.IndexKeys.Ascending(g => g.NormalizedName),
                new CreateIndexOptions { Name = NormalizedNameIndexName, Unique = true }));
        }

        public async Task InsertAsync(BlocksGlossary glossary)
        {
            var dataBase = GetContextDatabase();
            var collection = dataBase.GetCollection<BlocksGlossary>(_collectionName);

            await collection.InsertOneAsync(glossary);
        }

        public async Task<bool> ReplaceAsync(BlocksGlossary glossary, int? expectedVersion)
        {
            var dataBase = GetContextDatabase();
            var collection = dataBase.GetCollection<BlocksGlossary>(_collectionName);

            var filterBuilder = Builders<BlocksGlossary>.Filter;
            var filter = filterBuilder.Eq(g => g.ItemId, glossary.ItemId);

            if (expectedVersion.HasValue)
            {
                var versionFilter = filterBuilder.Eq(g => g.Version, expectedVersion.Value);
                if (expectedVersion.Value == 0)
                {
                    // Documents saved before versioning have no Version field and read as 0.
                    versionFilter = filterBuilder.Or(versionFilter, filterBuilder.Exists(g => g.Version, false));
                }
                filter = filterBuilder.And(filter, versionFilter);
            }

            // Never upsert an update: a version mismatch would otherwise try to insert a second
            // document with the same _id and fail with a duplicate-key error.
            var result = await collection.ReplaceOneAsync(
                filter,
                glossary,
                new ReplaceOptions { IsUpsert = false }
            );

            return result.MatchedCount > 0;
        }

        public Task AddModuleAsync(string glossaryId, string moduleId) =>
            UpdateModulesAsync(glossaryId, Builders<BlocksGlossary>.Update.AddToSet(g => g.ModuleIds, moduleId));

        public Task RemoveModuleAsync(string glossaryId, string moduleId) =>
            UpdateModulesAsync(glossaryId, Builders<BlocksGlossary>.Update.Pull(g => g.ModuleIds, moduleId));

        /// <summary>Changes only ModuleIds, Version and the LastUpdate* fields, leaving the rest of the document as stored.</summary>
        private async Task UpdateModulesAsync(string glossaryId, UpdateDefinition<BlocksGlossary> moduleUpdate)
        {
            var dataBase = GetContextDatabase();
            var collection = dataBase.GetCollection<BlocksGlossary>(_collectionName);

            var filter = Builders<BlocksGlossary>.Filter.Eq(g => g.ItemId, glossaryId);
            var update = Builders<BlocksGlossary>.Update.Combine(
                moduleUpdate,
                Builders<BlocksGlossary>.Update.Inc(g => g.Version, 1),
                Builders<BlocksGlossary>.Update.Set(g => g.LastUpdateDate, DateTime.UtcNow),
                Builders<BlocksGlossary>.Update.Set(g => g.LastUpdatedBy, BlocksContext.GetContext()?.UserId));

            await collection.UpdateOneAsync(filter, update);
        }

        public async Task<long> UpdateModuleTagsAsync(string moduleId, IReadOnlyCollection<string> addTo, IReadOnlyCollection<string> removeFrom)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(moduleId);
            var models = new List<WriteModel<BlocksGlossary>>();
            var now = DateTime.UtcNow;
            var userId = BlocksContext.GetContext()?.UserId;

            WriteModel<BlocksGlossary> Model(string glossaryId, UpdateDefinition<BlocksGlossary> moduleUpdate) =>
                new UpdateOneModel<BlocksGlossary>(
                    Builders<BlocksGlossary>.Filter.Eq(g => g.ItemId, glossaryId),
                    Builders<BlocksGlossary>.Update.Combine(
                        moduleUpdate,
                        Builders<BlocksGlossary>.Update.Inc(g => g.Version, 1),
                        Builders<BlocksGlossary>.Update.Set(g => g.LastUpdateDate, now),
                        Builders<BlocksGlossary>.Update.Set(g => g.LastUpdatedBy, userId)))
                { IsUpsert = false };

            foreach (var id in removeFrom.Where(id => !string.IsNullOrEmpty(id)).Distinct(StringComparer.Ordinal))
                models.Add(Model(id, Builders<BlocksGlossary>.Update.Pull(g => g.ModuleIds, moduleId)));
            foreach (var id in addTo.Where(id => !string.IsNullOrEmpty(id)).Distinct(StringComparer.Ordinal))
                models.Add(Model(id, Builders<BlocksGlossary>.Update.AddToSet(g => g.ModuleIds, moduleId)));

            if (models.Count == 0) return 0;

            var dataBase = GetContextDatabase();
            var collection = dataBase.GetCollection<BlocksGlossary>(_collectionName);
            var result = await collection.BulkWriteAsync(models, new BulkWriteOptions { IsOrdered = false });
            return result.ModifiedCount;
        }

        public async Task<List<Glossary>> GetGlobalAsync(string projectKey)
        {
            var dataBase = GetDatabase(projectKey);
            var collection = dataBase.GetCollection<BlocksGlossary>(_collectionName);
            var filter = Builders<BlocksGlossary>.Filter.Eq(g => g.IsGlobal, true);

            return (await collection.Find(filter).ToListAsync()).Select(GlossaryMapper.ToDto).ToList();
        }

        public async Task<List<Glossary>> GetByModuleIdAsync(string projectKey, string moduleId)
        {
            var dataBase = GetDatabase(projectKey);
            var collection = dataBase.GetCollection<BlocksGlossary>(_collectionName);
            var filter = Builders<BlocksGlossary>.Filter.AnyEq(g => g.ModuleIds, moduleId);

            return (await collection.Find(filter).ToListAsync()).Select(GlossaryMapper.ToDto).ToList();
        }

        public async Task DeleteAsync(string itemId)
        {
            var dataBase = GetContextDatabase();
            var collection = dataBase.GetCollection<BlocksGlossary>(_collectionName);
            var filter = Builders<BlocksGlossary>.Filter.Eq(g => g.ItemId, itemId);

            await collection.DeleteOneAsync(filter);
        }
    }
}
