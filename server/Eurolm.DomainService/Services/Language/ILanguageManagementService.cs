using Blocks.Genesis;
using Eurolm.DomainService.Shared;

namespace Eurolm.DomainService.Services
{
    public interface ILanguageManagementService
    {
        Task<ApiResponse> SaveLanguageAsync(Language language);
        Task<List<Language>> GetLanguagesAsync();
        Task<List<Language>> GetLanguagesAsync(string ProjectKey);
        Task<BaseMutationResponse> DeleteAsync(DeleteLanguageRequest request);
        Task<BaseMutationResponse> SetDefaultLanguage(SetDefaultLanguageRequest request);
    }
}
