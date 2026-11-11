namespace Eurolm.DomainService.Services.UilmStorage
{
    /// <summary>Resolves what <c>GetUilmFile</c> and <c>GetCloudUilmFile</c> answer (spec 6.7).</summary>
    public interface IUilmFileReader
    {
        /// <param name="ifNoneMatch">The request's <c>If-None-Match</c> header, if any.</param>
        Task<UilmFileReadResult> ReadAsync(GetUilmFileRequest request, string? ifNoneMatch);
    }

    public enum UilmFileReadKind
    {
        /// <summary>No row: 200 with an empty body.</summary>
        NoFile,
        /// <summary>A row served from its stored content (legacy, switch off or Storage fallback): 200, no ETag.</summary>
        Content,
        /// <summary>The Storage file's verified bytes: 200 with ETag.</summary>
        File,
        /// <summary>The client's copy is current: 304 with ETag.</summary>
        NotModified,
        /// <summary>The Storage file can't be read and the row has no content: 503.</summary>
        Unavailable
    }

    public sealed record UilmFileReadResult(UilmFileReadKind Kind, string? Content = null, byte[]? Bytes = null, string? ETag = null)
    {
        public static readonly UilmFileReadResult NoFile = new(UilmFileReadKind.NoFile);
        public static readonly UilmFileReadResult Unavailable = new(UilmFileReadKind.Unavailable);
    }
}
