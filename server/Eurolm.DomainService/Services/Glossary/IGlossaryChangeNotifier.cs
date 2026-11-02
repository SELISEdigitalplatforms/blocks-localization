namespace Eurolm.DomainService.Services
{
    public interface IGlossaryChangeNotifier
    {
        /// <summary>
        /// Invalidates the tenant's matcher and triggers a re-check of the changed glossaries' keys (coalesced, flag on only).
        /// </summary>
        Task NotifyAsync(string tenantId, IReadOnlyCollection<string> changedGlossaryIds);

        /// <summary>
        /// As <see cref="NotifyAsync(string, IReadOnlyCollection{string})"/>, also re-checking the keys of
        /// <paramref name="previousModuleIds"/>, the modules some glossaries were just removed from.
        /// </summary>
        Task NotifyAsync(string tenantId, IReadOnlyCollection<string> changedGlossaryIds, IReadOnlyCollection<string> previousModuleIds);
    }
}
