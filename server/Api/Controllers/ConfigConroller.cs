using Blocks.Genesis;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared;
using Eurolm.DomainService.Shared.Entities;
using Eurolm.DomainService.Utilities;
using Microsoft.AspNetCore.Authorization;
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

        private readonly IWebHookService _webHookService;

        public ConfigController(
            IWebHookService webHookService)
        {
            _webHookService = webHookService;
        }

        [HttpGet]
        public async Task<BlocksWebhook?> GetWebHook()
        {
            return await _webHookService.GetWebhookAsync();
        }

        [HttpPost]
        // [ProtectedEndPoint($"{Constants.ServiceName}::config::savewebhook")]
        [Authorize]
        //[ApiExplorerSettings(IgnoreApi = true)]
        public async Task<ApiResponse> SaveWebHook([FromBody] BlocksWebhook webhook)
        {
            if (webhook == null) BadRequest(new BaseMutationResponse());
            return await _webHookService.SaveWebhookAsync(webhook);
        }
    }
}