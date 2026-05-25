using Eurolm.DomainService.Repositories;
using MongoDB.Bson.Serialization.Attributes;

namespace Eurolm.DomainService.Shared.DTOs
{
    [BsonIgnoreExtraElements]
    public class LanguageManagerDto
    {
        public BlocksLanguageKey UilmResourceKey { get; set; }
        public BlocksLanguageModule UilmApplication { get; set; }
    }
}
