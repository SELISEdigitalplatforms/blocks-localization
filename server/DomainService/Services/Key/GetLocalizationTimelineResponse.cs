namespace BlocksTemplate.DomainService.Services
{
    public class GetLocalizationTimelineResponse
    {
        public long TotalCount { get; set; }
        public List<LocalizationTimelineEntry> Operations { get; set; } = new List<LocalizationTimelineEntry>();
    }
}
