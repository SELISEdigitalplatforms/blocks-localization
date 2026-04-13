using Blocks.Genesis;

namespace BlocksTemplate.DomainService.Services
{
    public class DeleteCollectionsRequest : IProjectKey
    {
        public List<string> Collections { get; set; } = new List<string>();
        public string? ProjectKey { get; set; }
    }
}
