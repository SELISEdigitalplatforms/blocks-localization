namespace Eurolm.DomainService.Repositories
{
    public interface IGlossaryRecheckJobRepository
    {
        /// <summary>
        /// Adds the scope (<paramref name="glossaryIds"/> plus <paramref name="moduleIds"/>, or the whole project when
        /// <paramref name="glossaryIds"/> is null) to the tenant's pending job. True when this call created the marker, or took over one older than <paramref name="staleAfter"/>
        /// (its message was lost): the caller must then publish the event. False when merged into a queued job.
        /// </summary>
        Task<bool> TryEnqueueAsync(string tenantId, IReadOnlyCollection<string>? glossaryIds, IReadOnlyCollection<string>? moduleIds, DateTime now, TimeSpan staleAfter);

        /// <summary>Removes and returns the pending job, or null when none is queued.</summary>
        Task<GlossaryRecheckJob?> ClaimAsync(string tenantId);

        /// <summary>True when a job is queued.</summary>
        Task<bool> HasQueuedAsync(string tenantId);

        /// <summary>Removes the pending job (after its event could not be published).</summary>
        Task ReleaseAsync(string tenantId);

        /// <summary>
        /// Takes or renews the tenant's running-job lease for <paramref name="owner"/>. False while another owner
        /// holds a lease that hasn't run out.
        /// </summary>
        Task<bool> TryAcquireLeaseAsync(string tenantId, string owner, DateTime now, TimeSpan leaseFor);

        /// <summary>Drops the lease if <paramref name="owner"/> still holds it.</summary>
        Task ReleaseLeaseAsync(string tenantId, string owner);
    }
}
