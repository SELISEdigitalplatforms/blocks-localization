using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class GetKeysRequest 
    {
        public int PageSize { get; set; }
        public int PageNumber { get; set; }
        public string? KeySearchText { get; set; }
        public string? SearchKey { get; set; }
        public string[]? ModuleIds { get; set; }
        public bool IsPartiallyTranslated { get; set; }
        public List<string>? MissingLanguages { get; set; }
        public DateRange? CreateDateRange { get; set; }
        public string? SortProperty { get; set; }
        public bool IsDescending { get; set; }
        public ResourceSearchFilter[]? ResourceSearchFilters { get; set; }
        public DateRange? LastUpdateDateRange { get; set; }
        public string? GlossaryId { get; set; }

        /// <summary>
        /// Opaque keyset token from a previous response's NextCursor. When set, PageNumber is ignored
        /// and the next PageSize keys after the cursor position are returned.
        /// </summary>
        public string? Cursor { get; set; }

        /// <summary>
        /// When false the CountDocuments scan is skipped and TotalCount is null. Defaults to true.
        /// </summary>
        public bool? IncludeTotalCount { get; set; }
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
