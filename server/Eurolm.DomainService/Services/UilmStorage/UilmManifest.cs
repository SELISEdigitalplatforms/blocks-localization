using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MongoDB.Bson.Serialization.Attributes;

namespace Eurolm.DomainService.Services.UilmStorage
{
    /// <summary>
    /// Query of <c>GET Key/GetUilmManifest</c>. Both filters are optional, exact and case-sensitive, like
    /// <c>GetUilmFile</c>; a missing or empty value means no filter.
    /// </summary>
    public class GetUilmManifestRequest
    {
        public string? ModuleName { get; set; }
        public string? Language { get; set; }
    }

    /// <summary>
    /// The tenant's published files with their public Storage URLs, so a client can download them directly
    /// (spec 4, section 6).
    /// <para>Client contract:</para>
    /// <list type="bullet">
    /// <item>Send the last manifest's <c>ETag</c> as <c>If-None-Match</c>; <c>304</c> means nothing changed.</item>
    /// <item>Download each entry's <see cref="UilmManifestEntry.Url"/> without credentials (<c>credentials: "omit"</c>).
    /// The file never changes behind its URL; optionally verify its SHA-256 against <see cref="UilmManifestEntry.Hash"/>.</item>
    /// <item>A <c>null</c> entry (all of <c>url</c>, <c>hash</c>, <c>size</c> and <c>version</c> are <c>null</c>) means
    /// "fall back to <c>GetUilmFile</c>": the file is not in Storage, so call <c>GetUilmFile</c> with the same
    /// <c>ModuleName</c> and <c>Language</c>.</item>
    /// <item>On any download failure (for example <c>404</c> once a replaced file's 24-hour grace period has passed),
    /// also fall back to <c>GetUilmFile</c>.</item>
    /// </list>
    /// </summary>
    public sealed class UilmManifest
    {
        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

        /// <summary>The highest <see cref="UilmManifestEntry.Version"/> among the entries; <c>0</c> when none has one.</summary>
        public int Version { get; init; }

        /// <summary>One entry per module and language, sorted by module, then language (ordinal).</summary>
        public IReadOnlyList<UilmManifestEntry> Files { get; init; } = [];

        /// <summary>
        /// Builds the manifest from the rows the reader would serve. An entry gets its file only when the pointer's
        /// file is <c>Live</c> in the tenant's ledger; any other row (legacy, Storage off, a foreign pointer or a file
        /// not <c>Live</c>) becomes a <c>null</c> entry.
        /// </summary>
        public static UilmManifest FromRows(IEnumerable<UilmManifestRow> rows)
        {
            var files = rows
                .Select(UilmManifestEntry.FromRow)
                .OrderBy(e => e.ModuleName, StringComparer.Ordinal)
                .ThenBy(e => e.Language, StringComparer.Ordinal)
                .ToList();
            return new UilmManifest
            {
                Version = files.Max(e => e.Version) ?? 0,
                Files = files
            };
        }

        /// <summary>
        /// The manifest's ETag value: lowercase hex SHA-256 over the lines <c>moduleName\tlanguage\thash-or-empty\n</c>
        /// in response order.
        /// </summary>
        public string ComputeHash()
        {
            var lines = new StringBuilder();
            foreach (var file in Files)
            {
                lines.Append(file.ModuleName).Append('\t').Append(file.Language).Append('\t').Append(file.Hash).Append('\n');
            }
            return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(lines.ToString())));
        }

        /// <summary>The response body: camelCase JSON in UTF-8, <c>null</c> fields written.</summary>
        public byte[] ToJsonBytes() => JsonSerializer.SerializeToUtf8Bytes(this, JsonOptions);
    }

    /// <summary>
    /// One module and language. <see cref="Url"/>, <see cref="Hash"/>, <see cref="Size"/> and <see cref="Version"/>
    /// are either all set or all <c>null</c>; <c>null</c> means "fall back to <c>GetUilmFile</c>" for this file.
    /// </summary>
    public sealed class UilmManifestEntry
    {
        public string ModuleName { get; init; } = string.Empty;
        public string Language { get; init; } = string.Empty;

        /// <summary>Public Storage URL of the current file; download it without credentials.</summary>
        public string? Url { get; init; }

        /// <summary>Lowercase hex SHA-256 of the file's bytes, the same value as <c>GetUilmFile</c>'s ETag.</summary>
        public string? Hash { get; init; }

        /// <summary>The file's size in bytes.</summary>
        public long? Size { get; init; }

        /// <summary>The publish version that produced the file.</summary>
        public int? Version { get; init; }

        internal static UilmManifestEntry FromRow(UilmManifestRow row)
        {
            var live = row.LedgerState == UilmStoredFileState.Live
                && !string.IsNullOrEmpty(row.FileId)
                && !string.IsNullOrEmpty(row.Url)
                && !string.IsNullOrEmpty(row.ContentHash)
                && row.Size != null
                && row.Version != null;
            return live
                ? new UilmManifestEntry
                {
                    ModuleName = row.ModuleName, Language = row.Language,
                    Url = row.Url, Hash = row.ContentHash, Size = row.Size, Version = row.Version
                }
                : new UilmManifestEntry { ModuleName = row.ModuleName, Language = row.Language };
        }
    }

    /// <summary>
    /// The row <c>GetUilmFile</c> would serve for one module and language, without its <c>Content</c>, plus the
    /// state of its file in the tenant's <c>UilmStoredFiles</c> ledger (<c>null</c> when the ledger has no such file).
    /// </summary>
    [BsonIgnoreExtraElements]
    public sealed class UilmManifestRow
    {
        public string ModuleName { get; set; } = string.Empty;
        public string Language { get; set; } = string.Empty;
        public string? FileId { get; set; }
        public string? Url { get; set; }
        public string? ContentHash { get; set; }
        public long? Size { get; set; }
        public int? Version { get; set; }
        public string? LedgerState { get; set; }
    }
}
