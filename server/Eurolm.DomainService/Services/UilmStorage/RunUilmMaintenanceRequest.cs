namespace Eurolm.DomainService.Services.UilmStorage
{
    /// <summary>Optional body of <c>POST Key/RunUilmMaintenance</c>.</summary>
    public class RunUilmMaintenanceRequest
    {
        /// <summary>
        /// <c>uilm-maintenance</c> (the default when missing) or <c>uilm-restore-content</c>. Another value is queued
        /// as sent; the worker logs a warning and does nothing.
        /// </summary>
        public string? Task { get; set; }
    }
}
