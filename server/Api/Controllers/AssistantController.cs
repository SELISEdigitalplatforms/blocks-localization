
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
            // content stays a string; appliedTerms and glossaryViolations are siblings (empty with the flag off).
            return StatusCode((int)HttpStatusCode.OK, new
            {
                Content = response?.Content,
                AppliedTerms = response?.AppliedTerms ?? new List<AppliedTerm>(),
                GlossaryViolations = response?.GlossaryViolations ?? new List<GlossaryViolationDto>()
            });
        }
    }
}
