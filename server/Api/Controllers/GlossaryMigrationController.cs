using Blocks.Genesis;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Utilities;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers
{
    [ApiController]
    [Route("Glossary/[action]")]

    public class GlossaryMigrationController : ControllerBase
    {
        private readonly IGlossaryMigrationService _glossaryMigrationService;

        public GlossaryMigrationController(IGlossaryMigrationService glossaryMigrationService)
        {
            _glossaryMigrationService = glossaryMigrationService;
        }

        [HttpPost]
        [ProtectedEndPoint($"{Constants.ServiceName}::glossary::migrate")]
        public async Task<IActionResult> Migrate([FromQuery] bool dryRun = true)
        {
            return Ok(await _glossaryMigrationService.MigrateAsync(dryRun));
        }
    }
}
