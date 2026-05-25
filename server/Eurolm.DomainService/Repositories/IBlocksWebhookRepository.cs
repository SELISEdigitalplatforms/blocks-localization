using Eurolm.DomainService.Shared.Entities;

namespace Eurolm.DomainService.Repositories
{
    public interface IBlocksWebhookRepository
    {
        Task<BlocksWebhook> GetAsync();
        Task SaveAsync(BlocksWebhook webhook);
    }
}