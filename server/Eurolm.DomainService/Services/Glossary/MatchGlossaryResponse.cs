namespace Eurolm.DomainService.Services
{
    public class MatchGlossaryResponse
    {
        public List<GlossaryMatchDto> Matches { get; set; } = new();
    }

    public class GlossaryMatchDto
    {
        public string GlossaryId { get; set; } = "";
        /// <summary>UTF-16 offset in the request text (JavaScript-compatible).</summary>
        public int Start { get; set; }
        public int Length { get; set; }
        public string Surface { get; set; } = "";
        public string Term { get; set; } = "";
        public string Rule { get; set; } = "";
        public string Status { get; set; } = "";
        public bool CaseSensitive { get; set; }
        /// <summary>"key" | "module" | "global" | "other".</summary>
        public string Scope { get; set; } = "";
        public string Definition { get; set; } = "";
        public string? PartOfSpeech { get; set; }
        public List<string>? UsageExamples { get; set; }
        /// <summary>Only the values active under the term's rule (A10).</summary>
        public List<GlossaryTranslationDto> Translations { get; set; } = new();
    }
}
