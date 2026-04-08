using Blocks.Genesis;

namespace BlocksTemplate.DomainService.Services
{
    public class UilmImportRequest : IProjectKey
    {
        public string MessageCoRelationId { get; set; }
        public required string FileId { get; set; }
        public string? ProjectKey { get; set; }
    }
}
