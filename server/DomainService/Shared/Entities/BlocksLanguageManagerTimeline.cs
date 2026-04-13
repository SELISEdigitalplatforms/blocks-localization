using BlocksTemplate.DomainService.Shared.DTOs;
using MongoDB.Bson.Serialization.Attributes;

namespace BlocksTemplate.DomainService.Shared.Entities
{
    [BsonIgnoreExtraElements]
    public class BlocksLanguageManagerTimeline : BlocksBaseTimelineEntity<LanguageManagerDto, LanguageManagerDto>
    {
    }
}
