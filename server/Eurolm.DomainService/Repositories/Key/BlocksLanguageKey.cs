using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared;
using MongoDB.Bson.Serialization.Attributes;

namespace Eurolm.DomainService.Repositories
{
    [BsonIgnoreExtraElements]
    public class BlocksLanguageKey : BaseEntity
    {
        public string KeyName { get; set; }
        public string ModuleId { get; set; }
        public string Value { get; set; }
        public Resource[] Resources { get; set; }
        public List<string> Routes { get; set; }
        public List<string>? GlossaryIds { get; set; }
        public string? Context { get; set; }
        public bool IsPartiallyTranslated { get; set; }
        /// <summary>Glossary rules the stored translations break, per culture. Never written from a client request.</summary>
        public List<KeyGlossaryViolation>? GlossaryViolations { get; set; }
    }
}
