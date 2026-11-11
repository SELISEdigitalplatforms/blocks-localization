using Eurolm.DomainService.Services;

namespace Eurolm.DomainService.Repositories
{
    public interface ILanguageFileGenerationHistoryRepository
    {
        Task SaveAsync(LanguageFileGenerationHistory history);
        Task<LanguageFileGenerationHistory?> GetLatestLanguageFileGenerationHistory(string projectKey);

        /// <summary>The highest <c>Version</c> in the project's history, or 0 when it has none.</summary>
        Task<int> GetHighestVersionAsync(string projectKey);
        Task<GetLanguageFileGenerationHistoryResponse> GetPaginatedAsync(GetLanguageFileGenerationHistoryRequest request);
    }
}
