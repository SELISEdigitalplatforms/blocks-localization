using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class GetLanguageFileGenerationHistoryRequest 
    {
        public int PageSize { get; set; } = 10;
        public int PageNumber { get; set; } = 0;
    }
}
