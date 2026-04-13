using BlocksTemplate.DomainService.Services;

namespace BlocksTemplate.DomainService.Repositories
{
    public interface ILanguageRepository
    {
        Task SaveAsync(BlocksLanguage language);
        Task<BlocksLanguage> GetLanguageByNameAsync(string languageName);
        Task<List<Language>> GetAllLanguagesAsync();
        Task DeleteAsync(string languageName);
        Task RemoveDefault(BlocksLanguage language);
    }
}
