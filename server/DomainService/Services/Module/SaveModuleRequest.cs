using Blocks.Genesis;

namespace BlocksTemplate.DomainService.Services
{
    public class SaveModuleRequest : Module, IProjectKey
    {
        public string? ProjectKey { get; set; }
    }
}
