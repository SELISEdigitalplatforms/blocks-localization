using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared;
using Eurolm.DomainService.Utilities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlocksTemplate.Api.Controllers
{
    /// <summary>
    /// Handles operations related to managing modules, such as saving and retrieving module data.
    /// </summary>
    
    [ApiController]
    [Route("[controller]/[action]")]

    public class ModuleController : ControllerBase
    {
        private readonly IModuleManagementService _moduleManagementService;

        /// <summary>
        /// Initializes a new instance of the <see cref="ModuleController"/> class.
        /// </summary>
        /// <param name="moduleManagementService"></param>


        public ModuleController(
            IModuleManagementService moduleManagementService)
        {
            _moduleManagementService = moduleManagementService;
        }


        /// <summary>
        /// Saves a new module or updates an existing one.
        /// </summary>
        /// <param name="module">The module object to be saved.</param>
        /// <returns>An <see cref="ApiResponse"/> indicating the result of the save operation.</returns>

        [HttpPost]
        // [ProtectedEndPoint($"{Constants.ServiceName}::module::save")]
        [Authorize]
        public async Task<ApiResponse> Save([FromBody] SaveModuleRequest module)
        {
            if (module == null) BadRequest(new BaseMutationResponse());
            return await _moduleManagementService.SaveModuleAsync(module);
        }


        /// <summary>
        /// Retrieves a list of all available modules.
        /// </summary>
        /// <returns>A list of <see cref="Module"/> objects.</returns>

        [HttpGet]
        [Authorize]
        public async Task<List<BlocksLanguageModule>> GetCloudsModulesAsync()
        {
            return await _moduleManagementService.GetModulesAsync();
        }
        [HttpGet]
        [ApiExplorerSettings(IgnoreApi = true)]
        public async Task<List<BlocksLanguageModule>> Gets(string projectKey)
        {
            return await _moduleManagementService.GetModulesAsync(projectKey);
        }

        //[HttpDelete]
        //[ProtectedEndPoint]
        //public async Task<BaseMutationResponse> Delete([FromQuery] DeleteModuleRequest request)
        //{
        //    if (request == null) return new BaseMutationResponse { IsSuccess = false };
        //    _changeControllerContext.ChangeContext(request);
        //    return await _moduleManagementService.DeleteModuleAsync(request);
        //}

        [HttpPost]
        // [ProtectedEndPoint($"{Constants.ServiceName}::module::tagglossary")]
        [Authorize]
        public async Task<BaseMutationResponse> TagGlossary([FromBody] TagGlossaryRequest request)
        {
            if (request == null) return new BaseMutationResponse { IsSuccess = false };
            return await _moduleManagementService.TagGlossaryAsync(request);
        }
    }
}
