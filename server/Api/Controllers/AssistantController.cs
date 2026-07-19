
using Blocks.Genesis;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Utilities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net;

namespace BlocksTemplate.Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]
    public class AssistantController : ControllerBase
    {
        private readonly IAssistantService _assistantService;

        public AssistantController(IAssistantService assistantService)
        {
            _assistantService = assistantService;
        }
        
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::assistant::getTranslationsuggestion")]
        public async Task<IActionResult> GetTranslationSuggestion([FromBody] SuggestLanguageRequest request)
        {
            var response = await _assistantService.SuggestTranslation(request);
            return StatusCode((int)HttpStatusCode.OK, new
            {
                Content = response
            });
        }
    }
}
