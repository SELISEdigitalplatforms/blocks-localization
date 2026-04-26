using BlocksTemplate.DomainService.Shared;
using MongoDB.Bson.Serialization.Attributes;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlocksTemplate.DomainService.Repositories
{
    [BsonIgnoreExtraElements]
    public class BlocksLanguage : BaseEntity
    {
        public string LanguageName { get; set; }
        public string LanguageCode { get; set; }
        public bool IsDefault { get; set; }
    }
}
