using Blocks.Genesis;
using BlocksTemplate.DomainService.Services.HelperService;
using BlocksTemplate.DomainService.Shared;
using BlocksTemplate.DomainService.Shared.Entities;
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