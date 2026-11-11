namespace Eurolm.DomainService.Services.UilmStorage
{
    /// <summary>Queues UILM maintenance runs (<c>POST Key/RunUilmMaintenance</c>).</summary>
    public interface IUilmMaintenanceQueue
    {
        /// <summary>Queues a maintenance run for the caller's tenant only.</summary>
        Task QueueForCurrentTenantAsync();
    }
}
