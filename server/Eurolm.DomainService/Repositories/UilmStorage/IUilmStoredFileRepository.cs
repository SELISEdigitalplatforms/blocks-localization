using Eurolm.DomainService.Services.UilmStorage;

namespace Eurolm.DomainService.Repositories.UilmStorage
{
    /// <summary>The tenant's <c>UilmStoredFiles</c> ledger.</summary>
    public interface IUilmStoredFileRepository
    {
        Task InsertAsync(UilmStoredFile file);
        Task<bool> ExistsAsync(string fileId);

        /// <summary>Marks the files <c>Live</c> and clears any delete time and lease.</summary>
        Task MarkLiveAsync(IReadOnlyCollection<string> fileIds);

        /// <summary>Marks the files <c>Retired</c>, to be deleted after <paramref name="deleteAfter"/>.</summary>
        Task RetireAsync(IReadOnlyCollection<string> fileIds, DateTime deleteAfter);

        /// <summary>
        /// Leases one <c>Retired</c> row that is due (<c>DeleteAfter</c> passed, no live lease) until
        /// <paramref name="leaseUntil"/>; null when none is due.
        /// </summary>
        Task<UilmStoredFile?> ClaimDueAsync(DateTime now, DateTime leaseUntil);

        Task RemoveAsync(string fileId);

        /// <summary>Releases the lease after a failed delete and returns the new attempt count.</summary>
        Task<int> RecordFailedDeleteAsync(string fileId);

        /// <summary>Ids in <paramref name="state"/> created before <paramref name="createdBefore"/>, in id order after <paramref name="afterId"/>.</summary>
        Task<List<string>> GetIdsAsync(string state, DateTime createdBefore, string? afterId, int limit);

        /// <summary>Retires the files that are still in <paramref name="fromState"/>.</summary>
        Task<long> RetireFromStateAsync(IReadOnlyCollection<string> fileIds, string fromState, DateTime deleteAfter);
    }
}
