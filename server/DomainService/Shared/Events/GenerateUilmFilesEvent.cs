namespace BlocksTemplate.DomainService.Shared.Events
{
    public record GenerateUilmFilesEvent
    {
        public string Guid { get; set; }
        public string? ModuleId { get; set; }
        public string? ProjectKey { get; set; }
    }
}
