using Blocks.Genesis;

namespace BlocksTemplate.DomainService.Services
{
    public class GetLanguageFileGenerationHistoryRequest : IProjectKey
    {
        public int PageSize { get; set; } = 10;
        public int PageNumber { get; set; } = 0;
        public string? ProjectKey { get; set; }
    }
}
