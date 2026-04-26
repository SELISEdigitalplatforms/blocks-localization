using Blocks.Genesis;
using BlocksTemplate.DomainService.Shared;

namespace BlocksTemplate.DomainService.Services
{
    public interface IGlossaryManagementService
    {
        Task<GetGlossariesResponse> GetGlossariesAsync(GetGlossariesRequest request);
        Task<ApiResponse> SaveGlossaryAsync(Glossary glossary);
        Task<BaseMutationResponse> DeleteGlossaryAsync(DeleteGlossaryRequest request);
    }
}
