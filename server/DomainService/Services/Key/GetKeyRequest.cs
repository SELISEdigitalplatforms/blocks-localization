using Blocks.Genesis;

namespace BlocksTemplate.DomainService.Services
{
    public class GetKeyRequest : IProjectKey
    {
        public string ItemId { get; set; }
        public string? ProjectKey { get; set; }
    }
}
