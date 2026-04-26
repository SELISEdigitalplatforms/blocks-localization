using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;

namespace Eurolm.DomainService.Services
{
    [BsonIgnoreExtraElements]
    public class Glossary : IProjectKey
    {
        [BsonId]
        public string? ItemId { get; set; }
        public string Name { get; set; }
        public string? Language { get; set; }
        public string? Type { get; set; }
        public string? Context { get; set; }
        public string? AdditionalNote { get; set; }
        public DateTime CreateDate { get; set; }
        public DateTime LastUpdateDate { get; set; }
        public string? ProjectKey { get; set; }
    }
}
