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

        // Structured terminology (Phase 6). Reads always fill these from the effective terminology. On Save
        // they are merged: null keeps the stored value, an empty list clears it, a value sets it.

        /// <summary>"translate" | "keep" | "forbidden".</summary>
        [BsonIgnore]
        public string? Rule { get; set; }
        [BsonIgnore]
        public bool? CaseSensitive { get; set; }
        [BsonIgnore]
        public List<string>? Variants { get; set; }
        /// <summary>Every stored translation and forbidden list, including inactive ones.</summary>
        [BsonIgnore]
        public List<GlossaryTranslationDto>? Translations { get; set; }
        /// <summary>"draft" | "approved" | "deprecated".</summary>
        [BsonIgnore]
        public string? Status { get; set; }
        /// <summary>0 = legacy / Track A (terminology parsed from additionalNote), 2 = structured fields. Ignored on Save.</summary>
        [BsonIgnore]
        public int SchemaVersion { get; set; }

        // Phase 8 fields, merged on Save like the structured fields: null keeps the stored value, "" / an empty
        // list clears it. They don't make a save "structured" (they are not terminology).

        /// <summary>"noun" | "verb" | "adjective" | "adverb" | "phrase" | "other".</summary>
        [BsonIgnore]
        public string? PartOfSpeech { get; set; }
        /// <summary>At most 5 examples, each 1–300 characters.</summary>
        [BsonIgnore]
        public List<string>? UsageExamples { get; set; }

        /// <summary>True when the request carries any of the structured fields.</summary>
        public bool HasStructuredFields() =>
            Rule != null || CaseSensitive != null || Variants != null || Translations != null || Status != null;

        /// <summary>Trims and NFC-normalizes a glossary name, the form names are compared and stored in.</summary>
        public static string NormalizeName(string? name) =>
            (name ?? string.Empty).Trim().Normalize(NormalizationForm.FormC);
    }

    public class GlossaryTranslationDto
    {
        public string Language { get; set; } = "";
        public string Value { get; set; } = "";
        public List<string> ForbiddenValues { get; set; } = new();
    }
}
