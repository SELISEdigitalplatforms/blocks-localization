namespace Eurolm.DomainService.Services.UilmStorage
{
    /// <summary>Deletes retired UILM files from Storage and reconciles the ledger with the pointers (spec 6.9).</summary>
    public interface IUilmMaintenanceService
    {
        /// <summary>
        /// Runs one maintenance pass for the payload <c>{"task":"uilm-maintenance"}</c>: for its <c>tenantId</c>, or for
        /// every tenant. An invalid payload or another task is logged and ignored; nothing is thrown.
        /// </summary>
        Task RunAsync(string? payload);

        /// <summary>Queues a maintenance run for the caller's tenant only.</summary>
        Task QueueForCurrentTenantAsync();
    }
}
