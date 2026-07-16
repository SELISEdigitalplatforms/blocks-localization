using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared.Events;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Worker.Consumers;
using Xunit;

namespace XUnitTest
{
    public class EuroLMEnvironmentDataMigrationEventConsumerTests
    {
        private readonly Mock<IKeyManagementService> _keyManagementService = new();
        private readonly Mock<IEnvironmentDataMigrationRepository> _migrationRepository = new();
        private readonly Mock<ILogger<EuroLMEnvironmentDataMigrationEventConsumer>> _logger = new();
        private readonly Mock<IMessageClient> _messageClient = new();
        private readonly EuroLMEnvironmentDataMigrationEventConsumer _consumer;

        public EuroLMEnvironmentDataMigrationEventConsumerTests()
        {
            _consumer = new EuroLMEnvironmentDataMigrationEventConsumer(
                _keyManagementService.Object,
                _migrationRepository.Object,
                _logger.Object,
                _messageClient.Object);
        }

        private static EnvironmentDataMigrationEvent Event(bool overwrite = false, string? trackerId = "tracker-1") =>
            new EnvironmentDataMigrationEvent
            {
                ProjectKey = "source",
                TargetedProjectKey = "target",
                ShouldOverWriteExistingData = overwrite,
                TrackerId = trackerId
            };

        private void SetupModulesAndKeys(bool overwrite, BulkUpsertResult? upsertResult = null)
        {
            var sourceModules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "sm1", ModuleName = "auth", Name = "Auth" }
            };
            var targetModules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "tm1", ModuleName = "auth", Name = "Auth" }
            };
            var sourceKeys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey { ItemId = "sk1", ModuleId = "sm1", KeyName = "welcome", Value = "Hi", LastUpdateDate = DateTime.UtcNow }
            };

            _migrationRepository.Setup(x => x.GetAllModulesAsync("source")).ReturnsAsync(sourceModules);
            _migrationRepository.Setup(x => x.GetAllModulesAsync("target")).ReturnsAsync(targetModules);
            _migrationRepository.Setup(x => x.GetExistingModulesByNamesAsync(It.IsAny<List<string>>(), "target"))
                .ReturnsAsync(new List<BlocksLanguageModule>());
            _migrationRepository.Setup(x => x.BulkUpsertModulesByNameAsync(It.IsAny<List<BlocksLanguageModule>>(), "target", overwrite))
                .Returns(Task.CompletedTask);
            _migrationRepository.Setup(x => x.GetAllKeysAsync("source")).ReturnsAsync(sourceKeys);
            _migrationRepository.Setup(x => x.GetExistingKeysByModuleNameAndKeyNameAsync(
                    It.IsAny<List<(string, string)>>(), It.IsAny<Dictionary<string, string>>(), "target"))
                .ReturnsAsync(new List<BlocksLanguageKey>());
            _migrationRepository.Setup(x => x.BulkUpsertKeysByModuleNameAndKeyNameAsync(
                    It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<List<BlocksLanguageKey>>(),
                    It.IsAny<Dictionary<string, string>>(), "target", overwrite))
                .ReturnsAsync(upsertResult ?? new BulkUpsertResult());
        }

        [Fact]
        public async Task Consume_WithNoModulesOrKeys_CompletesAndNotifiesSuccess()
        {
            _migrationRepository.Setup(x => x.GetAllModulesAsync(It.IsAny<string>())).ReturnsAsync(new List<BlocksLanguageModule>());
            _migrationRepository.Setup(x => x.GetAllKeysAsync(It.IsAny<string>())).ReturnsAsync(new List<BlocksLanguageKey>());
            ConsumerMessage<MigrationCompletionEvent>? captured = null;
            _messageClient.Setup(x => x.SendToMassConsumerAsync(It.IsAny<ConsumerMessage<MigrationCompletionEvent>>()))
                .Callback<ConsumerMessage<MigrationCompletionEvent>>(m => captured = m)
                .Returns(Task.CompletedTask);

            await _consumer.Consume(Event());

            _migrationRepository.Verify(x => x.BulkUpsertModulesByNameAsync(It.IsAny<List<BlocksLanguageModule>>(), It.IsAny<string>(), It.IsAny<bool>()), Times.Never);
            captured.Should().NotBeNull();
            captured!.Payload.IsSuccess.Should().BeTrue();
            captured.Payload.ServiceName.Should().Be("Language");
        }

        [Fact]
        public async Task Consume_WithoutTrackerId_DoesNotNotifyOnSuccess()
        {
            _migrationRepository.Setup(x => x.GetAllModulesAsync(It.IsAny<string>())).ReturnsAsync(new List<BlocksLanguageModule>());
            _migrationRepository.Setup(x => x.GetAllKeysAsync(It.IsAny<string>())).ReturnsAsync(new List<BlocksLanguageKey>());

            await _consumer.Consume(Event(trackerId: null));

            _messageClient.Verify(x => x.SendToMassConsumerAsync(It.IsAny<ConsumerMessage<MigrationCompletionEvent>>()), Times.Never);
        }

        [Fact]
        public async Task Consume_Overwrite_MigratesAndCreatesTimelineWithPreviousData()
        {
            SetupModulesAndKeys(overwrite: true);

            await _consumer.Consume(Event(overwrite: true));

            _migrationRepository.Verify(x => x.BulkUpsertModulesByNameAsync(
                It.Is<List<BlocksLanguageModule>>(m => m.Count == 1 && m[0].ModuleName == "auth" && m[0].TenantId == "target"),
                "target", true), Times.Once);
            _migrationRepository.Verify(x => x.BulkUpsertKeysByModuleNameAndKeyNameAsync(
                It.Is<List<BlocksLanguageKey>>(k => k.Count == 1 && k[0].KeyName == "welcome" && k[0].ModuleId == "tm1"),
                It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<Dictionary<string, string>>(), "target", true), Times.Once);
            _keyManagementService.Verify(x => x.CreateBulkKeyTimelineEntriesAsync(
                It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<List<BlocksLanguageKey>>(),
                LogFromConstants.EnvironmentDataMigration, "target"), Times.Once);
        }

        [Fact]
        public async Task Consume_NotOverwrite_WithInsertedKeys_CreatesTimelineForInsertedOnly()
        {
            var inserted = new List<BlocksLanguageKey> { new BlocksLanguageKey { ItemId = "nk1", KeyName = "welcome", ModuleId = "tm1" } };
            SetupModulesAndKeys(overwrite: false, upsertResult: new BulkUpsertResult { InsertedKeys = inserted });

            await _consumer.Consume(Event(overwrite: false));

            _keyManagementService.Verify(x => x.CreateBulkKeyTimelineEntriesAsync(
                inserted, LogFromConstants.EnvironmentDataMigration, "target"), Times.Once);
            // The overwrite (4-arg) overload must NOT be used.
            _keyManagementService.Verify(x => x.CreateBulkKeyTimelineEntriesAsync(
                It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<List<BlocksLanguageKey>>(),
                It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Consume_NotOverwrite_WithNoInsertedKeys_DoesNotCreateTimeline()
        {
            SetupModulesAndKeys(overwrite: false, upsertResult: new BulkUpsertResult { InsertedKeys = new List<BlocksLanguageKey>() });

            await _consumer.Consume(Event(overwrite: false));

            _keyManagementService.Verify(x => x.CreateBulkKeyTimelineEntriesAsync(
                It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Consume_WhenRepositoryThrows_NotifiesFailureAndRethrows()
        {
            _migrationRepository.Setup(x => x.GetAllModulesAsync(It.IsAny<string>()))
                .ThrowsAsync(new InvalidOperationException("boom"));
            ConsumerMessage<MigrationCompletionEvent>? captured = null;
            _messageClient.Setup(x => x.SendToMassConsumerAsync(It.IsAny<ConsumerMessage<MigrationCompletionEvent>>()))
                .Callback<ConsumerMessage<MigrationCompletionEvent>>(m => captured = m)
                .Returns(Task.CompletedTask);

            var act = async () => await _consumer.Consume(Event());

            await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("boom");
            captured.Should().NotBeNull();
            captured!.Payload.IsSuccess.Should().BeFalse();
            captured.Payload.ErrorMessage.Should().Be("boom");
            _keyManagementService.Verify(x => x.PublishEnvironmentDataMigrationNotification(
                false, "tracker-1", "source", "target"), Times.Once);
        }
    }
}
