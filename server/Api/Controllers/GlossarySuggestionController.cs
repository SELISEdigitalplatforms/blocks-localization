using Eurolm.DomainService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers
{
    [ApiController]
    [Route("Glossary/[action]")]

    public class GlossarySuggestionController : ControllerBase
    {
        private readonly IKeyManagementService _keyManagementService;

        public GlossarySuggestionController(IKeyManagementService keyManagementService)
        {
            _keyManagementService = keyManagementService;
        }

        [HttpGet]
        [Authorize]
        public async Task<GetSuggestedGlossariesResponse> GetSuggestedGlossaries([FromQuery] GetSuggestedGlossariesRequest request)
        {
            if (request == null) return new GetSuggestedGlossariesResponse();
            return await _keyManagementService.GetSuggestedGlossariesAsync(request);
        }
    }
}
