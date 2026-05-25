using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class GetLocalizationTimelineRequest : IProjectKey
    {
        public int PageSize { get; set; } = 10;
        public int PageNumber { get; set; } = 1;
        public string? UserId { get; set; }
        public string? LogFrom { get; set; }
        public List<string>? LogFromValues { get; set; }
        public List<string>? ExcludeLogFromValues { get; set; }
        public DateRange? CreateDateRange { get; set; }
        public string? SortProperty { get; set; } = "CreateDate";
        public bool IsDescending { get; set; } = true;
        public string? ProjectKey { get; set; }
    }
}
