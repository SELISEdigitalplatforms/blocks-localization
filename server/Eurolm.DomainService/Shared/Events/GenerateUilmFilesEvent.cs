namespace Eurolm.DomainService.Shared.Events
{
    public record GenerateUilmFilesEvent
    {
        public string Guid { get; set; }
        public string? ModuleId { get; set; }
        public string? ProjectKey { get; set; }

        /// <summary>Messages sent before this field existed deserialize as false.</summary>
        public bool ForceUpload { get; set; }
    }
}
