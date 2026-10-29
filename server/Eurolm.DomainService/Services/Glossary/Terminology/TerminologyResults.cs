namespace Eurolm.DomainService.Services
{
    public static class GlossaryViolationKinds
    {
        public const string MissingTranslation = "missing-translation";
        public const string MissingKeep = "missing-keep";
        public const string ForbiddenUsed = "forbidden-used";
    }

    /// <summary>A rule the server put in the prompt.</summary>
    public class AppliedTerm
    {
        public string GlossaryId { get; set; } = "";
        public string Term { get; set; } = "";
        /// <summary>"translate" | "keep" | "forbidden".</summary>
        public string Rule { get; set; } = "";
        /// <summary>The approved translation for the target, for translate terms only.</summary>
        public string? Expected { get; set; }
    }

    public class GlossaryViolationDto
    {
        public string GlossaryId { get; set; } = "";
        public string Term { get; set; } = "";
        /// <summary>One of <see cref="GlossaryViolationKinds"/>.</summary>
        public string Kind { get; set; } = "";
        public string? Expected { get; set; }
        public string? Found { get; set; }
    }

    public class TerminologyPrompt
    {
        /// <summary>Everything before the final "Translate the following…" line, ending with a newline.</summary>
        public string Context { get; init; } = "";
        /// <summary>The final "Translate the following from … to …: '…'" line.</summary>
        public string FinalLine { get; init; } = "";
        public string Prompt => Context + FinalLine;
        /// <summary>The matches whose rules are in the prompt (Approved, applicable, within the caps).</summary>
        public List<GlossaryMatch> RuleMatches { get; init; } = new();
        public List<AppliedTerm> AppliedTerms { get; init; } = new();
    }
}
