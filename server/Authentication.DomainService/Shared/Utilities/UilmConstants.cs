using Blocks.Genesis;
using Microsoft.Extensions.Configuration;

namespace DomainService.Utilities
{
    public static class UilmConstants
    {
        public const string TenantTokenPublicCertificateCachePrefix = "tetocertpublic::";
        public const string AuthenticationQueue = "eurolm_authentication_listener";
        public const string IamQueue = "eurolm_iam_listener";
        public const string MailQueue = "eurolm_mail_listener";
        public const string MfaQueueName = "eurolm_mfa_listener";

        public const string AccessTokenCookieName = "access_token";
        public const string RefreshTokenCookieName = "refresh_token";

        private const string DefaultProvider = "azure";
        private const string RabbitMqProvider = "rabbitmq";

        #region Identifier Service Constants
        public const string IdentifierQueueName = "eurolm_identifier_listener";
        public const string DataCleanupQueue = "eurolm_data_cleanup_listener";
        public const string LanguageDataMigrationQueue = "eurolm_environment_data_migration_listener";
        public const string GenericMigrationQueue = "eurolm_generic_migration_listener";
        public const string MigrationCompletionTopic = "eurolm_migration_topic";
        public const string ProjectPeopleInvitationMailPurpose = "eurolm_project_invitation";
        public const string BlocsDomain = "seliseblocks.com";
        #endregion
        #region Eurolm Service Constants
        public const string UilmQueue = "eurolm_listener";
        public const string UilmImportExportQueue = "eurolm_import_export_listener";
        public const string TranslateAllKeysQueue = "eurolm_translate_all_keys_listener";
        public const string TranslateBlocksLanguageKeyQueue = "eurolm_translate_blocks_language_key_listener";
        public const string EnvironmentDataMigrationQueue = "eurolm_environment_data_migration_listener";
        #endregion
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
                    ConsumerSubscriptions = [ConsumerSubscription.BindToQueue(AuthenticationQueue),
                                             ConsumerSubscription.BindToQueue(IamQueue),
                                             ConsumerSubscription.BindToQueue(MfaQueueName),
                                             ConsumerSubscription.BindToQueue(IdentifierQueueName),
                                             ConsumerSubscription.BindToQueue(DataCleanupQueue),
                                             ConsumerSubscription.BindToQueue(LanguageDataMigrationQueue),
                                             ConsumerSubscription.BindToQueue(GenericMigrationQueue),
                                             ConsumerSubscription.BindToQueue(UilmQueue),
                                             ConsumerSubscription.BindToQueue(UilmImportExportQueue),
                                             ConsumerSubscription.BindToQueue(EnvironmentDataMigrationQueue),
                                             ConsumerSubscription.BindToQueue(TranslateAllKeysQueue),
                                             ConsumerSubscription.BindToQueue(TranslateBlocksLanguageKeyQueue)
                                             ],
                }
            };
        }

        private static MessageConfiguration CreateAzureServiceBusConfiguration()
        {
            return new MessageConfiguration
            {
                AzureServiceBusConfiguration = new AzureServiceBusConfiguration
                {
                    Queues = [AuthenticationQueue, IamQueue, MfaQueueName, IdentifierQueueName, DataCleanupQueue, LanguageDataMigrationQueue, GenericMigrationQueue, UilmQueue, UilmImportExportQueue, EnvironmentDataMigrationQueue, TranslateAllKeysQueue, TranslateBlocksLanguageKeyQueue],
                    Topics = [MigrationCompletionTopic]
                }
            };
        }
    }
}