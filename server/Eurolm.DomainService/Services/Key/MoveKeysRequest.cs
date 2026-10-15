namespace Eurolm.DomainService.Services
{
    public class MoveKeysRequest
    {
        public List<string> ItemIds { get; set; } = new List<string>();
        public string TargetModuleId { get; set; } = string.Empty;
    }
}
