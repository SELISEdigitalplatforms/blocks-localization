using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class GetKeyTimelineRequest 
    {
        public int PageSize { get; set; } = 10;
        public int PageNumber { get; set; } = 1;
        public string? EntityId { get; set; } // Key ItemId to filter timeline for specific key
        public string? UserId { get; set; } // Filter by user who made changes
        public DateRange? CreateDateRange { get; set; }
        public string? SortProperty { get; set; } = "CreateDate";
        public bool IsDescending { get; set; } = true;
    }
}
