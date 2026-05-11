using Blocks.Genesis;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]

    public class GlossaryController : ControllerBase
    {
        private readonly IGlossaryManagementService _glossaryManagementService;
        private readonly ChangeControllerContext _changeControllerContext;
        private readonly IKeyManagementService _keyManagementService;

        public GlossaryController(
            IGlossaryManagementService glossaryManagementService,
            ChangeControllerContext changeControllerContext,
            IKeyManagementService keyManagementService)
        {
            _glossaryManagementService = glossaryManagementService;
            _changeControllerContext = changeControllerContext;
            _keyManagementService = keyManagementService;
        }

        [HttpPost]
        [Authorize]
        public async Task<ApiResponse> Save(Glossary glossary)
        {
            if (glossary == null) BadRequest(new BaseMutationResponse());
            _changeControllerContext.ChangeContext(glossary);
            return await _glossaryManagementService.SaveGlossaryAsync(glossary);
        }

        [HttpGet]
        [Authorize]
        public async Task<GetGlossariesResponse> Gets([FromQuery] GetGlossariesRequest request)
        {
            if (request == null)  BadRequest(new BaseMutationResponse());
            _changeControllerContext.ChangeContext(request);
            return await _glossaryManagementService.GetGlossariesAsync(request);
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> Get([FromQuery] string itemId, [FromQuery] string projectKey)
        {
            if (string.IsNullOrWhiteSpace(itemId))
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string> { { "ItemId", "Invalid or missing ItemId" } }
                });

            _changeControllerContext.ChangeContext(new GetGlossariesRequest { ProjectKey = projectKey });

            var glossary = await _glossaryManagementService.GetGlossaryByIdAsync(itemId);

            if (glossary == null)
                return NotFound(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string> { { "ItemId", "Glossary not found" } }
                });

            return Ok(glossary);
        }

        [HttpGet]
        [ProtectedEndPoint]
        public async Task<GetSuggestedGlossariesResponse> GetSuggestedGlossaries([FromQuery] GetSuggestedGlossariesRequest request)
        {
            if (request == null) BadRequest(new BaseMutationResponse());
            _changeControllerContext.ChangeContext(request);
            return await _keyManagementService.GetSuggestedGlossariesAsync(request);
        }

        [HttpDelete]
        [Authorize]
        public async Task<IActionResult> Delete([FromQuery] DeleteGlossaryRequest request)
        {
            if (request == null) return BadRequest(new BaseMutationResponse());
            _changeControllerContext.ChangeContext(request);

            if (string.IsNullOrWhiteSpace(request.ItemId))
            {
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "ItemId", "Invalid or missing ItemId" }
                    }
                });
            }

            var result = await _glossaryManagementService.DeleteGlossaryAsync(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }
    }
}
