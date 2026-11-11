namespace Eurolm.DomainService.Repositories.UilmStorage
{
    /// <summary>The tenant's <c>UilmStorageSettings</c> document.</summary>
    public interface IUilmStorageSettingsRepository
    {
        /// <summary>The per-tenant switch; false when the document is missing.</summary>
        Task<bool> IsPublishToStorageEnabledAsync();

        /// <summary>
        /// Records <paramref name="now"/> as the last reconcile and returns true when the previous one is older than
        /// <paramref name="interval"/> (or there was none); false when another run reconciled within the interval.
        /// </summary>
        Task<bool> TryStartReconcileAsync(DateTime now, TimeSpan interval);
    }
}
