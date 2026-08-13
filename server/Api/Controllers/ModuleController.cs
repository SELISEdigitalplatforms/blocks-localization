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
        [ProtectedEndPoint($"{Constants.ServiceName}::module::save")]
        public async Task<ApiResponse> Save([FromBody] SaveModuleRequest module)
        {
            if (module == null) return new ApiResponse("Module cannot be null.");
            return await _moduleManagementService.SaveModuleAsync(module);
        }


        /// <summary>
        /// Retrieves a list of all available modules.
        /// </summary>
        /// <returns>A list of <see cref="Module"/> objects.</returns>

        //[HttpGet]
        //[Authorize]
        //public async Task<List<BlocksLanguageModule>> GetModulesForCurrentTenant()
        //{
        //    return await _moduleManagementService.GetModulesAsync();
        //}

        /// <summary>
        /// Retrieves a paginated, date-filtered, and sorted list of modules for the current tenant.
        /// </summary>
        /// <param name="request">Paging (PageNumber/PageSize), CreateDateRange/LastUpdateDateRange filters, and SortProperty/IsDescending sort options.</param>
        /// <returns>A <see cref="GetModulesResponse"/> containing the matching modules and total count.</returns>
        [HttpGet]
        [Authorize]
        public async Task<GetModulesResponse> GetModulesForCurrentTenant ( [FromQuery] GetModulesRequest request)
        {
            request ??= new GetModulesRequest();
            return await _moduleManagementService.GetModulesAsync(request);
        }

        /// <summary>
        /// Retrieves all available modules for the current tenant.
        /// </summary>
        /// <remarks>"Clouds" was an unclear alias for the current tenant. Use GetModulesForCurrentTenant.</remarks>
        //[HttpGet]
        //[Authorize]
        //[ApiExplorerSettings(IgnoreApi = true)]
        //[Obsolete("Renamed to GetModulesForCurrentTenant.")]
        //public async Task<List<BlocksLanguageModule>> GetCloudsModules()
        //{
        //    return await GetModulesForCurrentTenant();
        //}
        [HttpGet]
        public async Task<List<BlocksLanguageModule>> Gets()
        {
            return await _moduleManagementService.GetModulesAsync();
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
        [ProtectedEndPoint($"{Constants.ServiceName}::module::tagglossary")]
        public async Task<BaseMutationResponse> TagGlossary([FromBody] TagGlossaryRequest request)
        {
            if (request == null) return new BaseMutationResponse { IsSuccess = false };
            return await _moduleManagementService.TagGlossaryAsync(request);
        }
    }
}
