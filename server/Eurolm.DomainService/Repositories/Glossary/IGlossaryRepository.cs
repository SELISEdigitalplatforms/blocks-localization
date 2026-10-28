using Eurolm.DomainService.Services;

namespace Eurolm.DomainService.Repositories
{
    public interface IGlossaryRepository
    {
        Task<GetGlossariesResponse> GetAllAsync(GetGlossariesRequest request);
        Task<Glossary> GetByIdAsync(string itemId);
        Task<BlocksGlossary?> GetStoredByIdAsync(string itemId);

        /// <summary>
        /// Glossaries whose trimmed, NFC-normalized name equals <paramref name="name"/>'s ignoring case,
        /// including legacy names stored decomposed (NFD) or with surrounding spaces.
        /// </summary>
        Task<List<Glossary>> GetByNameInsensitiveAsync(string name);
        Task<List<Glossary>> GetByIdsAsync(List<string> ids);
        Task<List<Glossary>> GetGlobalAsync(string projectKey);
        Task<List<Glossary>> GetByModuleIdAsync(string projectKey, string moduleId);
        Task InsertAsync(BlocksGlossary glossary);

        /// <summary>
        /// Replaces an existing glossary (never upserts). With <paramref name="expectedVersion"/> the
        /// replace only matches that stored version. Returns false when nothing matched.
        /// </summary>
        Task<bool> ReplaceAsync(BlocksGlossary glossary, int? expectedVersion);

        /// <summary>Adds the module to ModuleIds and bumps Version; other fields are left untouched.</summary>
        Task AddModuleAsync(string glossaryId, string moduleId);

        /// <summary>Removes the module from ModuleIds and bumps Version; other fields are left untouched.</summary>
        Task RemoveModuleAsync(string glossaryId, string moduleId);
        Task DeleteAsync(string itemId);
    }
}
