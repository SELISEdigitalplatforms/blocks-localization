namespace Eurolm.DomainService.Shared.Events
{
    public class MigrationCompletionEvent
    {
        public required string TrackerId { get; set; }
        public required string ServiceName { get; set; }
        public bool IsSuccess { get; set; }
        public string? ErrorMessage { get; set; }
        public DateTime CompletedAt { get; set; } = DateTime.UtcNow;
    }
}