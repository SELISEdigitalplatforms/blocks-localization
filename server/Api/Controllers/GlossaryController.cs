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
        private readonly IGlossaryMigrationService _glossaryMigrationService;
        private readonly IGlossaryTerminologyService _terminologyService;
        private readonly IGlossaryRecheckService? _recheckService;

        public GlossaryController(
            IGlossaryManagementService glossaryManagementService,
            IKeyManagementService keyManagementService,
            IGlossaryMigrationService glossaryMigrationService,
            IGlossaryTerminologyService terminologyService,
            IGlossaryRecheckService? recheckService = null)
        {
            _glossaryManagementService = glossaryManagementService;
            _keyManagementService = keyManagementService;
            _glossaryMigrationService = glossaryMigrationService;
            _terminologyService = terminologyService;
            _recheckService = recheckService;
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
                    Errors = new Dictionary<string, string> { { "ItemId", "Invalid or missing ItemId" } }
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
                    Errors = new Dictionary<string, string> { { "ItemId", "Glossary not found" } }
                });

            return Ok(usage);
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

        /// <summary>
        /// Moves the tenant's Track A terminology into the structured fields. Idempotent; dryRun (the default)
        /// writes nothing. Run with dryRun=false only after the Phase 7 frontend is deployed.
        /// </summary>
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::glossary::migrate")]
        public async Task<IActionResult> Migrate([FromQuery] bool dryRun = true)
        {
            return Ok(await _glossaryMigrationService.MigrateAsync(dryRun));
        }

        /// <summary>
        /// Queues a background re-check of stored key violations for the glossary's keys (no itemId = every key).
        /// queued is false when the server flag is off or a re-check for the tenant is already queued (coalesced).
        /// </summary>
        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::glossary::recheck")]
        public async Task<IActionResult> Recheck([FromQuery] string? itemId)
        {
            var queued = _recheckService != null && await _recheckService.QueueAsync(itemId);
            return Ok(new RecheckGlossaryResponse { Queued = queued });
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
