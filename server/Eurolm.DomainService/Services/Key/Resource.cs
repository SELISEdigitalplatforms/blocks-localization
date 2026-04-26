using MongoDB.Bson.Serialization.Attributes;

namespace Eurolm.DomainService.Services
{
    [BsonIgnoreExtraElements]
    public class Resource
    {
        public string Value { get; set; }
        public string Culture { get; set; }
        public int CharacterLength { get; set; }

    }
}
