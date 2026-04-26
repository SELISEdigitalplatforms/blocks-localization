using Eurolm.DomainService.Shared;
using Eurolm.DomainService.Shared.Entities;

namespace Eurolm.DomainService.Services.HelperService
{
    public interface IWebHookService
    {
        Task<bool> CallWebhook(object payload);
        Task<ApiResponse> SaveWebhookAsync(BlocksWebhook webhook);
    }
}