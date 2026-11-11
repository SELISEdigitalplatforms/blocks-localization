namespace Eurolm.DomainService.Services.UilmStorage
{
    /// <summary>
    /// Limits for publishing UILM files to Storage and serving them. The defaults are the spec's budgets
    /// (#348, section 5 and 6.9); there is no configuration section, so a change is a code change.
    /// </summary>
    public sealed class UilmStorageOptions
    {
        /// <summary>Upper bound of the API's file cache, in bytes (entry size = file bytes).</summary>
        public long CacheSizeLimitBytes { get; init; } = 200L * 1024 * 1024;
        public TimeSpan CacheSlidingExpiration { get; init; } = TimeSpan.FromHours(1);

        /// <summary>Timeout of one Storage GET or HEAD of a published file.</summary>
        public TimeSpan StorageFetchTimeout { get; init; } = TimeSpan.FromSeconds(5);

        /// <summary>Timeout of one upload attempt (the PUT to the pre-signed URL).</summary>
        public TimeSpan UploadTimeout { get; init; } = TimeSpan.FromSeconds(30);

        /// <summary>Waits before each retry of a failed upload; the count is the number of retries.</summary>
        public IReadOnlyList<TimeSpan> UploadRetryDelays { get; init; } =
            [TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(4)];

        /// <summary>Uploads in flight per module.</summary>
        public int UploadParallelism { get; init; } = 5;

        /// <summary>How long a replaced file stays in Storage before maintenance deletes it.</summary>
        public TimeSpan RetireDelay { get; init; } = TimeSpan.FromHours(24);

        public TimeSpan MaintenanceLease { get; init; } = TimeSpan.FromMinutes(15);
        public int MaintenanceBatchSize { get; init; } = 500;

        /// <summary>From this many failed deletes on, every run logs <c>UilmFileDeleteStuck</c> for the file.</summary>
        public int StuckDeleteAttempts { get; init; } = 10;

        public TimeSpan ReconcileInterval { get; init; } = TimeSpan.FromHours(24);

        /// <summary>Module/language groups the backfill converts per tenant and run (#349 P1).</summary>
        public int BackfillBatchSize { get; init; } = 200;

        /// <summary>Rows read per page by content removal and restore.</summary>
        public int ContentPageSize { get; init; } = 500;

        /// <summary>An <c>Uploading</c> ledger row older than this, with no pointer, is an orphan.</summary>
        public TimeSpan OrphanUploadAge { get; init; } = TimeSpan.FromHours(1);
    }
}
