using MongoDB.Bson.Serialization.Attributes;

namespace Eurolm.DomainService.Repositories
{
    [BsonIgnoreExtraElements]
    public class LanguageFileGenerationHistory
    {
        [BsonId]
        public required string ItemId { get; set; }
        public DateTime CreateDate { get; set; }
        public int Version { get; set; }
        public string? ModuleId { get; set; }
        public required string ProjectKey { get; set; }
    }
}
