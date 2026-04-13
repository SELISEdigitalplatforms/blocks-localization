using BlocksTemplate.DomainService.Services;

namespace BlocksTemplate.DomainService.Repositories
{
    public interface IKeyTimelineRepository
    {
        Task<GetKeyTimelineQueryResponse> GetKeyTimelineAsync(GetKeyTimelineRequest query);
        Task SaveKeyTimelineAsync(KeyTimeline timeline);
        Task BulkSaveKeyTimelinesAsync(List<KeyTimeline> timelines, string targetedProjectKey);
        Task<KeyTimeline?> GetTimelineByItemIdAsync(string itemId);
        Task<GetLocalizationTimelineResponse> GetLocalizationTimelineAsync(GetLocalizationTimelineRequest query);
        Task<GetKeyTimelineQueryResponse> GetTimelineByOperationIdAsync(GetTimelineByOperationIdRequest query);
        Task<Dictionary<string, KeyTimeline>> GetLatestPublishTimelinesAsync(List<string> entityIds, string targetedProjectKey);
    }
}
