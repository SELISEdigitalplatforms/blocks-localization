namespace Eurolm.DomainService.Shared.Events
{
    public class TranslateBlocksLanguageKeysEvent
    {
        public required string MessageCoRelationId { get; set; }
        public string? ProjectKey { get; set; }
        public required string DefaultLanguage { get; set; }
        public required List<string> KeyIds { get; set; }
        public required string OperationId { get; set; }

        /// <summary>
        /// How many events the request was split into, all sharing <see cref="OperationId"/>. Above 1, only the
        /// last batch to finish sends the completion notification. Null for a single event.
        /// </summary>
        public int? BatchCount { get; set; }
    }
}
