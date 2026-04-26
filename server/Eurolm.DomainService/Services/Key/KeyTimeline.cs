using Eurolm.DomainService.Shared.Entities;
using Eurolm.DomainService.Repositories;
using MongoDB.Bson.Serialization.Attributes;

namespace Eurolm.DomainService.Services
{
    [BsonIgnoreExtraElements]
    public class KeyTimeline : BlocksBaseTimelineEntity<BlocksLanguageKey, BlocksLanguageKey>
    {
        public string? UserName { get; set; }
        public string? OperationId { get; set; }
    }
}
