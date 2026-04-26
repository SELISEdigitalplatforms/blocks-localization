using Blocks.Genesis;
using Eurolm.DomainService.Services;
using MongoDB.Driver;

namespace Eurolm.DomainService.Repositories
{
    public class LanguageRepository : ILanguageRepository
    {
        private readonly IDbContextProvider _dbContextProvider;
        private const string _collectionName = "BlocksLanguages";

        public LanguageRepository(IDbContextProvider dbContextProvider)
        {
            _dbContextProvider = dbContextProvider;
        }

        public async Task<List<Language>> GetAllLanguagesAsync()
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<Language>(_collectionName);

            return await collection.Find(_ => true).ToListAsync();
        }

        public async Task<BlocksLanguage> GetLanguageByNameAsync(string languageName)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguage>(_collectionName);

            var filter = Builders<BlocksLanguage>.Filter.Eq(mc => mc.LanguageName, languageName);

            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task DeleteAsync(string languageName)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguage>(_collectionName);
            var filter = Builders<BlocksLanguage>.Filter.Eq(lk => lk.LanguageName, languageName);

            await collection.DeleteOneAsync(filter);
        }

        public async Task SaveAsync(BlocksLanguage language)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguage>(_collectionName);

            var filter = Builders<BlocksLanguage>.Filter.And(
                          Builders<BlocksLanguage>.Filter.Eq(mc => mc.LanguageName, language.LanguageName),
                          Builders<BlocksLanguage>.Filter.Eq(mc => mc.LanguageCode, language.LanguageCode));

            await collection.ReplaceOneAsync(
                filter,
                language,
                new ReplaceOptions { IsUpsert = true }
            );
        }
        public async Task RemoveDefault(BlocksLanguage language)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksLanguage>(_collectionName);

            var filter = Builders<BlocksLanguage>.Filter.And(
                          Builders<BlocksLanguage>.Filter.Ne(mc => mc.LanguageName, language.LanguageName),
                          Builders<BlocksLanguage>.Filter.Ne(mc => mc.LanguageCode, language.LanguageCode));

            var update = Builders<BlocksLanguage>.Update.Set(x => x.IsDefault, false);

            await collection.UpdateManyAsync(filter, update);
        }
    }
}
