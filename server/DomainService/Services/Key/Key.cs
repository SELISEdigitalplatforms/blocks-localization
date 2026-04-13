using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;

namespace BlocksTemplate.DomainService.Services
{
    [BsonIgnoreExtraElements]
    public class Key : IProjectKey
    {
        [BsonId]
        public string? ItemId { get; set; }
        public string KeyName { get; set; }
        public string ModuleId { get; set; }
        public Resource[] Resources { get; set; }
        public List<string>? Routes { get; set; }
        public bool IsPartiallyTranslated { get; set; }
        public bool IsNewKey { get; set; }
        public DateTime LastUpdateDate { get; set; }
        public DateTime CreateDate { get; set; }
        public string? Context { get; set; }
        public bool? ShouldPublish { get; set; }
        public string? ProjectKey { get; set; }
    }
}
