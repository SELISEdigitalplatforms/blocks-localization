using Eurolm.DomainService.Services;

namespace Eurolm.DomainService.Shared.Entities
{
    public class LanguageJsonModel
    {
        public string _id { get; set; }
        public string TenantId { get; set; }
        public string ModuleId { get; set; }
        public string? Module { get; set; }
        public List<string> Routes { get; set; }
        public string KeyName { get; set; }
        public bool IsPartiallyTranslated { get; set; }
        public Resource[] Resources { get; set; }
    }
}
