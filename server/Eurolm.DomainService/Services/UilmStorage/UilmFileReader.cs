using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Repositories.UilmStorage;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace Eurolm.DomainService.Services.UilmStorage
{
    /// <summary>
    /// Serves published files from a size-limited memory cache or from Storage, verified against the pointer's
    /// SHA-256 before they are cached or served. The cache belongs to this reader alone, so no other cache user has
    /// to give its entries a size.
    /// </summary>
    public sealed class UilmFileReader : IUilmFileReader, IDisposable
    {
        private readonly IKeyRepository _keyRepository;
        private readonly IUilmStoredFileRepository _storedFiles;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly UilmStorageOptions _options;
        private readonly ILogger<UilmFileReader> _logger;
        private readonly MemoryCache _cache;

        public UilmFileReader(
            IKeyRepository keyRepository,
            IUilmStoredFileRepository storedFiles,
            IHttpClientFactory httpClientFactory,
            UilmStorageOptions options,
            ILogger<UilmFileReader> logger)
        {
            _keyRepository = keyRepository;
            _storedFiles = storedFiles;
            _httpClientFactory = httpClientFactory;
            _options = options;
            _logger = logger;
            _cache = new MemoryCache(new MemoryCacheOptions { SizeLimit = options.CacheSizeLimitBytes });
        }

        /// <summary>The cache key: the tenant is part of it, so one tenant's entry is never served to another.</summary>
        public static string CacheKey(string tenantId, string fileId) => $"uilm:{tenantId}:{fileId}";

        public async Task<UilmFileReadResult> ReadAsync(GetUilmFileRequest request, string? ifNoneMatch)
        {
            var row = await _keyRepository.GetUilmFile(request);
            if (row == null)
            {
                return UilmFileReadResult.NoFile;
            }
            if (string.IsNullOrEmpty(row.FileId) || string.IsNullOrEmpty(row.ContentHash))
            {
                return new UilmFileReadResult(UilmFileReadKind.Content, row.Content ?? string.Empty);
            }

            var cacheKey = CacheKey(BlocksContext.GetContext()?.TenantId ?? string.Empty, row.FileId);
            var cached = _cache.Get<byte[]>(cacheKey);
            if (cached == null && !await _storedFiles.ExistsAsync(row.FileId))
            {
                // A pointer this tenant never uploaded (for example a row copied from another database): its URL is
                // not fetched, and the row is served like a legacy row.
                _logger.LogWarning("UilmForeignPointer: module {ModuleName} language {Language} points at file {FileId}, which is not in the tenant's ledger",
                    row.ModuleName, row.Language, row.FileId);
                return FromContent(row);
            }

            var etag = $"\"{row.ContentHash}\"";
            if (IfNoneMatchMatches(ifNoneMatch, row.ContentHash))
            {
                return new UilmFileReadResult(UilmFileReadKind.NotModified, ETag: etag);
            }

            var bytes = cached ?? await FetchAsync(row, cacheKey);
            return bytes == null
                ? FromContent(row)
                : new UilmFileReadResult(UilmFileReadKind.File, Bytes: bytes, ETag: etag);
        }

        private UilmFileReadResult FromContent(UilmFile row)
        {
            if (row.Content != null)
            {
                return new UilmFileReadResult(UilmFileReadKind.Content, row.Content);
            }
            _logger.LogError("UILM file of module {ModuleName} language {Language} (file {FileId}) can't be served: Storage failed and the row has no content",
                row.ModuleName, row.Language, row.FileId);
            return UilmFileReadResult.Unavailable;
        }

        /// <summary>
        /// Matches each comma-separated entity tag, ignoring a weak <c>W/</c> prefix; <c>*</c> matches any file.
        /// </summary>
        public static bool IfNoneMatchMatches(string? ifNoneMatch, string contentHash)
        {
            if (string.IsNullOrWhiteSpace(ifNoneMatch))
            {
                return false;
            }
            foreach (var part in ifNoneMatch.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
            {
                if (part == "*")
                {
                    return true;
                }
                var tag = part.StartsWith("W/", StringComparison.Ordinal) ? part[2..] : part;
                if (string.Equals(tag.Trim('"'), contentHash, StringComparison.Ordinal))
                {
                    return true;
                }
            }
            return false;
        }

        /// <summary>Downloads and verifies the file; null (logged, without content) when that fails.</summary>
        private async Task<byte[]?> FetchAsync(UilmFile row, string cacheKey)
        {
            string reason;
            try
            {
                using var timeout = new CancellationTokenSource(_options.StorageFetchTimeout);
                using var response = await _httpClientFactory.CreateClient(UilmStorageHttp.ClientName)
                    .GetAsync(row.Url, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
                if (response.IsSuccessStatusCode)
                {
                    var bytes = await response.Content.ReadAsByteArrayAsync(timeout.Token);
                    if (UilmFilePublisher.Hash(bytes) == row.ContentHash)
                    {
                        _cache.Set(cacheKey, bytes, new MemoryCacheEntryOptions
                        {
                            Size = bytes.LongLength,
                            SlidingExpiration = _options.CacheSlidingExpiration
                        });
                        return bytes;
                    }
                    reason = "content hash mismatch";
                }
                else
                {
                    reason = $"HTTP {(int)response.StatusCode}";
                }
            }
            catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException or InvalidOperationException)
            {
                reason = ex is OperationCanceledException ? "timeout" : ex.GetType().Name;
            }

            _logger.LogWarning("UilmStorageReadFallback: module {ModuleName} language {Language} file {FileId}: {Reason}",
                row.ModuleName, row.Language, row.FileId, reason);
            return null;
        }

        public void Dispose() => _cache.Dispose();
    }
}
