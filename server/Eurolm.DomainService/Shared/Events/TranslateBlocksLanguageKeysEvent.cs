namespace Eurolm.DomainService.Shared.Events
{
    public class TranslateBlocksLanguageKeysEvent
    {
        public required string MessageCoRelationId { get; set; }
        public string? ProjectKey { get; set; }
        public required string DefaultLanguage { get; set; }
        public required List<string> KeyIds { get; set; }
        public required string OperationId { get; set; }
    }
}
