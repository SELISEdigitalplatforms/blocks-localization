namespace Eurolm.DomainService.Services
{
    public interface IGlossaryChangeNotifier
    {
        /// <summary>
        /// Invalidates the tenant's matcher and triggers a re-check of the changed glossaries' keys (coalesced, flag on only).
        /// </summary>
        Task NotifyAsync(string tenantId, IReadOnlyCollection<string> changedGlossaryIds);
    }
}
