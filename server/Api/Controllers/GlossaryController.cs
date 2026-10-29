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
        private const string ItemIdField = "ItemId";

        private readonly IGlossaryManagementService _glossaryManagementService;

        public GlossaryController(IGlossaryManagementService glossaryManagementService)
        {
            _glossaryManagementService = glossaryManagementService;
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
                    Errors = new Dictionary<string, string> { { ItemIdField, "Invalid or missing ItemId" } }
                });
            var glossary = await _glossaryManagementService.GetGlossaryByIdAsync(itemId);

            if (glossary == null)
                return NotFound(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string> { { ItemIdField, "Glossary not found" } }
                });

            return Ok(glossary);
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetByIds([FromQuery] List<string>? itemIds)
        {
            var ids = itemIds?.Where(id => !string.IsNullOrWhiteSpace(id)).ToList() ?? new List<string>();
            if (ids.Count == 0 || ids.Count > GlossaryManagementService.MaxGetByIdsCount)
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "ItemIds", $"Provide between 1 and {GlossaryManagementService.MaxGetByIdsCount} item ids." }
                    }
                });

            var items = await _glossaryManagementService.GetGlossariesByIdsAsync(ids);
            return Ok(new GetGlossariesByIdsResponse { Items = items });
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> Usage([FromQuery] GlossaryUsageRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.ItemId))
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string> { { ItemIdField, "Invalid or missing ItemId" } }
                });

            if (request.PageSize < 1 || request.PageSize > GlossaryManagementService.MaxUsagePageSize || request.PageNumber < 0)
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "PageSize", $"PageSize must be between 1 and {GlossaryManagementService.MaxUsagePageSize}, and PageNumber 0 or more." }
                    }
                });

            var usage = await _glossaryManagementService.GetGlossaryUsageAsync(request);
            if (usage == null)
                return NotFound(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string> { { ItemIdField, "Glossary not found" } }
                });

            return Ok(usage);
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
                        { ItemIdField, "Invalid or missing ItemId" }
                    }
                });
            }

            var result = await _glossaryManagementService.DeleteGlossaryAsync(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }
    }
}
