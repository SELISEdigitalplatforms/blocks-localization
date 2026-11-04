using Eurolm.DomainService.Shared;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Eurolm.DomainService.Repositories
{
    [BsonIgnoreExtraElements]
    public class BlocksGlossary : BaseEntity
    {
        public string Name { get; set; }
        public string Language { get; set; }
        public string Type { get; set; }
        /// <summary>The definition. Before migration it may end with a Track A <c>⟦rule: …⟧</c> marker.</summary>
        public string Context { get; set; }
        /// <summary>The internal note. Before migration it may hold the Track A v1 terminology JSON.</summary>
        public string AdditionalNote { get; set; }
        public bool IsGlobal { get; set; }
        public List<string>? ModuleIds { get; set; }
        /// <summary>Optimistic-concurrency counter; documents saved before it existed read as 0.</summary>
        public int Version { get; set; }

        /// <summary><c>Name.Trim().Normalize(FormC).ToLowerInvariant()</c>; missing on documents not saved or migrated since Phase 6.</summary>
        public string? NormalizedName { get; set; }
        [BsonRepresentation(BsonType.String)]
        public GlossaryRule? Rule { get; set; }
        public bool? CaseSensitive { get; set; }
        public List<string>? Variants { get; set; }
        public List<GlossaryTranslation>? Translations { get; set; }
        [BsonRepresentation(BsonType.String)]
        public GlossaryStatus? Status { get; set; }
        /// <summary>0 = legacy / Track A (terminology parsed from AdditionalNote), 2 = structured fields.</summary>
        public int SchemaVersion { get; set; }

        /// <summary>noun | verb | adjective | adverb | phrase | other (lower case); null when not set.</summary>
        public string? PartOfSpeech { get; set; }
        /// <summary>Up to 5 examples, each 1–300 characters. Shown to people only; never sent to the AI.</summary>
        public List<string>? UsageExamples { get; set; }
    }

    public enum GlossaryRule
    {
        Translate,
        Keep,
        Forbidden
    }

    public enum GlossaryStatus
    {
        Draft,
        Approved,
        Deprecated
    }

    [BsonIgnoreExtraElements]
    public class GlossaryTranslation
    {
        public string Language { get; set; } = "";
        public string Value { get; set; } = "";
        public List<string> ForbiddenValues { get; set; } = new();
    }
}
