using BlocksTemplate.DomainService.Repositories;

namespace BlocksTemplate.DomainService.Services
{
    public class LocalizationTimelineEntry
    {
        public string OperationId { get; set; } = string.Empty;
        public string? LogFrom { get; set; }
        public string? UserName { get; set; }
        public string? UserId { get; set; }
        public DateTime CreateDate { get; set; }
        public int AffectedKeysCount { get; set; }
        public BlocksLanguageKey? CurrentData { get; set; }
        public BlocksLanguageKey? PreviousData { get; set; }
    }
}
