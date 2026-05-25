using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class DeleteKeysRequest : IProjectKey
    {
        public List<string> ItemIds { get; set; } = new List<string>();
        public string? ProjectKey { get; set; }
    }
}
