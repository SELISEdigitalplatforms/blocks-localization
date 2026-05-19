using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class TranslateBlocksLanguageKeysRequest : IProjectKey
    {
        public required List<string> KeyIds { get; set; }
        public required string MessageCoRelationId { get; set; }
        public required string ProjectKey { get; set; }
        public required string DefaultLanguage { get; set; }
    }
}
