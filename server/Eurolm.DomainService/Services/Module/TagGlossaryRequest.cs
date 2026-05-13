using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class TagGlossaryRequest : IProjectKey
    {
        public string ModuleId { get; set; }
        public List<string> GlossaryIds { get; set; } = new();
        public string? ProjectKey { get; set; }
    }
}
