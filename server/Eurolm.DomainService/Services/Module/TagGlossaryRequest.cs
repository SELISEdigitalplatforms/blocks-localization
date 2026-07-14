using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class TagGlossaryRequest 
    {
        public string ModuleId { get; set; }
        public List<string> GlossaryIds { get; set; } = new();
    }
}
