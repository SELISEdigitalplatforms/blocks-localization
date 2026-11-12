
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
        private readonly IModuleManagementService _moduleManagementService;

        public AssistantController(IAssistantService assistantService, IModuleManagementService moduleManagementService)
        {
            _assistantService = assistantService;
            _moduleManagementService = moduleManagementService;
        }
        
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::assistant::getTranslationsuggestion")]
        public async Task<IActionResult> GetTranslationSuggestion([FromBody] SuggestLanguageRequest request)
        {
            await _moduleManagementService.ApplyModuleContextAsync(request);
            var response = await _assistantService.SuggestTranslation(request);
            return StatusCode((int)HttpStatusCode.OK, new
            {
                Content = response?.Content,
                AppliedTerms = response?.AppliedTerms ?? new List<AppliedTerm>(),
                GlossaryViolations = response?.GlossaryViolations ?? new List<GlossaryViolationDto>(),
                MissingGlossaryTranslations = response?.MissingGlossaryTranslations ?? new List<MissingGlossaryTranslation>()
            });
        }
    }
}
