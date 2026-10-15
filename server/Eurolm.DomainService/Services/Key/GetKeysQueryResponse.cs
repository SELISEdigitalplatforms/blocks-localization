namespace Eurolm.DomainService.Services
{
    public class GetKeysQueryResponse
    {
        public long TotalCount { get; set; }
        public List<Key> Keys { get; set; }
        /// <summary>True when OnlyDuplicates was requested and the duplicate rows exceeded the cap.</summary>
        public bool DuplicatesTruncated { get; set; }
    }
}
