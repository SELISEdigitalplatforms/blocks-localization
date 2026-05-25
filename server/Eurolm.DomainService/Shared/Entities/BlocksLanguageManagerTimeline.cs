using Eurolm.DomainService.Shared.DTOs;
using MongoDB.Bson.Serialization.Attributes;

namespace Eurolm.DomainService.Shared.Entities
{
    [BsonIgnoreExtraElements]
    public class BlocksLanguageManagerTimeline : BlocksBaseTimelineEntity<LanguageManagerDto, LanguageManagerDto>
    {
    }
}
