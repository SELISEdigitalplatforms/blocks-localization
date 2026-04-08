using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Shared;
using BlocksTemplate.DomainService.Shared.Entities;
using Microsoft.Extensions.Logging;

namespace BlocksTemplate.DomainService.Services.HelperService
{
    public class WebHookService : IWebHookService
    {
        private readonly IBlocksWebhookRepository _blocksWebhookRepository;
        private readonly IHttpHelperServices _httpHelperServices;
        private readonly ILogger<WebHookService> _logger;

        public WebHookService(IBlocksWebhookRepository blocksWebhookRepository, IHttpHelperServices httpHelperServices, ILogger<WebHookService> logger)
        {
            _blocksWebhookRepository = blocksWebhookRepository;
            _httpHelperServices = httpHelperServices;
            _logger = logger;
        }

        public async Task<bool> CallWebhook(object payload)
        {
            var webhook = await _blocksWebhookRepository.GetAsync();
            if (webhook == null || webhook.IsDisabled) return true;

            return await _httpHelperServices.MakeHttpRequestForWebhook(payload, webhook);
        }

        public async Task<ApiResponse> SaveWebhookAsync(BlocksWebhook webhook)
        {
            try
            {
                await _blocksWebhookRepository.SaveAsync(webhook);
            }
            catch (Exception ex)
            {
                _logger.LogError("Error while saving BlocksWebhook {errorMessage} : {StackTrace}", ex.Message, ex.StackTrace);
                return new ApiResponse(ex.Message);
            }

            return new ApiResponse();
        }
    }
}