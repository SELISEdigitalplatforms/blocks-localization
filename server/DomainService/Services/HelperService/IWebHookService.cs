using BlocksTemplate.DomainService.Shared;
using BlocksTemplate.DomainService.Shared.Entities;

namespace BlocksTemplate.DomainService.Services.HelperService
{
    public interface IWebHookService
    {
        Task<bool> CallWebhook(object payload);
        Task<ApiResponse> SaveWebhookAsync(BlocksWebhook webhook);
    }
}