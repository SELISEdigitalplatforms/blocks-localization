using Blocks.Genesis;

namespace BlocksTemplate.DomainService.Services
{
    public class GetModulesQuery : IProjectKey
    {
        public string? ProjectKey { get; set; }
    }
}
