using Blocks.Genesis;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Shared;
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

        public GlossaryController(
            IGlossaryManagementService glossaryManagementService,
            ChangeControllerContext changeControllerContext)
        {
            _glossaryManagementService = glossaryManagementService;
            _changeControllerContext = changeControllerContext;
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
