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
            var collection = dataBase.GetCollection<Glossary>(_collectionName);

            var filterBuilder = Builders<Glossary>.Filter;
            var filter = filterBuilder.Empty;

            if (!string.IsNullOrWhiteSpace(request.SearchText))
            {
                var nameFilter = filterBuilder.Regex(g => g.Name,
                    new BsonRegularExpression($".*{Regex.Escape(request.SearchText)}.*", "i"));
                filter = filterBuilder.And(filter, nameFilter);
            }

            if (request.IsGlobal.HasValue)
            {
                filter = filterBuilder.And(filter, filterBuilder.Eq(g => g.IsGlobal, request.IsGlobal.Value));
            }

            if (!string.IsNullOrWhiteSpace(request.ModuleId))
            {
                filter = filterBuilder.And(filter, filterBuilder.AnyEq(g => g.ModuleIds, request.ModuleId));
            }

            // ItemId breaks CreateDate ties so paging through every glossary never repeats or skips one.
            var sort = Builders<Glossary>.Sort.Descending(g => g.CreateDate).Descending(g => g.ItemId);

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
                Items = findTask.Result,
                TotalCount = countTask.Result
            };
        }

        public async Task<Glossary> GetByIdAsync(string itemId)
        {
            var dataBase = GetContextDatabase();
            var collection = dataBase.GetCollection<Glossary>(_collectionName);
            var filter = Builders<Glossary>.Filter.Eq(g => g.ItemId, itemId);

            return await collection.Find(filter).FirstOrDefaultAsync();
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
            var collection = dataBase.GetCollection<Glossary>(_collectionName);

            // Also match legacy names stored decomposed (NFD) or with surrounding spaces.
            var decomposed = normalized.Normalize(NormalizationForm.FormD);
            var pattern = $@"^\s*(?:{Regex.Escape(normalized)}|{Regex.Escape(decomposed)})\s*$";
            var filter = Builders<Glossary>.Filter.Regex(g => g.Name, new BsonRegularExpression(pattern, "i"));

            var candidates = await collection.Find(filter).ToListAsync();

            // Mongo's "i" folds case but does not normalize Unicode, so confirm each candidate here.
            return candidates
                .Where(g => string.Equals(Glossary.NormalizeName(g.Name), normalized, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        public async Task<List<Glossary>> GetByIdsAsync(List<string> ids)
        {
            if (ids == null || ids.Count == 0)
                return new List<Glossary>();

            var dataBase = GetContextDatabase();
            var collection = dataBase.GetCollection<Glossary>(_collectionName);
            var filter = Builders<Glossary>.Filter.In(g => g.ItemId, ids);

            return await collection.Find(filter).ToListAsync();
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

        public async Task<List<Glossary>> GetGlobalAsync(string projectKey)
        {
            var dataBase = GetDatabase(projectKey);
            var collection = dataBase.GetCollection<Glossary>(_collectionName);
            var filter = Builders<Glossary>.Filter.Eq(g => g.IsGlobal, true);

            return await collection.Find(filter).ToListAsync();
        }

        public async Task<List<Glossary>> GetByModuleIdAsync(string projectKey, string moduleId)
        {
            var dataBase = GetDatabase(projectKey);
            var collection = dataBase.GetCollection<Glossary>(_collectionName);
            var filter = Builders<Glossary>.Filter.AnyEq(g => g.ModuleIds, moduleId);

            return await collection.Find(filter).ToListAsync();
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
