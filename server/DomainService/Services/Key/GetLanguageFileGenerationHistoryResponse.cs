using BlocksTemplate.DomainService.Repositories;

namespace BlocksTemplate.DomainService.Services
{
    public class GetLanguageFileGenerationHistoryResponse
    {
        public long TotalCount { get; set; }
        public List<LanguageFileGenerationHistory> Items { get; set; } = new();
    }
}
