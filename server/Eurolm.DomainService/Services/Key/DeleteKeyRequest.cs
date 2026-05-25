using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class DeleteKeyRequest : IProjectKey
    {
        public string ItemId { get; set; }
        public string? ProjectKey { get; set; }
    }
}
