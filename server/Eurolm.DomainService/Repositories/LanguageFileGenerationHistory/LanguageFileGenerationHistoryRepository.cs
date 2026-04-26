using Blocks.Genesis;
using Eurolm.DomainService.Services;
using MongoDB.Driver;

namespace Eurolm.DomainService.Repositories
{
    public class LanguageFileGenerationHistoryRepository : ILanguageFileGenerationHistoryRepository
    {
        private readonly IDbContextProvider _dbContextProvider;
        private const string _collectionName = "LanguageFileGenerationHistory";

        public LanguageFileGenerationHistoryRepository(IDbContextProvider dbContextProvider)
        {
            _dbContextProvider = dbContextProvider;
        }

        public async Task SaveAsync(LanguageFileGenerationHistory history)
        {
            var dataBase = _dbContextProvider.GetDatabase(history.ProjectKey);
            var collection = dataBase.GetCollection<LanguageFileGenerationHistory>(_collectionName);
            await collection.InsertOneAsync(history);
        }

        public async Task<LanguageFileGenerationHistory?> GetLatestLanguageFileGenerationHistory(string projectKey)
        {
            var dataBase = _dbContextProvider.GetDatabase(projectKey);
            var collection = dataBase.GetCollection<LanguageFileGenerationHistory>(_collectionName);

            var filter = Builders<LanguageFileGenerationHistory>.Filter.Empty;
            var sort = Builders<LanguageFileGenerationHistory>.Sort.Descending(h => h.CreateDate);

            return await collection.Find(filter).Sort(sort).FirstOrDefaultAsync();
        }

        public async Task<GetLanguageFileGenerationHistoryResponse> GetPaginatedAsync(GetLanguageFileGenerationHistoryRequest request)
        {
            var dataBase = _dbContextProvider.GetDatabase(request.ProjectKey);
            var collection = dataBase.GetCollection<LanguageFileGenerationHistory>(_collectionName);

            var filter = Builders<LanguageFileGenerationHistory>.Filter.Empty;
            var sort = Builders<LanguageFileGenerationHistory>.Sort.Descending(h => h.CreateDate);

            var findTask = collection
                .Find(filter)
                .Sort(sort)
                .Skip(request.PageNumber * request.PageSize)
                .Limit(request.PageSize)
                .ToListAsync();

            var countTask = collection.CountDocumentsAsync(filter);

            await Task.WhenAll(findTask, countTask);

            return new GetLanguageFileGenerationHistoryResponse
            {
                TotalCount = countTask.Result,
                Items = findTask.Result
            };
        }
    }
}
