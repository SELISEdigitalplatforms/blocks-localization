using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class GetLanguagesRequest : IProjectKey
    {
        public string? ProjectKey { get; set; }
    }
}
