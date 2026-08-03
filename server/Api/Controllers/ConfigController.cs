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
        [Authorize]
        public async Task<BlocksWebhook?> GetWebHookForCurrentTenant()
        {
            return await _webHookService.GetWebhookAsync();
        }

        /// <summary>
        /// Retrieves the webhook configuration for the current tenant.
        /// </summary>
        /// <remarks>"Cloud" was an unclear alias for the current tenant. Use GetWebHookForCurrentTenant.</remarks>
        [HttpGet]
        [Authorize]
        [ApiExplorerSettings(IgnoreApi = true)]
        [Obsolete("Renamed to GetWebHookForCurrentTenant.")]
        public async Task<BlocksWebhook?> GetCloudWebHook()
        {
            return await GetWebHookForCurrentTenant();
        }
        [HttpGet]
        [Authorize]
        [ApiExplorerSettings(IgnoreApi = true)]
        public async Task<ActionResult<BlocksWebhook?>> GetWebHook([FromQuery] string projectKey)
        {
            if(string.IsNullOrEmpty(projectKey))
            {
                return BadRequest(new
                {
                    ErrorMessage = "Project key is required."
                });
            }
            return Ok(await _webHookService.GetWebhookAsync(projectKey));
        }
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::config::savewebhook")]
        public async Task<ApiResponse> SaveWebHook([FromBody] BlocksWebhook webhook)
        {
            if (webhook == null) return new ApiResponse("Webhook cannot be null.");
            return await _webHookService.SaveWebhookAsync(webhook);
        }
    }
}