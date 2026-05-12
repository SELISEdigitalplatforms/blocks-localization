using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class DeleteModuleRequest : IProjectKey
    {
        public string ItemId { get; set; }
        public string? TargetModuleId { get; set; }
        public string? ProjectKey { get; set; }
    }
}
