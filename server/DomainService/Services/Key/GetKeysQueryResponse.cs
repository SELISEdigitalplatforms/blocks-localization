namespace BlocksTemplate.DomainService.Services
{
    public class GetKeysQueryResponse
    {
        public long TotalCount { get; set; }
        public List<Key> Keys { get; set; }
    }
}
