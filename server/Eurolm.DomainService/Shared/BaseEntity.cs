using MongoDB.Bson.Serialization.Attributes;

namespace Eurolm.DomainService.Shared
{
    public class BaseEntity
    {
        [BsonId]
        public string ItemId { get; set; }
        public DateTime CreateDate { get; set; }
        public DateTime LastUpdateDate { get; set; }
        public string CreatedBy { get; set; }
        public string LastUpdatedBy { get; set; }
        public string TenantId { get; set; }
    }
}
