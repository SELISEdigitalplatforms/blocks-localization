namespace Eurolm.DomainService.Shared.Events
{
    public class TranslateBlocksLanguageKeyEvent
    {
        public required string MessageCoRelationId { get; set; }
        public string? ProjectKey { get; set; }
        public required string DefaultLanguage { get; set; }
        public required string KeyId { get; set; }
    }
}