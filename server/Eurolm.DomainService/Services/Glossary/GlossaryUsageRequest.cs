namespace Eurolm.DomainService.Services
{
    public class GlossaryUsageRequest
    {
        public string ItemId { get; set; } = "";
        public int PageNumber { get; set; } = 0;
        public int PageSize { get; set; } = 10;
    }
}
