namespace BlocksTemplate.DomainService.Shared.Entities
{
    public interface ILocalizationSecret
    {
        public string ChatGptEncryptedSecret { get; set; }
        public string ChatGptEncryptionKey { get; set; }
    }
}