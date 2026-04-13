using BlocksTemplate.DomainService.Shared.Entities;

namespace BlocksTemplate.DomainService.Repositories
{
    public interface IBlocksWebhookRepository
    {
        Task<BlocksWebhook> GetAsync();
        Task SaveAsync(BlocksWebhook webhook);
    }
}