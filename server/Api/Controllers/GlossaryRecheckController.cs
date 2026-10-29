using Blocks.Genesis;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Utilities;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers
{
    [ApiController]
    [Route("Glossary/[action]")]

    public class GlossaryRecheckController : ControllerBase
    {
        private readonly IGlossaryRecheckService? _recheckService;

        public GlossaryRecheckController(IGlossaryRecheckService? recheckService = null)
        {
            _recheckService = recheckService;
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
    }
}
