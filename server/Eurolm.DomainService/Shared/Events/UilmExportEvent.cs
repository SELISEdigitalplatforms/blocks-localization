using Eurolm.DomainService.Shared.Utilities;

namespace Eurolm.DomainService.Shared.Events
{
    public class UilmExportEvent
    {
        public string? MessageCoRelationId { get; set; }
        public required string FileId { get; set; }
        public string? ProjectKey { get; set; }
        public OutputType OutputType { get; set; }
        public List<string> AppIds { get; set; } = null;
        public List<string> Languages { get; set; }
        public string ReferenceFileId { get; set; }
        public string CallerTenantId { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
    }
}
