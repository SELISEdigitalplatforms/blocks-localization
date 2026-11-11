using DomainService.Storage;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Repositories.UilmStorage;
using Microsoft.Extensions.Logging;
using StorageDriver;
using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace Eurolm.DomainService.Services.UilmStorage
{
    public class UilmFilePublisher : IUilmFilePublisher
    {
        public const string JsonContentType = "application/json";

        private readonly IKeyRepository _keyRepository;
        private readonly IUilmStoredFileRepository _storedFiles;
        private readonly IUilmStorageSettingsRepository _settings;
        private readonly IUilmPublishCounterRepository _counter;
        private readonly UilmStorageInfrastructure _infrastructure;
        private readonly UilmStorageOptions _options;
        private readonly TimeProvider _timeProvider;
        private readonly UilmFileUploader _uploader;
        private readonly ILogger<UilmFilePublisher> _logger;

        private sealed record BuiltFile(UilmFile File, byte[] Bytes, string ContentHash);

        private sealed record Uploaded(BuiltFile Built, string FileId, string Url);

        public UilmFilePublisher(
            IKeyRepository keyRepository,
            IUilmStoredFileRepository storedFiles,
            IUilmStorageSettingsRepository settings,
            IUilmPublishCounterRepository counter,
            IStorageDriverService storageDriver,
            UilmStorageInfrastructure infrastructure,
            ILogger<UilmFilePublisher> logger)
        {
            _keyRepository = keyRepository;
            _storedFiles = storedFiles;
            _settings = settings;
            _counter = counter;
            _infrastructure = infrastructure;
            _options = infrastructure.Options;
            _timeProvider = infrastructure.TimeProvider;
            _uploader = new UilmFileUploader(storedFiles, storageDriver, infrastructure, logger);
            _logger = logger;
        }

        /// <summary>UTF-8 without a byte order mark, so clients that parse the body as JSON never see one.</summary>
        public static byte[] ToBytes(string json) => Encoding.UTF8.GetBytes(json);

        /// <summary>Lowercase hex SHA-256, the pointer's <c>ContentHash</c> and the response's ETag value.</summary>
        public static string Hash(ReadOnlySpan<byte> bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));

        public async Task<UilmPublishSession> BeginAsync(string projectKey, bool forceUpload)
        {
            var mode = await _settings.GetModeAsync();
            var version = await _counter.NextVersionAsync(projectKey);
            return new UilmPublishSession(version, mode.PublishToStorage, forceUpload, mode.KeepContent);
        }

        public async Task<UilmModulePublishResult> PublishModuleAsync(UilmPublishSession session, string moduleName, IReadOnlyList<UilmFile> files)
        {
            return session.PublishToStorage
                ? await PublishToStorageAsync(session, moduleName, files)
                : await PublishContentOnlyAsync(session, moduleName, files);
        }

        private async Task<UilmModulePublishResult> PublishContentOnlyAsync(UilmPublishSession session, string moduleName, IReadOnlyList<UilmFile> files)
        {
            var now = UtcNow();
            var replaced = new List<string>();
            foreach (var file in files)
            {
                var pointer = Pointer(session, moduleName, file, now);
                var write = await _keyRepository.ReplaceUilmFilePointerAsync(pointer);
                if (!write.Applied) continue;
                await _keyRepository.DeleteUilmFileDuplicatesAsync(moduleName, file.Language, pointer.Id);
                if (write.Previous?.FileId is { } previousFileId) replaced.Add(previousFileId);
            }

            await _storedFiles.RetireAsync(replaced, now + _options.RetireDelay);
            await RemoveDroppedLanguagesAsync(moduleName, files, now);
            return new UilmModulePublishResult(0, 0, false);
        }

        private async Task<UilmModulePublishResult> PublishToStorageAsync(UilmPublishSession session, string moduleName, IReadOnlyList<UilmFile> files)
        {
            var built = files.Select(f =>
            {
                var bytes = ToBytes(f.Content ?? string.Empty);
                return new BuiltFile(f, bytes, Hash(bytes));
            }).ToList();
            var current = CurrentPointers(await _keyRepository.GetUilmFilesOfModuleAsync(moduleName));

            var attemptedFileIds = new ConcurrentBag<string>();
            var outcomes = new (bool Skipped, Uploaded? Upload)[built.Count];
            await Parallel.ForEachAsync(
                Enumerable.Range(0, built.Count),
                new ParallelOptions { MaxDegreeOfParallelism = _options.UploadParallelism },
                async (index, _) =>
                {
                    var file = built[index];
                    current.TryGetValue(file.File.Language, out var pointer);
                    outcomes[index] = await CanSkipAsync(session, file, pointer)
                        ? (true, null)
                        : (false, await UploadAsync(moduleName, file, attemptedFileIds));
                });

            var skipped = outcomes.Count(o => o.Skipped);
            var uploads = outcomes.Where(o => !o.Skipped).Select(o => o.Upload).ToList();
            if (uploads.Exists(u => u is null))
            {
                // Pointers stay as they are; nothing uploaded in this run may stay in Storage.
                await _storedFiles.RetireAsync(attemptedFileIds.ToList(), UtcNow());
                _logger.LogError("UILM publish of module {ModuleName} failed: {FailedCount} of {UploadCount} uploads failed; its pointers were kept",
                    moduleName, uploads.Count(u => u is null), uploads.Count);
                return new UilmModulePublishResult(0, skipped, true);
            }

            var now = UtcNow();
            var live = new List<string>();
            var superseded = new List<string>();
            var replaced = new List<string>();
            foreach (var upload in uploads.Select(u => u!))
            {
                var pointer = Pointer(session, moduleName, upload.Built.File, now);
                pointer.FileId = upload.FileId;
                pointer.Url = upload.Url;
                pointer.ContentHash = upload.Built.ContentHash;
                pointer.Size = upload.Built.Bytes.LongLength;
                if (!session.KeepContent)
                {
                    // #349 §6.4: the file is the only copy; restore writes Content back from Storage if needed. The
                    // model keeps Content non-nullable for legacy rows (out of scope to change), hence null!.
                    pointer.Content = null!;
                }

                var write = await _keyRepository.ReplaceUilmFilePointerAsync(pointer);
                if (!write.Applied)
                {
                    // A concurrent publish with a higher version already switched this pointer.
                    superseded.Add(upload.FileId);
                    continue;
                }
                await _keyRepository.DeleteUilmFileDuplicatesAsync(moduleName, pointer.Language, pointer.Id);
                live.Add(upload.FileId);
                if (write.Previous?.FileId is { } previousFileId && previousFileId != upload.FileId) replaced.Add(previousFileId);
            }

            await _storedFiles.MarkLiveAsync(live, UilmStoredFileState.Uploading);
            await _storedFiles.RetireAsync(superseded, now);
            await _storedFiles.RetireAsync(replaced, now + _options.RetireDelay);
            await RemoveDroppedLanguagesAsync(moduleName, files, now);

            _logger.LogInformation("UILM publish of module {ModuleName} version {Version}: {UploadedCount} uploaded, {SkippedCount} unchanged, {SupersededCount} superseded",
                moduleName, session.Version, uploads.Count, skipped, superseded.Count);
            return new UilmModulePublishResult(uploads.Count, skipped, false);
        }

        /// <summary>The row each language is served from today: its highest version (legacy rows have none).</summary>
        private static Dictionary<string, UilmFile> CurrentPointers(List<UilmFile> rows) => rows
            .Where(r => r.Version != null && r.Language != null)
            .GroupBy(r => r.Language, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.MaxBy(r => r.Version)!, StringComparer.Ordinal);

        private static UilmFile Pointer(UilmPublishSession session, string moduleName, UilmFile file, DateTime now) => new()
        {
            Id = UilmFile.PointerId(moduleName, file.Language),
            ModuleName = moduleName,
            Language = file.Language,
            Content = file.Content,
            Version = session.Version,
            PublishedAt = now
        };

        /// <summary>Removes pointers of languages that are no longer configured and retires their files.</summary>
        private async Task RemoveDroppedLanguagesAsync(string moduleName, IReadOnlyList<UilmFile> files, DateTime now)
        {
            var languages = files.Select(f => f.Language).Distinct(StringComparer.Ordinal).ToList();
            var removed = await _keyRepository.DeleteUilmFilesOfOtherLanguagesAsync(moduleName, languages);
            var removedFileIds = removed.Where(r => r.FileId != null).Select(r => r.FileId!).ToList();
            await _storedFiles.RetireAsync(removedFileIds, now + _options.RetireDelay);
            if (removed.Count > 0)
            {
                _logger.LogInformation("UILM publish of module {ModuleName} removed {RemovedCount} files of languages that are no longer configured",
                    moduleName, removed.Count);
            }
        }

        private async Task<bool> CanSkipAsync(UilmPublishSession session, BuiltFile file, UilmFile? pointer)
        {
            if (session.ForceUpload || pointer?.FileId == null || pointer.ContentHash != file.ContentHash || string.IsNullOrEmpty(pointer.Url))
            {
                return false;
            }
            // The same bytes are already published; upload again only if the file is gone from Storage. A pointer
            // whose file isn't in this tenant's ledger (a copied row) is never requested and is replaced.
            return await _storedFiles.ExistsAsync(pointer.FileId) && await ExistsInStorageAsync(pointer.Url);
        }

        private async Task<Uploaded?> UploadAsync(string moduleName, BuiltFile file, ConcurrentBag<string> attemptedFileIds)
        {
            var outcome = await _uploader.UploadAsync(moduleName, file.File.Language, file.Bytes, attemptedFileIds);
            return outcome.Upload == null ? null : new Uploaded(file, outcome.Upload.FileId, outcome.Upload.Url);
        }

        private async Task<bool> ExistsInStorageAsync(string url)
        {
            try
            {
                using var timeout = new CancellationTokenSource(_options.StorageFetchTimeout, _timeProvider);
                using var request = new HttpRequestMessage(HttpMethod.Head, url);
                using var response = await _infrastructure.CreateHttpClient().SendAsync(request, timeout.Token);
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException or InvalidOperationException or UriFormatException)
            {
                return false;
            }
        }

        private DateTime UtcNow() => _infrastructure.UtcNow();
    }
}
