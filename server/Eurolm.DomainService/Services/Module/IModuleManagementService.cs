using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Shared;

namespace Eurolm.DomainService.Services
{
    public interface IModuleManagementService
    {
        Task<ApiResponse> SaveModuleAsync(SaveModuleRequest module);
        Task<List<BlocksLanguageModule>> GetModulesAsync(string? moduleId = null);
        Task<List<BlocksLanguageModule>> GetModulesAsync(string projectKey,string? moduleId = null);
        Task<GetModulesResponse> GetModulesAsync(GetModulesRequest request);
        //Task<BaseMutationResponse> DeleteModuleAsync(DeleteModuleRequest request);
        Task<BaseMutationResponse> TagGlossaryAsync(TagGlossaryRequest request);
    }
}
