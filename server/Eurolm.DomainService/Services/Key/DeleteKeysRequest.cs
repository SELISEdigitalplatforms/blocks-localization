using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    /// <summary>
    /// Either <see cref="ItemIds"/> or <see cref="Filter"/>, never both. With <see cref="Filter"/> the server
    /// resolves the matching keys itself and refuses when they no longer number <see cref="ExpectedCount"/>.
    /// </summary>
    public class DeleteKeysRequest 
    {
        public List<string> ItemIds { get; set; } = new List<string>();

        /// <summary>The Key/Gets filter; its paging fields (PageSize, PageNumber, Cursor, IncludeTotalCount) are ignored.</summary>
        public GetKeysRequest? Filter { get; set; }

        /// <summary>Only with <see cref="Filter"/>: keys left out of the matching set. IDs that don't match are ignored.</summary>
        public List<string>? ExcludedItemIds { get; set; }

        /// <summary>Required with <see cref="Filter"/>: the count the user confirmed (matching minus excluded).</summary>
        public long? ExpectedCount { get; set; }
    }
}
