using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class GetGlossariesRequest 
    {
        public string? SearchText { get; set; }
        public int PageNumber { get; set; } = 0;
        public int PageSize { get; set; } = 20;
        public bool? IsGlobal { get; set; }
        public string? ModuleId { get; set; }
    }
}
