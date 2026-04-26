using Blocks.Genesis;

namespace Eurolm.DomainService.Utilities
{
    public static class Constants
    {
        public const string UilmQueue = "blocks_uilm_listener";
        public const string UilmImportExportQueue = "blocks_uilm_import_export_listener";
        public const string TranslateAllKeysQueue = "blocks_uilm_translate_all_keys_listener";
        public const string TranslateBlocksLanguageKeyQueue = "blocks_uilm_translate_blocks_language_key_listener";
        public const string EnvironmentDataMigrationQueue = "blocks_uilm_environment_data_migration_listener";

        private const string DefaultProvider = "azure";
        private const string RabbitMqProvider = "rabbitmq";


        public static MessageConfiguration GetMessageConfiguration(string messageConnectionString)
        {
            var provider = GetProvider(messageConnectionString);

            return provider switch
            {
                RabbitMqProvider => CreateRabbitMqConfiguration(),
                _ => CreateAzureServiceBusConfiguration()
            };
        }

        private static string GetProvider(string messageConnectionString)
        {
	        if (Uri.TryCreate(messageConnectionString, UriKind.Absolute, out var uri) &&
	            (uri.Scheme.Equals("amqp", StringComparison.OrdinalIgnoreCase) ||
	             uri.Scheme.Equals("amqps", StringComparison.OrdinalIgnoreCase)))
	        {
	            return RabbitMqProvider;
	        }

            return DefaultProvider;
        }

        private static MessageConfiguration CreateRabbitMqConfiguration()
        {
            return new MessageConfiguration
            {
                RabbitMqConfiguration = new RabbitMqConfiguration
                {
                    ConsumerSubscriptions = [ConsumerSubscription.BindToQueue(UilmQueue),
                                             ConsumerSubscription.BindToQueue(UilmImportExportQueue),
                                             ConsumerSubscription.BindToQueue(EnvironmentDataMigrationQueue),
                                             ConsumerSubscription.BindToQueue(TranslateAllKeysQueue),
                                             ConsumerSubscription.BindToQueue(TranslateBlocksLanguageKeyQueue)],
                }
            };
        }

        private static MessageConfiguration CreateAzureServiceBusConfiguration()
        {
            return new MessageConfiguration
            {
                AzureServiceBusConfiguration = new AzureServiceBusConfiguration
                {
                    Queues = [UilmQueue, UilmImportExportQueue, EnvironmentDataMigrationQueue, TranslateAllKeysQueue, TranslateBlocksLanguageKeyQueue],
                    Topics = []
                }
            };
        } 
    }
}
