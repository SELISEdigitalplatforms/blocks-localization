using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    /// <summary>
    /// Either <see cref="KeyIds"/> or <see cref="Filter"/>, never both; the filter form follows the same rules as
    /// <see cref="DeleteKeysRequest"/>.
    /// </summary>
    public class TranslateBlocksLanguageKeysRequest : IProjectKey
    {
        public List<string>? KeyIds { get; set; }
        public required string MessageCoRelationId { get; set; }
        public required string ProjectKey { get; set; }
        public required string DefaultLanguage { get; set; }

        /// <summary>The Key/Gets filter; its paging fields (PageSize, PageNumber, Cursor, IncludeTotalCount) are ignored.</summary>
        public GetKeysRequest? Filter { get; set; }

        /// <summary>Only with <see cref="Filter"/>: keys left out of the matching set. IDs that don't match are ignored.</summary>
        public List<string>? ExcludedKeyIds { get; set; }

        /// <summary>Required with <see cref="Filter"/>: the count the user confirmed (matching minus excluded).</summary>
        public long? ExpectedCount { get; set; }
    }
}
