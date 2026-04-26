using Blocks.Genesis;

namespace BlocksTemplate.DomainService.Services
{
    public class GetGlossariesRequest : IProjectKey
    {
        public string? ProjectKey { get; set; }
        public string? SearchText { get; set; }
        public int PageNumber { get; set; } = 0;
        public int PageSize { get; set; } = 20;
    }
}
