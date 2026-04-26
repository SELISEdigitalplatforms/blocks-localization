using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class SaveModuleRequest : Module, IProjectKey
    {
        public string? ProjectKey { get; set; }
    }
}
