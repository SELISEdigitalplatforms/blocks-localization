using Eurolm.DomainService.Utilities;
using FluentAssertions;

namespace XUnitTest
{
    public class ConstantsTests
    {
        [Fact]
        public void QueueConstants_HaveExpectedValues()
        {
            Constants.UilmQueue.Should().Be("eurolm_listener");
            Constants.UilmImportExportQueue.Should().Be("eurolm_import_export_listener");
            Constants.TranslateAllKeysQueue.Should().Be("eurolm_translate_all_keys_listener");
            Constants.TranslateBlocksLanguageKeyQueue.Should().Be("eurolm_translate_blocks_language_key_listener");
            Constants.EnvironmentDataMigrationQueue.Should().Be("blocks_localization_environment_data_migration_listener");
        }

        [Fact]
        public void GetMessageConfiguration_ReturnsExpectedQueuesAndEmptyTopics()
        {
            var config = Constants.GetMessageConfiguration("Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=test");

            config.Should().NotBeNull();
            var serviceBusConfig = config.AzureServiceBusConfiguration;
            serviceBusConfig.Should().NotBeNull();

            serviceBusConfig!.Queues.Should().BeEquivalentTo(new[]
            {
                Constants.UilmQueue,
                Constants.UilmImportExportQueue,
                Constants.EnvironmentDataMigrationQueue,
                Constants.TranslateAllKeysQueue,
                Constants.TranslateBlocksLanguageKeyQueue,
                Constants.TranslateBlocksLanguageKeysQueue
            });
            serviceBusConfig.Topics.Should().BeEmpty();
        }

        [Fact]
        public void GetMessageConfiguration_WithRabbitMqAmqpUri_ReturnsRabbitMqConfig()
        {
            var config = Constants.GetMessageConfiguration("amqp://guest:guest@localhost:5672/");

            config.Should().NotBeNull();
            config.RabbitMqConfiguration.Should().NotBeNull();
            config.RabbitMqConfiguration!.ConsumerSubscriptions.Should().HaveCount(6);
        }

        [Fact]
        public void GetMessageConfiguration_WithRabbitMqAmqpsUri_ReturnsRabbitMqConfig()
        {
            var config = Constants.GetMessageConfiguration("amqps://user:pass@rabbitmq.example.com:5671/");

            config.Should().NotBeNull();
            config.RabbitMqConfiguration.Should().NotBeNull();
        }

        [Fact]
        public void GetMessageConfiguration_WithHttpUri_ReturnsAzureConfig()
        {
            var config = Constants.GetMessageConfiguration("https://servicebus.example.com");

            config.Should().NotBeNull();
            config.AzureServiceBusConfiguration.Should().NotBeNull();
        }

        [Fact]
        public void GetMessageConfiguration_WithPlainString_ReturnsAzureConfig()
        {
            var config = Constants.GetMessageConfiguration("some-connection-string");

            config.Should().NotBeNull();
            config.AzureServiceBusConfiguration.Should().NotBeNull();
        }
    }
}
