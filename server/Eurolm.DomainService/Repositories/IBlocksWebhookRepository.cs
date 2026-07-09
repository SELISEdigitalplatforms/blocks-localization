using Eurolm.DomainService.Shared.Entities;

namespace Eurolm.DomainService.Repositories
{
    public interface IBlocksWebhookRepository
    {
        Task<BlocksWebhook> GetAsync();
        Task<BlocksWebhook> GetAsync(string projectKey);
        Task SaveAsync(BlocksWebhook webhook);
    }
}