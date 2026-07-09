using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class DeleteKeysRequest 
    {
        public List<string> ItemIds { get; set; } = new List<string>();
    }
}
