using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class GetUilmExportedFilesRequest 
    {
        public int PageSize { get; set; } = 10;
        public int PageNumber { get; set; } = 0;
        public string? SearchText { get; set; } // Regex-based search filter
        public DateRange? CreateDateRange { get; set; } // Date range filter on CreateDate
    }
}
