namespace Eurolm.DomainService.Services.UilmStorage
{
    /// <summary>Queues UILM maintenance runs (<c>POST Key/RunUilmMaintenance</c>).</summary>
    public interface IUilmMaintenanceQueue
    {
        /// <summary>
        /// Queues <paramref name="task"/> for the caller's tenant only; null or blank queues <c>uilm-maintenance</c>. Any
        /// other value is sent as is, and the worker ignores a task it doesn't know.
        /// </summary>
        Task QueueForCurrentTenantAsync(string? task);
    }
}
