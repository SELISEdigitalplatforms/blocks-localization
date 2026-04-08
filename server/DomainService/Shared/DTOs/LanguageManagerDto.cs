using BlocksTemplate.DomainService.Repositories;
using MongoDB.Bson.Serialization.Attributes;

namespace BlocksTemplate.DomainService.Shared.DTOs
{
    [BsonIgnoreExtraElements]
    public class LanguageManagerDto
    {
        public BlocksLanguageKey UilmResourceKey { get; set; }
        public BlocksLanguageModule UilmApplication { get; set; }
    }
}
