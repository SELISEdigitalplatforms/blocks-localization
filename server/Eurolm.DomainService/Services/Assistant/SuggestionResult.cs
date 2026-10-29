namespace Eurolm.DomainService.Services
{
    public class SuggestionResult
    {
        public string? Content { get; set; }
        public List<AppliedTerm> AppliedTerms { get; set; } = new();
        public List<GlossaryViolationDto> GlossaryViolations { get; set; } = new();
    }
}
