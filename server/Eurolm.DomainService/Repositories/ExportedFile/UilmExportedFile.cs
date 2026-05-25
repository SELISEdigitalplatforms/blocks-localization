using MongoDB.Bson.Serialization.Attributes;

namespace Eurolm.DomainService.Repositories
{
    [BsonIgnoreExtraElements]
    public class UilmExportedFile
    {
        [BsonId]
        public required string FileId { get; set; }
        public required string FileName { get; set; }
        public DateTime CreateDate { get; set; }
        public required string CreatedBy { get; set; }
    }
}
