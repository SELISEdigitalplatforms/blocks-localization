namespace Eurolm.DomainService.Shared.Events
{
    public class TranslateAllEvent
    {
        public string? ModuleId { get; set; }
        public string MessageCoRelationId { get; set; }
        public string? ProjectKey { get; set; }
        public string DefaultLanguage { get; set; }

        /// <summary>
        /// Translate every non-default language from the default-language value, replacing what is there.
        /// Only single-key TranslateKey sets it; Translate All and TranslateKeys leave it false and fill
        /// empty values only.
        /// </summary>
        public bool RetranslateExisting { get; set; }
    }
}
