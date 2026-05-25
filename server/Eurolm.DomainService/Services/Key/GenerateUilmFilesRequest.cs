using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class GenerateUilmFilesRequest : IProjectKey
    {
        public string Guid { get; set; }
        public string? ModuleId { get; set; }
        public string? ProjectKey { get; set; }
    }
}
