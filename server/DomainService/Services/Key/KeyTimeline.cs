using BlocksTemplate.DomainService.Shared.Entities;
using BlocksTemplate.DomainService.Repositories;
using MongoDB.Bson.Serialization.Attributes;

namespace BlocksTemplate.DomainService.Services
{
    [BsonIgnoreExtraElements]
    public class KeyTimeline : BlocksBaseTimelineEntity<BlocksLanguageKey, BlocksLanguageKey>
    {
        public string? UserName { get; set; }
        public string? OperationId { get; set; }
    }
}
