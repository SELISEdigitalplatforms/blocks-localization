using MongoDB.Bson.Serialization.Attributes;

namespace Eurolm.DomainService.Repositories
{
    [BsonIgnoreExtraElements]
    public class LanguageFileGenerationHistory
    {
        [BsonId]
        public required string ItemId { get; set; }
        public DateTime CreateDate { get; set; }
        public int Version { get; set; }
        public string? ModuleId { get; set; }
        public required string ProjectKey { get; set; }

        /// <summary><see cref="LanguageFileGenerationStatus"/>; null on rows written before Storage publishing.</summary>
        public string? Status { get; set; }
        public int UploadedFiles { get; set; }
        public int SkippedFiles { get; set; }
        public List<string>? FailedModules { get; set; }
    }

    public static class LanguageFileGenerationStatus
    {
        public const string Success = "Success";
        public const string Partial = "Partial";
        public const string Failed = "Failed";
    }
}
