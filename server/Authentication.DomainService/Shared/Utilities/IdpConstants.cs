using Blocks.Genesis;
using Microsoft.Extensions.Configuration;

namespace DomainService.Utilities
{
    public static class IdpConstants
    {
        public const string TenantTokenPublicCertificateCachePrefix = "tetocertpublic::";
        public const string AuthenticationQueue = "blocks_authentication_listener";
        public const string IamQueue = "blocks_iam_listener";
        public const string MailQueue = "blocks_mail_listener";
        public const string MfaQueueName = "blocks_mfa_listener";

        public const string AccessTokenCookieName = "access_token";
        public const string RefreshTokenCookieName = "refresh_token";

        private const string DefaultProvider = "azure";
        private const string RabbitMqProvider = "rabbitmq";

        #region Identifier Service Constants
        public const string IdentifierQueueName = "blocks_identifier_listener";
        public const string DataCleanupQueue = "blocks_data_cleanup_listener";
        public const string LanguageDataMigrationQueue = "blocks_uilm_environment_data_migration_listener";
        public const string GenericMigrationQueue = "blocks_generic_migration_listener";
        public const string MigrationCompletionTopic = "migration_topic";
        public const string ProjectPeopleInvitationMailPurpose = "project_invitation";
        public const string BlocsDomain = "seliseblocks.com";
        #endregion
        #region Eurolm Service Constants
        public const string UilmQueue = "blocks_eurolm_listener";
        public const string UilmImportExportQueue = "blocks_eurolm_import_export_listener";
        public const string TranslateAllKeysQueue = "blocks_eurolm_translate_all_keys_listener";
        public const string TranslateBlocksLanguageKeyQueue = "blocks_eurolm_translate_blocks_language_key_listener";
        public const string EnvironmentDataMigrationQueue = "blocks_eurolm_environment_data_migration_listener";
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