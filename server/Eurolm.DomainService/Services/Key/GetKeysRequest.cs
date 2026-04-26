using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class GetKeysRequest : IProjectKey
    {
        public int PageSize { get; set; }
        public int PageNumber { get; set; }
        public string? KeySearchText { get; set; }
        public string? SearchKey { get; set; }
        public string[]? ModuleIds { get; set; }
        public bool IsPartiallyTranslated { get; set; }
        public DateRange? CreateDateRange { get; set; }
        public string? SortProperty { get; set; }
        public bool IsDescending { get; set; }
        public string? ProjectKey { get; set; }
        public ResourceSearchFilter[]? ResourceSearchFilters { get; set; }
        public DateRange? LastUpdateDateRange { get; set; }
    }

    public class ResourceSearchFilter
    {
        public string Culture { get; set; } = string.Empty;
        public string SearchText { get; set; } = string.Empty;
    }

    public class DateRange
    {
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
    }
}
