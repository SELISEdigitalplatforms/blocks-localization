using Blocks.Genesis;
using Eurolm.DomainService.Services;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Eurolm.DomainService.Repositories
{
    public class GlossaryRepository : IGlossaryRepository
    {
        private readonly IDbContextProvider _dbContextProvider;
        private const string _collectionName = "BlocksGlossaries";

        public GlossaryRepository(IDbContextProvider dbContextProvider)
        {
            _dbContextProvider = dbContextProvider;
        }

        public async Task<GetGlossariesResponse> GetAllAsync(GetGlossariesRequest request)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<Glossary>(_collectionName);

            var filterBuilder = Builders<Glossary>.Filter;
            var filter = filterBuilder.Empty;

            if (!string.IsNullOrWhiteSpace(request.SearchText))
            {
                var nameFilter = filterBuilder.Regex(g => g.Name,
                    new BsonRegularExpression($".*{request.SearchText}.*", "i"));
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

            var sort = Builders<Glossary>.Sort.Descending(g => g.CreateDate);

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
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<Glossary>(_collectionName);
            var filter = Builders<Glossary>.Filter.Eq(g => g.ItemId, itemId);

            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task<List<Glossary>> GetByIdsAsync(List<string> ids)
        {
            if (ids == null || ids.Count == 0)
                return new List<Glossary>();

            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<Glossary>(_collectionName);
            var filter = Builders<Glossary>.Filter.In(g => g.ItemId, ids);

            return await collection.Find(filter).ToListAsync();
        }

        public async Task SaveAsync(BlocksGlossary glossary)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksGlossary>(_collectionName);

            var filter = Builders<BlocksGlossary>.Filter.Eq(g => g.ItemId, glossary.ItemId);

            await collection.ReplaceOneAsync(
                filter,
                glossary,
                new ReplaceOptions { IsUpsert = true }
            );
        }

        public async Task<List<Glossary>> GetGlobalAsync(string projectKey)
        {
            var dataBase = _dbContextProvider.GetDatabase(projectKey);
            var collection = dataBase.GetCollection<Glossary>(_collectionName);
            var filter = Builders<Glossary>.Filter.Eq(g => g.IsGlobal, true);

            return await collection.Find(filter).ToListAsync();
        }

        public async Task<List<Glossary>> GetByModuleIdAsync(string projectKey, string moduleId)
        {
            var dataBase = _dbContextProvider.GetDatabase(projectKey);
            var collection = dataBase.GetCollection<Glossary>(_collectionName);
            var filter = Builders<Glossary>.Filter.AnyEq(g => g.ModuleIds, moduleId);

            return await collection.Find(filter).ToListAsync();
        }

        public async Task DeleteAsync(string itemId)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksGlossary>(_collectionName);
            var filter = Builders<BlocksGlossary>.Filter.Eq(g => g.ItemId, itemId);

            await collection.DeleteOneAsync(filter);
        }
    }
}
