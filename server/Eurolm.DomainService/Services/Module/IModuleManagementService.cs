using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Shared;

namespace Eurolm.DomainService.Services
{
    public interface IModuleManagementService
    {
        Task<ApiResponse> SaveModuleAsync(SaveModuleRequest module);
        Task<List<BlocksLanguageModule>> GetModulesAsync(string? moduleId = null);
    }
}
