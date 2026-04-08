namespace BlocksTemplate.DomainService.Services
{
    public class SuggestLanguageRequest
    {
        public string? ElementType { get; set; }
        public string? ElementApplicationContext { get; set; }
        public string? ElementDetailContext { get; set; }
        public double Temperature { get; set; }
        public int? MaxCharacterLength { get; set; } = 0;
        public string SourceText { get; set; }
        public string DestinationLanguage { get; set; }
        public string CurrentLanguage { get; set; }
    }
}
