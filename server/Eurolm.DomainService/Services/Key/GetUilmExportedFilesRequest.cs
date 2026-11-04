using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class GetUilmExportedFilesRequest 
    {
        public int PageSize { get; set; } = 10;
        public int PageNumber { get; set; } = 0;
        public string? SearchText { get; set; } // Case-insensitive "contains" match on FileName, taken literally
        public DateRange? CreateDateRange { get; set; } // Date range filter on CreateDate
    }
}
