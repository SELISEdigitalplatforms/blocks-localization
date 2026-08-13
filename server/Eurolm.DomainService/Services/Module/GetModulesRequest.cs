namespace Eurolm.DomainService.Services
{
    public class GetModulesRequest
    {
        public string? SearchText { get; set; }
        public int PageNumber { get; set; } = 0;
        public int PageSize { get; set; } = 20;
        public DateRange? CreateDateRange { get; set; }
        public DateRange? LastUpdateDateRange { get; set; }
        public string? SortProperty { get; set; }
        public bool IsDescending { get; set; }
    }
}
