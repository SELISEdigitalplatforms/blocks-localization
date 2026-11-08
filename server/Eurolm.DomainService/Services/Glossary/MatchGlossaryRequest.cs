namespace Eurolm.DomainService.Services
{
    public class MatchGlossaryRequest
    {
        public const int MaxTextLength = 5000;
        public const int MaxGlossaryIds = 100;

        /// <summary>The source text, 1–5,000 characters.</summary>
        public string? Text { get; set; }
        /// <summary>The source culture (required); zh, ja, th, lo, km and my match substrings.</summary>
        public string? Language { get; set; }
        public string? ModuleId { get; set; }
        /// <summary>Loads that key's glossaryIds / moduleId when the request omits them.</summary>
        public string? KeyId { get; set; }
        public List<string>? GlossaryIds { get; set; }
        /// <summary>"applicable" (default) or "all".</summary>
        public string? Mode { get; set; }
    }
}
