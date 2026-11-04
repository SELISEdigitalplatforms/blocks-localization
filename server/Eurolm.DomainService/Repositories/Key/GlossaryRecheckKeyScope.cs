namespace Eurolm.DomainService.Repositories
{
    /// <summary>
    /// The keys a glossary re-check visits: tagged with one of the glossaries, in one of the modules, or holding
    /// a stored violation of one of the glossaries (so a narrowed scope clears its old violations).
    /// </summary>
    public class GlossaryRecheckKeyScope
    {
        public IReadOnlyCollection<string> GlossaryIds { get; init; } = Array.Empty<string>();
        public IReadOnlyCollection<string> ModuleIds { get; init; } = Array.Empty<string>();
    }
}
