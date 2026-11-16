using Blocks.Genesis.Entities.Data;
using DomainService.Storage;
using Eurolm.DomainService.Repositories.UilmStorage;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using StorageDriver;
using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;

namespace Eurolm.DomainService.Services.UilmStorage
{
    /// <summary>An uploaded file: its Storage id and public URL.</summary>
    internal sealed record UilmUpload(string FileId, string Url);

    /// <summary>Result of one upload: the file, or why it failed.</summary>
    internal sealed record UilmUploadOutcome(UilmUpload? Upload, string Failure);

    /// <summary>
    /// Uploads one UILM file to Storage under a new file id (#348 spec 6.8.3), shared by publish and backfill. The ledger
    /// row is written first, so a crash never leaves a file the tenant doesn't know about.
    /// </summary>
    internal sealed class UilmFileUploader
    {
        private const string FileTags = "[\"UilmFile\"]";

        private readonly IUilmStoredFileRepository _storedFiles;
        private readonly IStorageDriverService _storageDriver;
        private readonly UilmStorageInfrastructure _infrastructure;
        private readonly UilmStorageOptions _options;
        private readonly ILogger _logger;

        public UilmFileUploader(IUilmStoredFileRepository storedFiles, IStorageDriverService storageDriver,
            UilmStorageInfrastructure infrastructure, ILogger logger)
        {
            _storedFiles = storedFiles;
            _storageDriver = storageDriver;
            _infrastructure = infrastructure;
            _options = infrastructure.Options;
            _logger = logger;
        }

        /// <summary>
        /// Uploads <paramref name="bytes"/>; the new file id is added to <paramref name="attemptedFileIds"/> once its
        /// ledger row exists, so the caller can retire it when the upload or the pointer switch fails.
        /// </summary>
        public async Task<UilmUploadOutcome> UploadAsync(string moduleName, string language, byte[] bytes, ConcurrentBag<string> attemptedFileIds)
        {
            var fileId = Guid.NewGuid().ToString();
            try
            {
                await _storedFiles.InsertAsync(new UilmStoredFile
                {
                    Id = fileId,
                    ModuleName = moduleName,
                    Language = language,
                    State = UilmStoredFileState.Uploading,
                    CreatedAt = _infrastructure.UtcNow()
                });
                attemptedFileIds.Add(fileId);

                var upload = await _storageDriver.GetPerSignedUrlForUploadAsync(new GetPreSignedUrlForUploadRequest
                {
                    ItemId = fileId,
                    Name = $"{moduleName}.{language}.json",
                    MetaData = JsonConvert.SerializeObject(new Dictionary<string, object>()),
                    ParentDirectoryId = string.Empty,
                    Tags = FileTags,
                    AccessModifier = "Public",
                    ContentType = UilmFilePublisher.JsonContentType,
                    SizeInBytes = bytes.LongLength,
                    ModuleName = ModuleName.Localization,
                });
                if (upload == null || string.IsNullOrEmpty(upload.UploadUrl))
                {
                    _logger.LogError("UILM upload of {ModuleName}/{Language} (file {FileId}) got no upload URL", moduleName, language, fileId);
                    return Failed("no upload URL");
                }

                var put = await PutWithRetriesAsync(upload, bytes, moduleName, language, fileId);
                if (put != null)
                {
                    return Failed(put);
                }

                if (upload.UploadCompletionRequired && !await CompleteAsync(upload, moduleName, language, fileId))
                {
                    return Failed("rejected by Storage");
                }

                var stored = await _storageDriver.GetUrlForDownloadFileAsync(new GetFileRequest { FileId = fileId });
                if (string.IsNullOrEmpty(stored?.Url))
                {
                    _logger.LogError("UILM upload of {ModuleName}/{Language} (file {FileId}) got no download URL", moduleName, language, fileId);
                    return Failed("no download URL");
                }
                return new UilmUploadOutcome(new UilmUpload(fileId, stored.Url), string.Empty);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UILM upload of {ModuleName}/{Language} (file {FileId}) failed", moduleName, language, fileId);
                return Failed(ex.GetType().Name);
            }
        }

        private static UilmUploadOutcome Failed(string failure) => new(null, failure);

        private async Task<bool> CompleteAsync(GetPreSignedUrlForUploadResponse upload, string moduleName, string language, string fileId)
        {
            var completion = await _storageDriver.CompleteUploadAsync(new CompleteUploadRequest
            {
                FileId = fileId,
                FileVersionId = upload.FileVersionId,
            });
            if (completion?.VerificationStatus == FileVerificationStatus.Verified)
            {
                return true;
            }
            _logger.LogError("UILM upload of {ModuleName}/{Language} (file {FileId}) was rejected by Storage: {RejectionReason}",
                moduleName, language, fileId, completion?.RejectionReason);
            return false;
        }

        /// <summary>
        /// PUTs the bytes to the pre-signed URL, retrying network errors, timeouts and HTTP 5xx/429 after each of
        /// <see cref="UilmStorageOptions.UploadRetryDelays"/>. Other responses fail at once. Returns null on success,
        /// else the last failure.
        /// </summary>
        private async Task<string?> PutWithRetriesAsync(GetPreSignedUrlForUploadResponse upload, byte[] bytes, string moduleName, string language, string fileId)
        {
            var client = _infrastructure.CreateHttpClient();
            var retries = _options.UploadRetryDelays.Count;
            var failure = string.Empty;
            for (var attempt = 0; attempt <= retries; attempt++)
            {
                if (attempt > 0)
                {
                    await Task.Delay(_options.UploadRetryDelays[attempt - 1], _infrastructure.TimeProvider);
                }

                (var succeeded, var retryable, failure) = await PutOnceAsync(client, upload, bytes);
                if (succeeded)
                {
                    return null;
                }
                if (!retryable)
                {
                    _logger.LogError("UILM upload of {ModuleName}/{Language} (file {FileId}) was refused: {Failure}",
                        moduleName, language, fileId, failure);
                    return failure;
                }
                if (attempt < retries)
                {
                    _logger.LogWarning("UILM upload of {ModuleName}/{Language} (file {FileId}) attempt {Attempt} failed ({Failure}); retrying",
                        moduleName, language, fileId, attempt + 1, failure);
                }
                else
                {
                    _logger.LogError("UILM upload of {ModuleName}/{Language} (file {FileId}) failed after {Attempts} attempts: {Failure}",
                        moduleName, language, fileId, attempt + 1, failure);
                }
            }
            return failure;
        }

        /// <summary>One PUT within the upload timeout: whether it succeeded, whether a failure may be retried, and why.</summary>
        private async Task<(bool Succeeded, bool Retryable, string Failure)> PutOnceAsync(HttpClient client, GetPreSignedUrlForUploadResponse upload, byte[] bytes)
        {
            try
            {
                using var timeout = new CancellationTokenSource(_options.UploadTimeout, _infrastructure.TimeProvider);
                using var request = PutRequest(upload, bytes);
                using var response = await client.SendAsync(request, timeout.Token);
                return response.IsSuccessStatusCode
                    ? (true, false, string.Empty)
                    : (false, IsRetryable(response.StatusCode), $"HTTP {(int)response.StatusCode}");
            }
            catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException)
            {
                return (false, true, ex.GetType().Name);
            }
        }

        private static HttpRequestMessage PutRequest(GetPreSignedUrlForUploadResponse upload, byte[] bytes)
        {
            var content = new ByteArrayContent(bytes);
            content.Headers.ContentType = new MediaTypeHeaderValue(UilmFilePublisher.JsonContentType);
            var request = new HttpRequestMessage(HttpMethod.Put, upload.UploadUrl) { Content = content };
            if (upload.RequiredHeaders is { Count: > 0 } headers)
            {
                foreach (var (name, value) in headers)
                {
                    if (!request.Headers.TryAddWithoutValidation(name, value))
                    {
                        content.Headers.Remove(name);
                        content.Headers.TryAddWithoutValidation(name, value);
                    }
                }
            }
            else
            {
                // Same header the export upload (StorageHelper) sends; Azure needs it for a block blob.
                request.Headers.Add("x-ms-blob-type", "BlockBlob");
            }
            return request;
        }

        private static bool IsRetryable(HttpStatusCode status) => (int)status >= 500 || status == HttpStatusCode.TooManyRequests;
    }
}
