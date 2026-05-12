using Blocks.Genesis;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared;
using Eurolm.DomainService.Shared.Entities;
using Microsoft.AspNetCore.Mvc;

namespace BlocksTemplate.Api.Controllers
{
    /// <summary>
    /// Handles operations related to language configuration settings.
    /// </summary>
    
    [ApiController]
    [Route("[controller]/[action]")]
    public class ConfigController : ControllerBase
    {
        private readonly ChangeControllerContext _changeControllerContext;
        private readonly IWebHookService _webHookService;

        public ConfigController(
            ChangeControllerContext changeControllerContext,
            IWebHookService webHookService)
        {
            _changeControllerContext = changeControllerContext;
            _webHookService = webHookService;
        }

        [HttpGet]
        public async Task<BlocksWebhook?> GetWebHook([FromQuery] GetWebhookRequest request)
        {
            if (request == null) return null;
            _changeControllerContext.ChangeContext(request);
            return await _webHookService.GetWebhookAsync();
        }

        [HttpPost]
        [ProtectedEndPoint]
        //[ApiExplorerSettings(IgnoreApi = true)]
        public async Task<ApiResponse> SaveWebHook([FromBody] BlocksWebhook webhook)
        {
            if (webhook == null) BadRequest(new BaseMutationResponse());
            _changeControllerContext.ChangeContext(webhook);
            return await _webHookService.SaveWebhookAsync(webhook);
        }
    }
}