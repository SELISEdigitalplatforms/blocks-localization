using MongoDB.Bson.Serialization.Attributes;

namespace BlocksTemplate.DomainService.Shared.Entities
{
    [BsonIgnoreExtraElements]
    public class BlocksBaseTimelineEntity<CT, PT>
    {
        [BsonId]
        public string ItemId { get; set; } = Guid.NewGuid().ToString();
        public string? EntityId { get; set; } // ID of the entity being tracked (e.g., Key ItemId)
        public DateTime CreateDate { get; set; } = DateTime.Now;
        public DateTime LastUpdateDate { get; set; } = DateTime.Now;
        public CT? CurrentData { get; set; }
        public PT? PreviousData { get; set; }
        public string? LogFrom { get; set; }
        public string? UserId { get; set; }
        public string? RollbackFrom { get; set; }
    }
}
