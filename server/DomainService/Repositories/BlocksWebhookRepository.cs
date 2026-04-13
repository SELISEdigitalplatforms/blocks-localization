using Blocks.Genesis;
using BlocksTemplate.DomainService.Shared.Entities;
using MongoDB.Driver;

namespace BlocksTemplate.DomainService.Repositories
{

    public class BlocksWebhookRepository : IBlocksWebhookRepository
    {
        private readonly IDbContextProvider _dbContextProvider;
        private const string _collectionName = "BlocksWebhooks";

        public BlocksWebhookRepository(IDbContextProvider dbContextProvider)
        {
            _dbContextProvider = dbContextProvider;
        }

        public async Task SaveAsync(BlocksWebhook webhook)
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId ?? "");
            var collection = dataBase.GetCollection<BlocksWebhook>(_collectionName);

            var filter = Builders<BlocksWebhook>.Filter.Eq(w => w.ItemId, webhook.ItemId);

            await collection.ReplaceOneAsync(
                filter,
                webhook,
                new ReplaceOptions { IsUpsert = true }
            );
        }

        public async Task<BlocksWebhook> GetAsync()
        {
            var dataBase = _dbContextProvider.GetDatabase(BlocksContext.GetContext()?.TenantId?? "");
            var collection = dataBase.GetCollection<BlocksWebhook>(_collectionName);
            return await collection.Find(_ => true).FirstOrDefaultAsync();
        }
    }
}