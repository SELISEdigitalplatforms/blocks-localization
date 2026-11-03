namespace Eurolm.DomainService.Services
{
    public class GetKeysQueryResponse
    {
        /// <summary>Null only when the request set IncludeTotalCount = false.</summary>
        public long? TotalCount { get; set; }
        public List<Key> Keys { get; set; }

        /// <summary>Keyset token for the rows after this page; null on the last page.</summary>
        public string? NextCursor { get; set; }
        public bool HasMore => NextCursor != null;

        /// <summary>True when OnlyDuplicates was requested and the duplicate rows exceeded the cap.</summary>
        public bool DuplicatesTruncated { get; set; }
    }
}
