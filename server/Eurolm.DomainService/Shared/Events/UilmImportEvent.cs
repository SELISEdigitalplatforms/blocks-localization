namespace Eurolm.DomainService.Shared.Events
{
    public class UilmImportEvent
    {
        public string? MessageCoRelationId { get; set; }
        public required string FileId { get; set; }
        public string? ProjectKey { get; set; }
    }
}