namespace Eurolm.DomainService.Repositories
{
    public class GlossaryKeyUsage
    {
        public long KeyCount { get; set; }
        public List<GlossaryUsageKey> Keys { get; set; } = new();
        public List<string> ModuleIds { get; set; } = new();
        public long ViolationKeyCount { get; set; }
    }

    public class GlossaryUsageKey
    {
        public string ItemId { get; set; } = "";
        public string KeyName { get; set; } = "";
        public string ModuleId { get; set; } = "";
    }
}
