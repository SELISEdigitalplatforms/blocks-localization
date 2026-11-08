using Eurolm.DomainService.Repositories;

namespace Eurolm.DomainService.Services
{
    /// <summary>The Track A (Phase 2) terminology stored as v1 JSON in <c>AdditionalNote</c>.</summary>
    public class GlossaryMeta
    {
        public GlossaryRule Rule { get; set; } = GlossaryRule.Translate;
        public bool CaseSensitive { get; set; }
        public List<string> Variants { get; set; } = new();
        /// <summary>Culture code → approved translation, in JSON key order.</summary>
        public List<KeyValuePair<string, string>> Translations { get; set; } = new();
        /// <summary>Culture code → alternatives that must not be used, in JSON key order.</summary>
        public List<KeyValuePair<string, List<string>>> Forbidden { get; set; } = new();
        /// <summary>Free-text internal note (never sent to the AI).</summary>
        public string? Note { get; set; }
    }

    public enum GlossaryMetaStatus
    {
        Plain,
        Structured,
        Corrupt,
        UnsupportedVersion
    }

    public class ParsedGlossaryMeta
    {
        public GlossaryMeta Meta { get; init; } = new();
        public GlossaryMetaStatus Status { get; init; }
        /// <summary>The original AdditionalNote ("" when absent).</summary>
        public string Raw { get; init; } = "";
    }
}
