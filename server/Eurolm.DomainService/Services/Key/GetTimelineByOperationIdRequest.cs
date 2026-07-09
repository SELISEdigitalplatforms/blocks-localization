using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class GetTimelineByOperationIdRequest 
    {
        public string OperationId { get; set; } = string.Empty;
        public int PageSize { get; set; } = 10;
        public int PageNumber { get; set; } = 1;
    }
}
