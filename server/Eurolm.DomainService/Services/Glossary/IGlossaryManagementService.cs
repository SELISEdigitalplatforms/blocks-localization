using Blocks.Genesis;
using Eurolm.DomainService.Shared;

namespace Eurolm.DomainService.Services
{
    public interface IGlossaryManagementService
    {
        Task<GetGlossariesResponse> GetGlossariesAsync(GetGlossariesRequest request);
        Task<Glossary?> GetGlossaryByIdAsync(string itemId);

        /// <summary>The existing glossaries in request order (one query); missing ids are omitted.</summary>
        Task<List<Glossary>> GetGlossariesByIdsAsync(IReadOnlyList<string> itemIds);

        /// <summary>Null when the glossary doesn't exist.</summary>
        Task<GlossaryUsageResponse?> GetGlossaryUsageAsync(GlossaryUsageRequest request);
        Task<ApiResponse> SaveGlossaryAsync(Glossary glossary);
        Task<BaseMutationResponse> DeleteGlossaryAsync(DeleteGlossaryRequest request);
    }
}
