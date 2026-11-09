using MongoDB.Bson.Serialization.Attributes;

namespace Eurolm.DomainService.Services
{
    [BsonIgnoreExtraElements]
    public class Module
    {
        public string? ItemId { get; set; }
        public string ModuleName { get; set; }
        /// <summary>Absent or null leaves the stored description unchanged; blank clears it.</summary>
        public string? Description { get; set; }
    }
}
