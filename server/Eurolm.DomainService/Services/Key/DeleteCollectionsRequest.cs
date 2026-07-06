using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class DeleteCollectionsRequest 
    {
        public List<string> Collections { get; set; } = new List<string>();
      
    }
}
