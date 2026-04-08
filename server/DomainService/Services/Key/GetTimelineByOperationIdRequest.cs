using Blocks.Genesis;

namespace BlocksTemplate.DomainService.Services
{
    public class GetTimelineByOperationIdRequest : IProjectKey
    {
        public string OperationId { get; set; } = string.Empty;
        public int PageSize { get; set; } = 10;
        public int PageNumber { get; set; } = 1;
        public string? ProjectKey { get; set; }
    }
}
