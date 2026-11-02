using Eurolm.DomainService.Repositories;

namespace Eurolm.DomainService.Services
{
    public class GlossaryUsageResponse
    {
        public long KeyCount { get; set; }
        public List<GlossaryUsageKey> Keys { get; set; } = new();
        public List<string> ModuleIds { get; set; } = new();
        public long ViolationKeyCount { get; set; }
        /// <summary>Keys the glossary applies to (its scope), not only those tagged with it; what a delete affects.</summary>
        public long AffectedKeyCount { get; set; }
        public bool IsGlobal { get; set; }
    }
}
