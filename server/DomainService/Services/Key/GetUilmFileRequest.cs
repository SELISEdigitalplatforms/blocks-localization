using Blocks.Genesis;

namespace BlocksTemplate.DomainService.Services
{
    public class GetUilmFileRequest : IProjectKey
    {
        public string Language { get; set; }
        public string ModuleName { get; set; }
        public string? ProjectKey { get; set; }
    }
}
