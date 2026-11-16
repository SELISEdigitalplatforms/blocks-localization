using Eurolm.DomainService.Services.UilmStorage;

namespace Eurolm.DomainService.Repositories.UilmStorage
{
    /// <summary>The tenant's <c>UilmStorageSettings</c> document.</summary>
    public interface IUilmStorageSettingsRepository
    {
        /// <summary>The tenant's switches; a missing document or field reads as on (<see cref="UilmStorageMode.From"/>).</summary>
        Task<UilmStorageMode> GetModeAsync();

        /// <summary>Sets <c>KeepContent</c>, creating the document when missing; other fields stay as they are.</summary>
        Task SetKeepContentAsync(bool keepContent);

        /// <summary>
        /// Records <paramref name="now"/> as the last reconcile and returns true when the previous one is older than
        /// <paramref name="interval"/> (or there was none); false when another run reconciled within the interval.
        /// </summary>
        Task<bool> TryStartReconcileAsync(DateTime now, TimeSpan interval);
    }
}
