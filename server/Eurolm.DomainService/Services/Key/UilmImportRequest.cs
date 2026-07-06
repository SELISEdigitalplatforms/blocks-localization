using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class UilmImportRequest 
    {
        public string MessageCoRelationId { get; set; }
        public required string FileId { get; set; }
 
    }
}
