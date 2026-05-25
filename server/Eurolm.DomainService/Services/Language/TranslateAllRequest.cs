using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class TranslateAllRequest : IProjectKey
    {
        public string? ModuleId { get; set; }
        public string MessageCoRelationId { get; set; }
        public string ProjectKey { get; set; }
        public string DefaultLanguage { get; set; }
    }
}
