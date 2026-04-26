using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class GetUilmExportedFilesRequest : IProjectKey
    {
        public int PageSize { get; set; } = 10;
        public int PageNumber { get; set; } = 0;
        public string? ProjectKey { get; set; }
        public string? SearchText { get; set; } // Regex-based search filter
        public DateRange? CreateDateRange { get; set; } // Date range filter on CreateDate
    }
}
