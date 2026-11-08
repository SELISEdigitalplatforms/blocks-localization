namespace Eurolm.DomainService.Shared.Events
{
    /// <summary>
    /// Recompute stored key glossary violations. GlossaryId null = the whole project. The tenant's pending-job
    /// marker (<see cref="Repositories.GlossaryRecheckJob"/>) holds the merged scope of coalesced requests.
    /// </summary>
    public class RecheckGlossaryViolationsEvent
    {
        public string? ProjectKey { get; set; }
        public string? GlossaryId { get; set; }
    }
}
