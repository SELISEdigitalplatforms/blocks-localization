using Blocks.Genesis;
using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Shared;
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
        private readonly ChangeControllerContext _changeControllerContext;

        /// <summary>
        /// Initializes a new instance of the <see cref="ModuleController"/> class.
        /// </summary>
        /// <param name="moduleManagementService"></param>


        public ModuleController(
            IModuleManagementService moduleManagementService,
            ChangeControllerContext changeControllerContext)
        {
            _moduleManagementService = moduleManagementService;
            _changeControllerContext = changeControllerContext;
        }


        /// <summary>
        /// Saves a new module or updates an existing one.
        /// </summary>
        /// <param name="module">The module object to be saved.</param>
        /// <returns>An <see cref="ApiResponse"/> indicating the result of the save operation.</returns>
        
        [HttpPost]
        [ProtectedEndPoint]
        public async Task<ApiResponse> Save([FromBody] SaveModuleRequest module)
        {
            if (module == null) BadRequest(new BaseMutationResponse());
            _changeControllerContext.ChangeContext(module);
            return await _moduleManagementService.SaveModuleAsync(module);
        }


        /// <summary>
        /// Retrieves a list of all available modules.
        /// </summary>
        /// <returns>A list of <see cref="Module"/> objects.</returns>
        
        [HttpGet]
        public async Task<List<BlocksLanguageModule>> Gets([FromQuery]GetModulesQuery query)
        {
            if (query == null) BadRequest(new BaseMutationResponse());
            _changeControllerContext.ChangeContext(query);
            return await _moduleManagementService.GetModulesAsync();
        }
    }
}
