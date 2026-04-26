namespace Eurolm.DomainService.Shared.Entities
{
    public interface ILocalizationSecret
    {
        public string ChatGptEncryptedSecret { get; set; }
        public string ChatGptEncryptionKey { get; set; }
    }
}