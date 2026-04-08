using Blocks.Genesis;

namespace BlocksTemplate.DomainService.Services
{
    public class GetLanguagesRequest : IProjectKey
    {
        public string? ProjectKey { get; set; }
    }
}
