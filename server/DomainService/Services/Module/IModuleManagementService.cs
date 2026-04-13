using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Shared;

namespace BlocksTemplate.DomainService.Services
{
    public interface IModuleManagementService
    {
        Task<ApiResponse> SaveModuleAsync(SaveModuleRequest module);
        Task<List<BlocksLanguageModule>> GetModulesAsync(string? moduleId = null);
    }
}
