using MongoDB.Bson.Serialization.Attributes;

namespace Eurolm.DomainService.Services
{
    [BsonIgnoreExtraElements]
    public class Module
    {
        public string? ItemId { get; set; }
        public string ModuleName { get; set; }
    }
}
