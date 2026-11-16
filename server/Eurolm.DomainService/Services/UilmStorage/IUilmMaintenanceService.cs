namespace Eurolm.DomainService.Services.UilmStorage
{
    /// <summary>
    /// UILM Storage maintenance (#348 spec 6.9, #349 §6.2–6.5): backfill of legacy rows, content removal, deletion of
    /// retired files, reconcile, and the content restore task.
    /// </summary>
    public interface IUilmMaintenanceService
    {
        /// <summary>
        /// Runs one pass for the payload <c>{"task":"uilm-maintenance"}</c> or <c>{"task":"uilm-restore-content"}</c>: for
        /// its <c>tenantId</c>, or for every tenant. An invalid payload or another task is logged and ignored; nothing is
        /// thrown.
        /// </summary>
        Task RunAsync(string? payload);
    }
}
