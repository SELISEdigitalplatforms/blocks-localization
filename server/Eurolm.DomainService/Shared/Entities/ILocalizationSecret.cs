namespace Eurolm.DomainService.Shared.Entities
{
    /// <summary>
    /// Vault-backed AI credentials for localization translation.
    /// Mongo <c>blocks-secret-localization</c> can supply the same keys when
    /// vault values are empty (see <c>AssistantService</c>).
    /// <see cref="ChatGptEncryptedSecret"/> and <see cref="ChatGptEncryptionKey"/>
    /// remain for vault compatibility and are unused after the Azure OpenAI hard switch.
    /// </summary>
    public interface ILocalizationSecret
    {
        string? AzureOpenAIEncryptedSecret { get; set; }
        string? AzureAIEndpoint { get; set; }
        string? AzureAIEncryptionKey { get; set; }
        string ChatGptEncryptedSecret { get; set; }
        string ChatGptEncryptionKey { get; set; }
    }
}