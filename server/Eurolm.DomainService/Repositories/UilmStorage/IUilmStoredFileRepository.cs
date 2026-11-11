using Eurolm.DomainService.Services.UilmStorage;

namespace Eurolm.DomainService.Repositories.UilmStorage
{
    /// <summary>The tenant's <c>UilmStoredFiles</c> ledger.</summary>
    public interface IUilmStoredFileRepository
    {
        Task InsertAsync(UilmStoredFile file);
        Task<bool> ExistsAsync(string fileId);

        /// <summary>
        /// Marks the files <c>Live</c> and clears any delete time and lease; with <paramref name="fromState"/>, only
        /// the files still in that state (a publish never revives a file a newer publish already retired).
        /// </summary>
        Task MarkLiveAsync(IReadOnlyCollection<string> fileIds, string? fromState = null);

        /// <summary>Marks the files <c>Retired</c>, to be deleted after <paramref name="deleteAfter"/>.</summary>
        Task RetireAsync(IReadOnlyCollection<string> fileIds, DateTime deleteAfter);

        /// <summary>
        /// Leases one <c>Retired</c> row that is due (<c>DeleteAfter</c> passed, no live lease) until
        /// <paramref name="leaseUntil"/>; null when none is due.
        /// </summary>
        Task<UilmStoredFile?> ClaimDueAsync(DateTime now, DateTime leaseUntil);

        Task RemoveAsync(string fileId);

        /// <summary>
        /// Counts a failed delete and returns the new attempt count. The lease ends at <paramref name="runStartedAt"/>,
        /// so the run that failed doesn't claim the file again and the next run does.
        /// </summary>
        Task<int> RecordFailedDeleteAsync(string fileId, DateTime runStartedAt);

        /// <summary>Ids in <paramref name="state"/> created before <paramref name="createdBefore"/>, in id order after <paramref name="afterId"/>.</summary>
        Task<List<string>> GetIdsAsync(string state, DateTime createdBefore, string? afterId, int limit);

        /// <summary>Retires the files that are still in <paramref name="fromState"/>.</summary>
        Task<long> RetireFromStateAsync(IReadOnlyCollection<string> fileIds, string fromState, DateTime deleteAfter);
    }
}
