using Eurolm.DomainService.Services;

namespace Eurolm.DomainService.Repositories
{
    /// <summary>
    /// Detects duplicate keys (same ModuleId + KeyName) and duplicate modules (same ModuleName),
    /// and creates the unique indexes that prevent new ones once a tenant has none.
    /// </summary>
    public interface ILocalizationUniquenessRepository
    {
        /// <summary>Read-only duplicate counts and index state for the tenant. Never creates indexes.</summary>
        Task<GetDuplicateSummaryResponse> GetDuplicateSummaryAsync(string tenantId);

        /// <summary>
        /// Creates <c>ux_ModuleId_KeyName</c> and <c>ux_ModuleName</c> for each collection that has no
        /// duplicates. A collection with duplicates, or whose build fails, is skipped and reported as not enforced.
        /// </summary>
        Task<EnforceUniquenessResponse> EnsureUniqueIndexesAsync(string tenantId);
    }
}
