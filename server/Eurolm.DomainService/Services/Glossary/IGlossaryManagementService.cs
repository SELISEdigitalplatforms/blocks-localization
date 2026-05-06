using Blocks.Genesis;
using Eurolm.DomainService.Shared;

namespace Eurolm.DomainService.Services
{
    public interface IGlossaryManagementService
    {
        Task<GetGlossariesResponse> GetGlossariesAsync(GetGlossariesRequest request);
        Task<Glossary?> GetGlossaryByIdAsync(string itemId);
        Task<ApiResponse> SaveGlossaryAsync(Glossary glossary);
        Task<BaseMutationResponse> DeleteGlossaryAsync(DeleteGlossaryRequest request);
    }
}
