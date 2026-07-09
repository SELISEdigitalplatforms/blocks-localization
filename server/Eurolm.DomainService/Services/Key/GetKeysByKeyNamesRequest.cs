using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class GetKeysByKeyNamesRequest 
    {
        public string[]? KeyNames { get; set; }
        public string? ModuleId { get; set; }
    }
}
