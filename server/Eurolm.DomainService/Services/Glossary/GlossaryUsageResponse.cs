using Eurolm.DomainService.Repositories;

namespace Eurolm.DomainService.Services
{
    public class GlossaryUsageResponse
    {
        public long KeyCount { get; set; }
        public List<GlossaryUsageKey> Keys { get; set; } = new();
        public List<string> ModuleIds { get; set; } = new();
        public long ViolationKeyCount { get; set; }
    }
}
