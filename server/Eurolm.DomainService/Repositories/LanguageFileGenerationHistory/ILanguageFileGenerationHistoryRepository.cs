using Eurolm.DomainService.Services;

namespace Eurolm.DomainService.Repositories
{
    public interface ILanguageFileGenerationHistoryRepository
    {
        Task SaveAsync(LanguageFileGenerationHistory history);
        Task<LanguageFileGenerationHistory?> GetLatestLanguageFileGenerationHistory(string projectKey);
        Task<GetLanguageFileGenerationHistoryResponse> GetPaginatedAsync(GetLanguageFileGenerationHistoryRequest request);
    }
}
