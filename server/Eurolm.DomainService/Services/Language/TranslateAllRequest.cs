using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class TranslateAllRequest 
    {
        public string? ModuleId { get; set; }
        public string MessageCoRelationId { get; set; }
        public string DefaultLanguage { get; set; }
    }
}
