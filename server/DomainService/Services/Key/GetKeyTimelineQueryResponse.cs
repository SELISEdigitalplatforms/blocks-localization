namespace BlocksTemplate.DomainService.Services
{
    public class GetKeyTimelineQueryResponse
    {
        public long TotalCount { get; set; }
        public List<KeyTimeline> Timelines { get; set; } = new List<KeyTimeline>();
    }
}
