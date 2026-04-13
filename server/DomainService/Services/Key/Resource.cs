using MongoDB.Bson.Serialization.Attributes;

namespace BlocksTemplate.DomainService.Services
{
    [BsonIgnoreExtraElements]
    public class Resource
    {
        public string Value { get; set; }
        public string Culture { get; set; }
        public int CharacterLength { get; set; }

    }
}
