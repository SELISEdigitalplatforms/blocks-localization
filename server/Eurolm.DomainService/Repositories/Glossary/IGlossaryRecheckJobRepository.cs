namespace Eurolm.DomainService.Repositories
{
    public interface IGlossaryRecheckJobRepository
    {
        /// <summary>
        /// Adds the scope (<paramref name="glossaryIds"/>, or the whole project when null) to the tenant's pending
        /// job. True when this call created the marker, or took over one older than <paramref name="staleAfter"/>
        /// (its message was lost): the caller must then publish the event. False when merged into a queued job.
        /// </summary>
        Task<bool> TryEnqueueAsync(string tenantId, IReadOnlyCollection<string>? glossaryIds, DateTime now, TimeSpan staleAfter);

        /// <summary>Removes and returns the pending job, or null when none is queued.</summary>
        Task<GlossaryRecheckJob?> ClaimAsync(string tenantId);

        /// <summary>Removes the pending job (after its event could not be published).</summary>
        Task ReleaseAsync(string tenantId);
    }
}
