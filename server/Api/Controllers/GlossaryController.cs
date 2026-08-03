using Blocks.Genesis;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared;
using Eurolm.DomainService.Utilities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]

    public class GlossaryController : ControllerBase
    {
        private readonly IGlossaryManagementService _glossaryManagementService;
       
        private readonly IKeyManagementService _keyManagementService;

        public GlossaryController(
            IGlossaryManagementService glossaryManagementService,
            IKeyManagementService keyManagementService)
        {
            _glossaryManagementService = glossaryManagementService;
            _keyManagementService = keyManagementService;
        }

        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::glossary::save")]
        public async Task<ApiResponse> Save(Glossary glossary)
        {
            if (glossary == null) return new ApiResponse("Glossary cannot be null.");
            return await _glossaryManagementService.SaveGlossaryAsync(glossary);
        }

        [HttpGet]
        [Authorize]
        public async Task<GetGlossariesResponse> Gets([FromQuery] GetGlossariesRequest request)
        {
            if (request == null) return new GetGlossariesResponse();
            return await _glossaryManagementService.GetGlossariesAsync(request);
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> Get([FromQuery] string itemId)
        {
            if (string.IsNullOrWhiteSpace(itemId))
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string> { { "ItemId", "Invalid or missing ItemId" } }
                });
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
        [Authorize]
        public async Task<GetSuggestedGlossariesResponse> GetSuggestedGlossaries([FromQuery] GetSuggestedGlossariesRequest request)
        {
            if (request == null) return new GetSuggestedGlossariesResponse();
            return await _keyManagementService.GetSuggestedGlossariesAsync(request);
        }

        [HttpDelete]
        [ProtectedEndPoint($"{Constants.ServiceName}::glossary::delete")]
        public async Task<IActionResult> Delete([FromQuery] DeleteGlossaryRequest request)
        {
            if (request == null) return BadRequest(new BaseMutationResponse());

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
