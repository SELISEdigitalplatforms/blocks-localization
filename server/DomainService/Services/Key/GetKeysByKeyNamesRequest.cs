using Blocks.Genesis;

namespace BlocksTemplate.DomainService.Services
{
    public class GetKeysByKeyNamesRequest : IProjectKey
    {
        public string[]? KeyNames { get; set; }
        public string? ModuleId { get; set; }
        public string? ProjectKey { get; set; }
    }
}
