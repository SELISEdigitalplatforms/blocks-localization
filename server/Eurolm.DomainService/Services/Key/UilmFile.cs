using MongoDB.Bson.Serialization.Attributes;

namespace Eurolm.DomainService.Services
{
    /// <summary>
    /// One published module/language file. Legacy rows (random <see cref="Id"/>) carry only <see cref="Content"/>.
    /// Rows written by a publish use the deterministic id <c>"{ModuleName}|{Language}"</c> and a <see cref="Version"/>;
    /// with Storage publishing on they also point at the uploaded file (<see cref="FileId"/>, <see cref="Url"/>).
    /// </summary>
    [BsonIgnoreExtraElements]
    public class UilmFile
    {
        [BsonId]
        public string Id { get; set; }
        public string TenantId { get; set; }
        public string ModuleName { get; set; }
        public string Language { get; set; }
        public string Content { get; set; }

        /// <summary>Storage file id; null for legacy rows and while Storage publishing is off.</summary>
        public string? FileId { get; set; }

        /// <summary>Public Storage URL of <see cref="FileId"/>.</summary>
        public string? Url { get; set; }

        /// <summary>Lowercase hex SHA-256 of the exact uploaded bytes.</summary>
        public string? ContentHash { get; set; }

        /// <summary>Byte length of the uploaded file.</summary>
        public long? Size { get; set; }

        /// <summary>The publish version that produced this row; rows with a version win over legacy rows.</summary>
        public int? Version { get; set; }

        public DateTime? PublishedAt { get; set; }

        public static string PointerId(string moduleName, string language) => $"{moduleName}|{language}";
    }

    /// <summary>
    /// Result of a conditional pointer write: <see cref="Applied"/> is false when the stored row already has the same
    /// or a higher version; <see cref="Previous"/> is the row the write replaced (null when it inserted one).
    /// </summary>
    public sealed record UilmFilePointerWrite(bool Applied, UilmFile? Previous);
}
