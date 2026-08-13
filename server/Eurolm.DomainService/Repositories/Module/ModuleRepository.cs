using Blocks.Genesis;
using Eurolm.DomainService.Services;
using MongoDB.Bson;
using MongoDB.Driver;
using Polly;
using System.Text.RegularExpressions;



namespace Eurolm.DomainService.Repositories
{
    public class ModuleRepository : IModuleRepository
    {
        private readonly IDbContextProvider _dbContextProvider;
        private const string _collectionName = "BlocksLanguageModules";

        public ModuleRepository(IDbContextProvider dbContextProvider)
        {
            _dbContextProvider = dbContextProvider;
        }

        public async Task<BlocksLanguageModule> GetByNameAsync(string name)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId?? "");
            var collection = dataBase.GetCollection<BlocksLanguageModule>(_collectionName);

            var filter = Builders<BlocksLanguageModule>.Filter.Eq(mc => mc.ModuleName, name);
            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task<BlocksLanguageModule> GetByIdAsync(string id)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId?? "");
            var collection = dataBase.GetCollection<BlocksLanguageModule>(_collectionName);

            var filter = Builders<BlocksLanguageModule>.Filter.Eq(mc => mc.ItemId, id);
            return await collection.Find(filter).FirstOrDefaultAsync();
        }
        public async Task<BlocksLanguageModule> GetByIdAsync(string projectKey,string id)
        {
            var dataBase = _dbContextProvider.GetDatabase(projectKey);
            var collection = dataBase.GetCollection<BlocksLanguageModule>(_collectionName);

            var filter = Builders<BlocksLanguageModule>.Filter.Eq(mc => mc.ItemId, id);
            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task<List<BlocksLanguageModule>> GetAllAsync()
        {
            var collection = _dbContextProvider.GetCollection<BlocksLanguageModule>(_collectionName);
            return await collection.Find(_ => true).ToListAsync();
        }

        public async Task<GetModulesResponse> GetAllAsync(GetModulesRequest request)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageModule>(_collectionName);

            var filter = GetModulesFilter(request);

            var sort = !string.IsNullOrWhiteSpace(request.SortProperty) && request.IsDescending
                ? Builders<BlocksLanguageModule>.Sort.Descending(request.SortProperty)
                : Builders<BlocksLanguageModule>.Sort.Ascending(request.SortProperty ?? "ModuleName");

            var findModulesTask = collection
                .Find(filter)
                .Sort(sort)
                .Skip(request.PageNumber * request.PageSize)
                .Limit(request.PageSize)
                .ToListAsync();

            var countDocumentsTask = collection.CountDocumentsAsync(filter);

            await Task.WhenAll(findModulesTask, countDocumentsTask);

            return new GetModulesResponse
            {
                Items = findModulesTask.Result,
                TotalCount = countDocumentsTask.Result
            };
        }

        private static FilterDefinition<BlocksLanguageModule> GetModulesFilter(GetModulesRequest request)
        {
            var filterBuilder = Builders<BlocksLanguageModule>.Filter;
            var matchFilters = new List<FilterDefinition<BlocksLanguageModule>>();

            if (!string.IsNullOrWhiteSpace(request.SearchText))
            {
                matchFilters.Add(filterBuilder.Regex(m => m.ModuleName,
                    new BsonRegularExpression($".*{Regex.Escape(request.SearchText)}.*", "i")));
            }

            if (request.CreateDateRange != null)
            {
                if (request.CreateDateRange.StartDate.HasValue)
                    matchFilters.Add(filterBuilder.Gte(m => m.CreateDate, request.CreateDateRange.StartDate.Value));
                if (request.CreateDateRange.EndDate.HasValue)
                    matchFilters.Add(filterBuilder.Lte(m => m.CreateDate, request.CreateDateRange.EndDate.Value));
            }

            if (request.LastUpdateDateRange != null)
            {
                if (request.LastUpdateDateRange.StartDate.HasValue)
                    matchFilters.Add(filterBuilder.Gte(m => m.LastUpdateDate, request.LastUpdateDateRange.StartDate.Value));
                if (request.LastUpdateDateRange.EndDate.HasValue)
                    matchFilters.Add(filterBuilder.Lte(m => m.LastUpdateDate, request.LastUpdateDateRange.EndDate.Value));
            }

            return matchFilters.Count > 0 ? filterBuilder.And(matchFilters) : filterBuilder.Empty;
        }

        public async Task SaveAsync(BlocksLanguageModule module)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguageModule>(_collectionName);

            var filter = Builders<BlocksLanguageModule>.Filter.Eq(mc => mc.ItemId, module.ItemId);

            await collection.ReplaceOneAsync(
                filter,
                module,
                new ReplaceOptions { IsUpsert = true }
            );

        }
    }
}
