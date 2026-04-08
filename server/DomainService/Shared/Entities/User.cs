using MongoDB.Bson.Serialization.Attributes;

namespace BlocksTemplate.DomainService.Shared.Entities
{
    [BsonIgnoreExtraElements]
    public class User
    {
        [BsonId]
        public string ItemId { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Email { get; set; }
    }
}
