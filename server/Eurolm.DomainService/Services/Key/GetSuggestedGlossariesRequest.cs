using Blocks.Genesis;
using Eurolm.DomainService.Shared;

namespace Eurolm.DomainService.Services
{
    public class GetSuggestedGlossariesRequest 
    {
        public string ItemId { get; set; }
        public int MaxResults { get; set; } = 5;
    }
}
