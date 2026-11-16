using MongoDB.Bson.Serialization.Attributes;

namespace Eurolm.DomainService.Services.UilmStorage
{
    /// <summary>
    /// Ledger row of one uploaded Storage file (<c>UilmStoredFiles</c>). The row is written before the upload starts,
    /// so a crash never leaves a file the tenant doesn't know about. The row is removed once the file is deleted.
    /// </summary>
    [BsonIgnoreExtraElements]
    public class UilmStoredFile
    {
        /// <summary>The Storage file id.</summary>
        [BsonId]
        public string Id { get; set; } = string.Empty;
        public string ModuleName { get; set; } = string.Empty;
        public string Language { get; set; } = string.Empty;

        /// <summary><see cref="UilmStoredFileState"/>.</summary>
        public string State { get; set; } = UilmStoredFileState.Uploading;
        public DateTime CreatedAt { get; set; }

        /// <summary>Set when retired: maintenance deletes the file after this time.</summary>
        public DateTime? DeleteAfter { get; set; }

        /// <summary>Set while a maintenance run owns the row.</summary>
        public DateTime? LeaseUntil { get; set; }

        /// <summary>Failed delete attempts.</summary>
        public int Attempts { get; set; }
    }

    public static class UilmStoredFileState
    {
        public const string Uploading = "Uploading";
        public const string Live = "Live";
        public const string Retired = "Retired";
    }
}
