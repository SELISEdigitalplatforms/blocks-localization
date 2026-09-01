using Blocks.Genesis;
using Eurolm.DomainService.Shared.Entities;
using System.Reflection;

namespace Eurolm.DomainService.Shared.Utilities
{
    /// <summary>
    /// Holds <see cref="AzureOpenAIEncryptedSecret"/>,
    /// <see cref="AzureAIEndpoint"/>, and <see cref="AzureAIEncryptionKey"/>
    /// loaded from the Genesis cloud vault.
    /// Configuration / Mongo <c>blocks-secret-localization</c> can supply the
    /// same keys when vault values are empty.
    /// Decrypt uses <see cref="AzureAIEncryptionKey"/> plus the existing
    /// localization <c>Salt</c> from that Mongo document.
    /// <see cref="ChatGptEncryptedSecret"/> and <see cref="ChatGptEncryptionKey"/>
    /// remain for vault compatibility and are unused after the Azure OpenAI hard switch.
    /// </summary>
    public sealed class LocalizationSecret : ILocalizationSecret
    {
        public string? AzureOpenAIEncryptedSecret { get; set; }
        public string? AzureAIEndpoint { get; set; }
        public string? AzureAIEncryptionKey { get; set; }
        public string ChatGptEncryptedSecret { get; set; }
        public string ChatGptEncryptionKey { get; set; }


        public static async Task<ILocalizationSecret> ProcessBlocksSecret(VaultType vaultType = VaultType.Azure)
        {
            IVault cloudVault = Vault.GetCloudVault(vaultType);
            var blocksSecret = new LocalizationSecret();
            PropertyInfo[] properties = typeof(LocalizationSecret).GetProperties();
            var blocksSecretVault = await cloudVault.ProcessSecretsAsync(properties.Select(x => x.Name).ToList());

            foreach (PropertyInfo property in properties)
            {
                string propertyName = property.Name;
                var isExist = blocksSecretVault.TryGetValue(propertyName, out var retrievedValue);

                if (isExist && !string.IsNullOrWhiteSpace(retrievedValue))
                {
                    object convertedValue = ConvertValue(retrievedValue, property.PropertyType);

                    UpdateProperty(blocksSecret, propertyName, convertedValue);
                }
            }

            return blocksSecret;
        }



        public static void UpdateProperty<T>(T blocksSecret, string propertyName, object propertyValue) where T : class
        {
            var property = blocksSecret.GetType().GetProperty(propertyName);

            if (property != null && property.CanWrite)
            {
                property.SetValue(blocksSecret, propertyValue);
            }
            else
            {
                Console.WriteLine($"Property '{propertyName}' not found or is read-only.");
            }
        }

        public static object ConvertValue(string value, Type targetType)
        {
            if (targetType != typeof(string))
            {
                try
                {
                    return Convert.ChangeType(value, targetType);
                }
                catch (Exception e)
                {
                    Console.WriteLine(e.Message);
                }
            }
            return value;
        }
    }
}