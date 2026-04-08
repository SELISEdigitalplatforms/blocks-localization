using MongoDB.Bson.Serialization.Attributes;

namespace BlocksTemplate.DomainService.Services
{
    [BsonIgnoreExtraElements]
    public class UilmFile
    {
        [BsonId]
        public string Id { get; set; }
        public string TenantId { get; set; }
        public string ModuleName { get; set; }
        public string Language { get; set; }
        public string Content { get; set; }
    }
}
