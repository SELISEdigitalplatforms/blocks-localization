using Eurolm.DomainService.Services;

namespace Eurolm.DomainService.Repositories
{
    public interface IGlossaryRepository
    {
        Task<GetGlossariesResponse> GetAllAsync(GetGlossariesRequest request);
        Task<Glossary> GetByIdAsync(string itemId);
        Task<Glossary> GetByNameAsync(string name);
        Task<List<Glossary>> GetByIdsAsync(List<string> ids);
        Task<List<Glossary>> GetGlobalAsync(string projectKey);
        Task<List<Glossary>> GetByModuleIdAsync(string projectKey, string moduleId);
        Task SaveAsync(BlocksGlossary glossary);
        Task DeleteAsync(string itemId);
    }
}
