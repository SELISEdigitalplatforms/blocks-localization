using Eurolm.DomainService.Services;

namespace Eurolm.DomainService.Repositories
{
    public interface ILanguageRepository
    {
        Task SaveAsync(BlocksLanguage language);
        Task<BlocksLanguage> GetLanguageByNameAsync(string languageName);
        Task<List<Language>> GetAllLanguagesAsync();
        Task<List<Language>> GetAllLanguagesAsync(string projectKey);
        Task DeleteAsync(string languageName);
        Task RemoveDefault(BlocksLanguage language);
    }
}
