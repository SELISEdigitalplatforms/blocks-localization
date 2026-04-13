using MongoDB.Bson.Serialization.Attributes;

namespace BlocksTemplate.DomainService.Services
{
    [BsonIgnoreExtraElements]
    public class Module
    {
        public string? ItemId { get; set; }
        public string ModuleName { get; set; }
    }
}
