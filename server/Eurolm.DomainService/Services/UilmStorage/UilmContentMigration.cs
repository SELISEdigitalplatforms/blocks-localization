using Blocks.Genesis;
using DomainService.Storage;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Repositories.UilmStorage;
using Microsoft.Extensions.Logging;
using StorageDriver;
using System.Collections.Concurrent;
using System.Text;

namespace Eurolm.DomainService.Services.UilmStorage
{
    /// <summary>
    /// The #349 maintenance steps for one tenant (the caller runs them in the tenant's context): backfill of legacy rows
    /// to Storage (§6.2), removal of <c>Content</c> from verified pointer rows (§6.3), and the restore task (§6.5).
    /// </summary>
    internal sealed class UilmContentMigration
    {
        private const char ByteOrderMark = '\uFEFF';

        private readonly IKeyRepository _keyRepository;
        private readonly IUilmStoredFileRepository _storedFiles;
        private readonly IUilmStorageSettingsRepository _settings;
        private readonly UilmStorageInfrastructure _infrastructure;
        private readonly UilmStorageOptions _options;
        private readonly UilmFileUploader _uploader;
        private readonly ILogger _logger;

        public UilmContentMigration(
            IKeyRepository keyRepository,
            IUilmStoredFileRepository storedFiles,
            IUilmStorageSettingsRepository settings,
            IStorageDriverService storageDriver,
            UilmStorageInfrastructure infrastructure,
            ILogger logger)
        {
            _keyRepository = keyRepository;
            _storedFiles = storedFiles;
            _settings = settings;
            _infrastructure = infrastructure;
            _options = infrastructure.Options;
            _uploader = new UilmFileUploader(storedFiles, storageDriver, infrastructure, logger);
            _logger = logger;
        }

        private enum BackfillOutcome { Converted, Failed, Superseded, Skipped }

        private sealed record Download(byte[]? Bytes, string Failure);

        // ---- Backfill (§6.2) ----

        /// <summary>
        /// Converts up to <see cref="UilmStorageOptions.BackfillBatchSize"/> module/language groups: the row the reader
        /// serves is uploaded byte for byte from its <c>Content</c> (never rebuilt from keys) and replaced by a pointer
        /// row, then the group's other rows are deleted. Logs the per-tenant summary (H10, H12).
        /// </summary>
        public async Task BackfillAsync()
        {
            var groups = await _keyRepository.GetUilmBackfillGroupsAsync(_options.BackfillBatchSize);
            var outcomes = new ConcurrentBag<BackfillOutcome>();
            await Parallel.ForEachAsync(
                groups,
                new ParallelOptions { MaxDegreeOfParallelism = _options.UploadParallelism },
                async (group, _) => outcomes.Add(await BackfillGroupAsync(group)));

            var counts = await _keyRepository.CountUilmFilesAsync();
            _logger.LogInformation("UilmBackfillSummary: tenant {TenantId}: {ConvertedCount} converted, {FailedCount} failed, {SupersededCount} superseded by a publish, {SkippedCount} skipped; "
                + "{LegacyRows} legacy rows remaining, {PointersWithContent} pointer rows with content, {PointersWithoutContent} pointer rows without content",
                TenantId(), outcomes.Count(o => o == BackfillOutcome.Converted), outcomes.Count(o => o == BackfillOutcome.Failed),
                outcomes.Count(o => o == BackfillOutcome.Superseded), outcomes.Count(o => o == BackfillOutcome.Skipped), counts.LegacyRows, counts.PointersWithContent, counts.PointersWithoutContent);
        }

        private async Task<BackfillOutcome> BackfillGroupAsync(UilmFileGroup group)
        {
            var attemptedFileIds = new ConcurrentBag<string>();
            try
            {
                // The reader's own query and sort, so the converted row is exactly the one served today (H4).
                var served = await _keyRepository.GetUilmFile(new GetUilmFileRequest { ModuleName = group.ModuleName, Language = group.Language });
                if (served == null)
                {
                    return BackfillOutcome.Skipped;
                }
                if (!string.IsNullOrEmpty(served.FileId) && await _storedFiles.ExistsAsync(served.FileId))
                {
                    // Already served from a tenant file: only rows an interrupted publish or backfill left behind remain.
                    // A run that stopped before marking its file Live left it Uploading; it is in use, so it is Live.
                    await _storedFiles.MarkLiveAsync([served.FileId], UilmStoredFileState.Uploading);
                    await _keyRepository.DeleteUilmFileDuplicatesAsync(group.ModuleName, group.Language, served.Id);
                    return BackfillOutcome.Skipped;
                }
                if (served.Content == null)
                {
                    return BackfillOutcome.Skipped;
                }

                var bytes = UilmFilePublisher.ToBytes(WithoutByteOrderMark(served.Content, group));
                var outcome = await _uploader.UploadAsync(group.ModuleName, group.Language, bytes, attemptedFileIds);
                if (outcome.Upload == null)
                {
                    await _storedFiles.RetireAsync(attemptedFileIds.ToList(), UtcNow());
                    LogBackfillFailed(group, outcome.Failure);
                    return BackfillOutcome.Failed;
                }

                var pointer = new UilmFile
                {
                    Id = UilmFile.PointerId(group.ModuleName, group.Language),
                    TenantId = served.TenantId,
                    ModuleName = group.ModuleName,
                    Language = group.Language,
                    Content = served.Content,
                    FileId = outcome.Upload.FileId,
                    Url = outcome.Upload.Url,
                    ContentHash = UilmFilePublisher.Hash(bytes),
                    Size = bytes.LongLength,
                    // Legacy rows get 0 (E1); a row a switch-off publish wrote keeps its version (Q2).
                    Version = served.Version ?? 0,
                    PublishedAt = UtcNow()
                };
                if (!await _keyRepository.ReplaceUilmFileFromBackfillAsync(served, pointer))
                {
                    // A publish (or an overlapping run) changed the group meanwhile; its pointer stays (C1, C10).
                    await _storedFiles.RetireAsync(attemptedFileIds.ToList(), UtcNow());
                    _logger.LogInformation("UILM backfill of module {ModuleName} language {Language} was superseded; file {FileId} retired",
                        group.ModuleName, group.Language, outcome.Upload.FileId);
                    return BackfillOutcome.Superseded;
                }

                await _storedFiles.MarkLiveAsync([outcome.Upload.FileId], UilmStoredFileState.Uploading);
                await _keyRepository.DeleteUilmFileDuplicatesAsync(group.ModuleName, group.Language, pointer.Id);
                return BackfillOutcome.Converted;
            }
            catch (Exception ex)
            {
                // The row stays as it was and the next run tries again; a file whose pointer was written stays in use.
                await RetireUnusedAsync(attemptedFileIds);
                LogBackfillFailed(group, ex.GetType().Name);
                return BackfillOutcome.Failed;
            }
        }

        /// <summary>Retires attempted uploads that no pointer uses, swallowing errors (reconcile retires them later).</summary>
        private async Task RetireUnusedAsync(ConcurrentBag<string> attemptedFileIds)
        {
            try
            {
                var ids = attemptedFileIds.ToList();
                var referenced = await _keyRepository.GetReferencedUilmFileIdsAsync(ids);
                await _storedFiles.RetireAsync(ids.Where(id => !referenced.Contains(id)).ToList(), UtcNow());
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "UILM backfill could not retire its unused uploads; reconcile retires them");
            }
        }

        private void LogBackfillFailed(UilmFileGroup group, string reason) =>
            _logger.LogWarning("UilmBackfillFailed: module {ModuleName} language {Language}: {Reason}", group.ModuleName, group.Language, reason);

        /// <summary>Files are served without a byte order mark (C13); the row's own Content is kept as it is.</summary>
        private string WithoutByteOrderMark(string content, UilmFileGroup group)
        {
            if (content.Length == 0 || content[0] != ByteOrderMark)
            {
                return content;
            }
            _logger.LogInformation("UilmBackfillBomRemoved: module {ModuleName} language {Language}", group.ModuleName, group.Language);
            return content[1..];
        }

        // ---- Content removal (§6.3, Q3) ----

        /// <summary>
        /// Removes <c>Content</c> from pointer rows whose file is <c>Live</c> in the ledger, after downloading the file once
        /// and matching its SHA-256 with <c>ContentHash</c> (Q3). A mismatch or a failed download keeps the row's content.
        /// </summary>
        public async Task RemoveContentAsync()
        {
            var removed = 0;
            var kept = 0;
            await ForEachLiveRowAsync(withContent: true, StopWhenContentIsKeptAsync, async row =>
            {
                var failure = await VerifyAsync(row);
                if (failure != null)
                {
                    Interlocked.Increment(ref kept);
                    _logger.LogWarning("UilmContentRemovalSkipped: module {ModuleName} language {Language} file {FileId}: {Reason}",
                        row.ModuleName, row.Language, row.FileId, failure);
                    return;
                }
                if (await _keyRepository.RemoveUilmFileContentAsync(row))
                {
                    Interlocked.Increment(ref removed);
                }
            });
            if (removed + kept > 0)
            {
                _logger.LogInformation("UilmContentRemoval: tenant {TenantId}: content removed from {RemovedCount} rows, kept on {KeptCount} rows that failed verification",
                    TenantId(), removed, kept);
            }
        }

        /// <summary>Null when the row's file downloads and matches its <c>ContentHash</c>; else why not.</summary>
        private async Task<string?> VerifyAsync(UilmFile row)
        {
            var download = await DownloadAsync(row.Url);
            if (download.Bytes == null)
            {
                return download.Failure;
            }
            return UilmFilePublisher.Hash(download.Bytes) == row.ContentHash ? null : "content hash mismatch";
        }

        // ---- Restore (§6.5) ----

        /// <summary>
        /// Sets <c>KeepContent</c> first, so publishes write content again at once (C9), then writes back hash-verified
        /// content for every pointer row without it whose file is <c>Live</c> in the ledger. Mismatching (C8) or unreadable
        /// files leave that row's content null.
        /// </summary>
        public async Task RestoreContentAsync()
        {
            await _settings.SetKeepContentAsync(true);
            var restored = 0;
            var mismatched = 0;
            var failed = 0;
            await ForEachLiveRowAsync(withContent: false, () => Task.FromResult(false), async row =>
            {
                var download = await DownloadAsync(row.Url);
                if (download.Bytes == null)
                {
                    Interlocked.Increment(ref failed);
                    _logger.LogWarning("UilmRestoreDownloadFailed: module {ModuleName} language {Language} file {FileId}: {Reason}",
                        row.ModuleName, row.Language, row.FileId, download.Failure);
                    return;
                }
                if (UilmFilePublisher.Hash(download.Bytes) != row.ContentHash)
                {
                    Interlocked.Increment(ref mismatched);
                    _logger.LogError("UilmRestoreHashMismatch: module {ModuleName} language {Language} file {FileId}",
                        row.ModuleName, row.Language, row.FileId);
                    return;
                }
                if (await _keyRepository.RestoreUilmFileContentAsync(row, Encoding.UTF8.GetString(download.Bytes)))
                {
                    Interlocked.Increment(ref restored);
                }
            });
            _logger.LogInformation("UilmRestoreContent: tenant {TenantId}: content restored on {RestoredCount} rows, {MismatchCount} hash mismatches, {FailedCount} downloads failed; KeepContent is true",
                TenantId(), restored, mismatched, failed);
        }

        /// <summary>A restore started meanwhile set <c>KeepContent</c> again: removal stops before its next page.</summary>
        private async Task<bool> StopWhenContentIsKeptAsync() => (await _settings.GetModeAsync()).KeepContent;

        /// <summary>
        /// Pages through the rows with a ledger-<c>Live</c> file, a few downloads at a time, until <paramref name="stop"/>
        /// is true before a page. One row's error is logged and the others continue.
        /// </summary>
        private async Task ForEachLiveRowAsync(bool withContent, Func<Task<bool>> stop, Func<UilmFile, Task> action)
        {
            string? afterId = null;
            while (!await stop())
            {
                var rows = await _keyRepository.GetUilmFilesWithLiveFileAsync(withContent, afterId, _options.ContentPageSize);
                if (rows.Count == 0)
                {
                    return;
                }
                await Parallel.ForEachAsync(rows, new ParallelOptions { MaxDegreeOfParallelism = _options.UploadParallelism },
                    async (row, _) => await RunForRowAsync(row, action));
                if (rows.Count < _options.ContentPageSize)
                {
                    return;
                }
                afterId = rows[^1].Id;
            }
        }

        private async Task RunForRowAsync(UilmFile row, Func<UilmFile, Task> action)
        {
            try
            {
                await action(row);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "UilmContentRowFailed: module {ModuleName} language {Language} file {FileId}: {Reason}",
                    row.ModuleName, row.Language, row.FileId, ex.GetType().Name);
            }
        }

        private async Task<Download> DownloadAsync(string? url)
        {
            if (string.IsNullOrEmpty(url))
            {
                return new Download(null, "no URL");
            }
            try
            {
                using var timeout = new CancellationTokenSource(_options.StorageFetchTimeout, _infrastructure.TimeProvider);
                using var response = await _infrastructure.CreateHttpClient().GetAsync(url, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
                return response.IsSuccessStatusCode
                    ? new Download(await response.Content.ReadAsByteArrayAsync(timeout.Token), string.Empty)
                    : new Download(null, $"HTTP {(int)response.StatusCode}");
            }
            catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException or InvalidOperationException or UriFormatException)
            {
                return new Download(null, ex is OperationCanceledException ? "timeout" : ex.GetType().Name);
            }
        }

        private static string TenantId() => BlocksContext.GetContext()?.TenantId ?? string.Empty;

        private DateTime UtcNow() => _infrastructure.UtcNow();
    }
}
