namespace BlocksTemplate.DomainService.Shared.Entities
{
    public class FileData
    {
        public string ItemId { get; set; }
        public int AccessModifier { get; set; }
        public string Url { get; set; }
        public string Name { get; set; }
        public string UploadUrl { get; set; }
        public Dictionary<string, object> MetaData { get; set; }
    }
}
