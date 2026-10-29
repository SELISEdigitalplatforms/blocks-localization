using MongoDB.Bson.Serialization.Attributes;

namespace Eurolm.DomainService.Repositories
{
    /// <summary>A glossary rule a key's stored translation for one culture breaks.</summary>
    [BsonIgnoreExtraElements]
    public class KeyGlossaryViolation
    {
        public string Culture { get; set; } = "";
        public string GlossaryId { get; set; } = "";
        public string Term { get; set; } = "";
        public string Kind { get; set; } = "";
        public string? Expected { get; set; }
        public string? Found { get; set; }
        public DateTime DetectedAt { get; set; }
    }
}
