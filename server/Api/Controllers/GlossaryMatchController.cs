using Blocks.Genesis;
using Eurolm.DomainService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers
{
    [ApiController]
    [Route("Glossary/[action]")]

    public class GlossaryMatchController : ControllerBase
    {
        private readonly IGlossaryTerminologyService _terminologyService;

        public GlossaryMatchController(IGlossaryTerminologyService terminologyService)
        {
            _terminologyService = terminologyService;
        }

        /// <summary>
        /// Glossary terms in a source text, with UTF-16 offsets. Draft and Approved terms only; translations
        /// carry only the values active under each term's rule.
        /// </summary>
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Match([FromBody] MatchGlossaryRequest request)
        {
            string? field = null, message = null;
            if (string.IsNullOrEmpty(request?.Text) || request.Text.Length > MatchGlossaryRequest.MaxTextLength)
                (field, message) = ("Text", $"Text must be between 1 and {MatchGlossaryRequest.MaxTextLength} characters.");
            else if (string.IsNullOrWhiteSpace(request.Language))
                (field, message) = ("Language", "Language is required.");
            else if (request.GlossaryIds?.Count > MatchGlossaryRequest.MaxGlossaryIds)
                (field, message) = ("GlossaryIds", $"Provide at most {MatchGlossaryRequest.MaxGlossaryIds} glossary ids.");
            else if (request.Mode != null && request.Mode != "applicable" && request.Mode != "all")
                (field, message) = ("Mode", "Mode must be applicable or all.");

            if (field != null)
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string> { { field, message! } }
                });

            return Ok(await _terminologyService.MatchAsync(request!));
        }
    }
}
