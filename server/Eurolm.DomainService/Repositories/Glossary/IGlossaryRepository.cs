using Eurolm.DomainService.Services;

namespace Eurolm.DomainService.Repositories
{
    public interface IGlossaryRepository
    {
        Task<GetGlossariesResponse> GetAllAsync(GetGlossariesRequest request);
        Task<Glossary> GetByIdAsync(string itemId);
        Task<List<Glossary>> GetByIdsAsync(List<string> ids);
        Task SaveAsync(BlocksGlossary glossary);
        Task DeleteAsync(string itemId);
    }
}
