using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class DeleteGlossaryRequest : IProjectKey
    {
        public string ItemId { get; set; }
        public string? ProjectKey { get; set; }
    }
}
