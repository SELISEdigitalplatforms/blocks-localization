namespace Eurolm.DomainService.Services
{
    public class GetKeysByKeyNamesResponse
    {
        public List<Key> Keys { get; set; } = new();
        public string? ErrorMessage { get; set; }
    }
}
