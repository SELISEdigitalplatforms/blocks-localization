using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;
using System.Text;

namespace Eurolm.DomainService.Services
{
    [BsonIgnoreExtraElements]
    public class Glossary 
    {
        [BsonId]
        public string? ItemId { get; set; }
        public string Name { get; set; }
        public string? Language { get; set; }
        public string? Type { get; set; }
        public string? Context { get; set; }
        public string? AdditionalNote { get; set; }
        public bool IsGlobal { get; set; }
        public List<string>? ModuleIds { get; set; }
        public DateTime CreateDate { get; set; }
        public DateTime LastUpdateDate { get; set; }

        /// <summary>
        /// The stored version (0 for documents saved before versioning). Optional on Save:
        /// when sent, a save against a newer stored version is rejected.
        /// </summary>
        [BsonDefaultValue(0)]
        public int? Version { get; set; }

        /// <summary>Trims and NFC-normalizes a glossary name, the form names are compared and stored in.</summary>
        public static string NormalizeName(string? name) =>
            (name ?? string.Empty).Trim().Normalize(NormalizationForm.FormC);
    }
}
