using Blocks.Genesis;
using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Services.HelperService;
using BlocksTemplate.DomainService.Shared.Entities;
using BlocksTemplate.DomainService.Shared.Events;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Worker.Consumers;

namespace XUnitTest
{
    public class WorkerConsumersTests
    {
        [Fact]
        public async Task GenerateUilmFilesConsumer_Consume_CallsGenerateAsync()
        {
            var keyManagementService = new Mock<IKeyManagementService>();
            var webHookService = new Mock<IWebHookService>();
            keyManagementService.Setup(x => x.GenerateAsync(It.IsAny<GenerateUilmFilesEvent>())).ReturnsAsync(true);
            webHookService.Setup(x => x.CallWebhook(It.IsAny<object>())).ReturnsAsync(true);

            var consumer = new GenerateUilmFilesConsumer(keyManagementService.Object, webHookService.Object);
            var @event = new GenerateUilmFilesEvent { Guid = "g-1", ModuleId = "m-1", ProjectKey = "tenant-1" };

            await consumer.Consume(@event);

            keyManagementService.Verify(x => x.GenerateAsync(@event), Times.Once);
        }

        [Fact]
        public async Task TranslateAllEventConsumer_Consume_PublishesNotificationAndWebhook()
        {
            var keyManagementService = new Mock<IKeyManagementService>();
            var webHookService = new Mock<IWebHookService>();

            keyManagementService.Setup(x => x.ChangeAll(It.IsAny<TranslateAllEvent>())).ReturnsAsync(true);
            keyManagementService.Setup(x => x.PublishTranslateAllNotification(true, It.IsAny<string>())).Returns(Task.CompletedTask);
            webHookService.Setup(x => x.CallWebhook(It.IsAny<object>())).ReturnsAsync(true);

            var consumer = new TranslateAllEventConsumer(keyManagementService.Object, webHookService.Object);
            var @event = new TranslateAllEvent
            {
                ModuleId = "m-1",
                MessageCoRelationId = "corr-1",
                ProjectKey = "tenant-1",
                DefaultLanguage = "en"
            };

            await consumer.Consume(@event);

            keyManagementService.Verify(x => x.ChangeAll(@event), Times.Once);
            keyManagementService.Verify(x => x.PublishTranslateAllNotification(true, "corr-1"), Times.Once);
            webHookService.Verify(x => x.CallWebhook(It.IsAny<object>()), Times.Once);
        }

        [Fact]
        public async Task TranslateBlocksLanguageKeyEventConsumer_Consume_PublishesNotification()
        {
            var keyManagementService = new Mock<IKeyManagementService>();
            keyManagementService.Setup(x => x.TranslateBlocksLanguageKey(It.IsAny<TranslateBlocksLanguageKeyEvent>())).ReturnsAsync(true);
            keyManagementService.Setup(x => x.PublishTranslateBlocksLanguageKeyNotification(true, It.IsAny<string>())).Returns(Task.CompletedTask);

            var consumer = new TranslateBlocksLanguageKeyEventConsumer(keyManagementService.Object);
            var @event = new TranslateBlocksLanguageKeyEvent
            {
                MessageCoRelationId = "corr-2",
                ProjectKey = "tenant-1",
                DefaultLanguage = "en",
                KeyId = "key-1"
            };

            await consumer.Consume(@event);

            keyManagementService.Verify(x => x.TranslateBlocksLanguageKey(@event), Times.Once);
            keyManagementService.Verify(x => x.PublishTranslateBlocksLanguageKeyNotification(true, "corr-2"), Times.Once);
        }

        [Fact]
        public async Task UilmExportEventConsumer_Consume_PublishesExportNotification()
        {
            var keyManagementService = new Mock<IKeyManagementService>();
            keyManagementService.Setup(x => x.ExportUilmFile(It.IsAny<UilmExportEvent>())).ReturnsAsync(true);
            keyManagementService.Setup(x => x.PublishUilmExportNotification(true, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .Returns(Task.CompletedTask);

            var consumer = new UilmExportEventConsumer(keyManagementService.Object);
            var @event = new UilmExportEvent
            {
                MessageCoRelationId = "corr-3",
                FileId = "file-1",
                CallerTenantId = "caller-tenant",
                Languages = new List<string> { "en" },
                ReferenceFileId = "ref-1"
            };

            await consumer.Consume(@event);

            keyManagementService.Verify(x => x.ExportUilmFile(@event), Times.Once);
            keyManagementService.Verify(x => x.PublishUilmExportNotification(true, "file-1", "corr-3", "caller-tenant"), Times.Once);
        }

        [Fact]
        public async Task UilmImportEventConsumer_Consume_WhenSuccess_CallsWebhook()
        {
            var keyManagementService = new Mock<IKeyManagementService>();
            var webHookService = new Mock<IWebHookService>();

            keyManagementService.Setup(x => x.ImportUilmFile(It.IsAny<UilmImportEvent>())).ReturnsAsync(true);
            webHookService.Setup(x => x.CallWebhook(It.IsAny<object>())).ReturnsAsync(true);

            var consumer = new UilmImportEventConsumer(keyManagementService.Object, webHookService.Object);
            var @event = new UilmImportEvent { MessageCoRelationId = "corr-4", FileId = "file-2", ProjectKey = "tenant-1" };

            await consumer.Consume(@event);

            keyManagementService.Verify(x => x.ImportUilmFile(@event), Times.Once);
            webHookService.Verify(x => x.CallWebhook(It.IsAny<object>()), Times.Once);
        }

        [Fact]
        public async Task EnvironmentDataMigrationEventConsumer_Consume_SendsCompletionMessageOnSuccess()
        {
            var keyManagementService = new Mock<IKeyManagementService>();
            var migrationRepository = new Mock<IEnvironmentDataMigrationRepository>();
            var logger = new Mock<ILogger<EnvironmentDataMigrationEventConsumer>>();
            var messageClient = new Mock<IMessageClient>();

            migrationRepository.Setup(x => x.GetAllModulesAsync("source")).ReturnsAsync(new List<BlocksLanguageModule>());
            migrationRepository.Setup(x => x.GetAllKeysAsync("source")).ReturnsAsync(new List<BlocksLanguageKey>());
            messageClient.Setup(x => x.SendToMassConsumerAsync(It.IsAny<ConsumerMessage<MigrationCompletionEvent>>()))
                .Returns(Task.CompletedTask);

            var consumer = new EnvironmentDataMigrationEventConsumer(
                keyManagementService.Object,
                migrationRepository.Object,
                logger.Object,
                messageClient.Object);

            var @event = new EnvironmentDataMigrationEvent
            {
                ProjectKey = "source",
                TargetedProjectKey = "target",
                ShouldOverWriteExistingData = false,
                TrackerId = "tracker-1"
            };

            await consumer.Consume(@event);

            messageClient.Verify(x => x.SendToMassConsumerAsync(
                It.Is<ConsumerMessage<MigrationCompletionEvent>>(m =>
                    m.ConsumerName == "migration_topic" &&
                    m.Payload.TrackerId == "tracker-1" &&
                    m.Payload.IsSuccess)), Times.Once);
        }

        [Fact]
        public async Task EnvironmentDataMigrationEventConsumer_Consume_OnFailure_PublishesFailureAndRethrows()
        {
            var keyManagementService = new Mock<IKeyManagementService>();
            var migrationRepository = new Mock<IEnvironmentDataMigrationRepository>();
            var logger = new Mock<ILogger<EnvironmentDataMigrationEventConsumer>>();
            var messageClient = new Mock<IMessageClient>();

            migrationRepository.Setup(x => x.GetAllModulesAsync("source"))
                .ThrowsAsync(new InvalidOperationException("boom"));
            messageClient.Setup(x => x.SendToMassConsumerAsync(It.IsAny<ConsumerMessage<MigrationCompletionEvent>>()))
                .Returns(Task.CompletedTask);
            keyManagementService.Setup(x => x.PublishEnvironmentDataMigrationNotification(false, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .Returns(Task.CompletedTask);

            var consumer = new EnvironmentDataMigrationEventConsumer(
                keyManagementService.Object,
                migrationRepository.Object,
                logger.Object,
                messageClient.Object);

            var @event = new EnvironmentDataMigrationEvent
            {
                ProjectKey = "source",
                TargetedProjectKey = "target",
                ShouldOverWriteExistingData = true,
                TrackerId = "tracker-2"
            };

            var action = async () => await consumer.Consume(@event);

            await action.Should().ThrowAsync<InvalidOperationException>();
            messageClient.Verify(x => x.SendToMassConsumerAsync(
                It.Is<ConsumerMessage<MigrationCompletionEvent>>(m =>
                    m.ConsumerName == "migration_topic" &&
                    m.Payload.TrackerId == "tracker-2" &&
                    m.Payload.IsSuccess == false &&
                    m.Payload.ErrorMessage == "boom")), Times.Once);
            keyManagementService.Verify(x => x.PublishEnvironmentDataMigrationNotification(false, "tracker-2", "source", "target"), Times.Once);
        }

        [Fact]
        public async Task EnvironmentDataMigrationEventConsumer_Consume_WhenOverwriteTrue_UsesExistingIdsAndCreatesTimelineWithPreviousKeys()
        {
            var keyManagementService = new Mock<IKeyManagementService>();
            var migrationRepository = new Mock<IEnvironmentDataMigrationRepository>();
            var logger = new Mock<ILogger<EnvironmentDataMigrationEventConsumer>>();
            var messageClient = new Mock<IMessageClient>();

            var sourceModules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule
                {
                    ItemId = "src-mod-1",
                    ModuleName = "Orders",
                    Name = "Orders",
                    CreateDate = DateTime.UtcNow.AddDays(-10),
                    LastUpdateDate = DateTime.UtcNow.AddDays(-5),
                    TenantId = "source",
                    CreatedBy = "source-user",
                    LastUpdatedBy = "source-user"
                }
            };

            var existingTargetModules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule
                {
                    ItemId = "target-mod-1",
                    ModuleName = "Orders",
                    Name = "Orders target",
                    CreateDate = DateTime.UtcNow.AddDays(-20),
                    LastUpdateDate = DateTime.UtcNow.AddDays(-1),
                    TenantId = "target",
                    CreatedBy = "target-user",
                    LastUpdatedBy = "target-user"
                }
            };

            var sourceKeys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "src-key-old",
                    KeyName = "OrderCreated",
                    ModuleId = "src-mod-1",
                    Value = "Old",
                    Resources = new[] { new Resource { Culture = "en", Value = "Old", CharacterLength = 3 } },
                    Routes = new List<string> { "/orders" },
                    IsPartiallyTranslated = false,
                    CreateDate = DateTime.UtcNow.AddDays(-10),
                    LastUpdateDate = DateTime.UtcNow.AddDays(-2),
                    TenantId = "source",
                    CreatedBy = "source-user",
                    LastUpdatedBy = "source-user"
                },
                new BlocksLanguageKey
                {
                    ItemId = "src-key-new",
                    KeyName = "OrderCreated",
                    ModuleId = "src-mod-1",
                    Value = "New",
                    Resources = new[] { new Resource { Culture = "en", Value = "New", CharacterLength = 3 } },
                    Routes = new List<string> { "/orders" },
                    IsPartiallyTranslated = true,
                    CreateDate = DateTime.UtcNow.AddDays(-10),
                    LastUpdateDate = DateTime.UtcNow.AddDays(-1),
                    TenantId = "source",
                    CreatedBy = "source-user",
                    LastUpdatedBy = "source-user"
                }
            };

            var existingTargetKeys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "target-key-1",
                    KeyName = "OrderCreated",
                    ModuleId = "target-mod-1",
                    Value = "Existing",
                    Resources = new[] { new Resource { Culture = "en", Value = "Existing", CharacterLength = 8 } },
                    Routes = new List<string> { "/orders" },
                    IsPartiallyTranslated = false,
                    CreateDate = DateTime.UtcNow.AddDays(-30),
                    LastUpdateDate = DateTime.UtcNow.AddDays(-3),
                    TenantId = "target",
                    CreatedBy = "target-user",
                    LastUpdatedBy = "target-user"
                }
            };

            migrationRepository.Setup(x => x.GetAllModulesAsync("source")).ReturnsAsync(sourceModules);
            migrationRepository.Setup(x => x.GetAllModulesAsync("target")).ReturnsAsync(existingTargetModules);
            migrationRepository.Setup(x => x.GetExistingModulesByNamesAsync(It.IsAny<List<string>>(), "target"))
                .ReturnsAsync(existingTargetModules);
            migrationRepository.Setup(x => x.BulkUpsertModulesByNameAsync(It.IsAny<List<BlocksLanguageModule>>(), "target", true))
                .Returns(Task.CompletedTask);

            migrationRepository.Setup(x => x.GetAllKeysAsync("source")).ReturnsAsync(sourceKeys);
            migrationRepository.Setup(x => x.GetExistingKeysByModuleNameAndKeyNameAsync(
                It.IsAny<List<(string ModuleName, string KeyName)>>(),
                It.IsAny<Dictionary<string, string>>(),
                "target")).ReturnsAsync(existingTargetKeys);

            migrationRepository.Setup(x => x.BulkUpsertKeysByModuleNameAndKeyNameAsync(
                It.IsAny<List<BlocksLanguageKey>>(),
                It.IsAny<List<BlocksLanguageKey>>(),
                It.IsAny<Dictionary<string, string>>(),
                "target",
                true)).ReturnsAsync(new BulkUpsertResult());

            keyManagementService.Setup(x => x.CreateBulkKeyTimelineEntriesAsync(
                    It.IsAny<List<BlocksLanguageKey>>(),
                    It.IsAny<List<BlocksLanguageKey>>(),
                    "EnvironmentDataMigration",
                    "target"))
                .Returns(Task.CompletedTask);

            messageClient.Setup(x => x.SendToMassConsumerAsync(It.IsAny<ConsumerMessage<MigrationCompletionEvent>>()))
                .Returns(Task.CompletedTask);

            var consumer = new EnvironmentDataMigrationEventConsumer(
                keyManagementService.Object,
                migrationRepository.Object,
                logger.Object,
                messageClient.Object);

            var @event = new EnvironmentDataMigrationEvent
            {
                ProjectKey = "source",
                TargetedProjectKey = "target",
                ShouldOverWriteExistingData = true,
                TrackerId = "tracker-overwrite"
            };

            await consumer.Consume(@event);

            migrationRepository.Verify(x => x.BulkUpsertModulesByNameAsync(
                It.Is<List<BlocksLanguageModule>>(modules =>
                    modules.Count == 1 &&
                    modules[0].ItemId == "target-mod-1" &&
                    modules[0].TenantId == "target"),
                "target",
                true), Times.Once);

            migrationRepository.Verify(x => x.BulkUpsertKeysByModuleNameAndKeyNameAsync(
                It.Is<List<BlocksLanguageKey>>(keys =>
                    keys.Count == 1 &&
                    keys[0].KeyName == "OrderCreated" &&
                    keys[0].ModuleId == "target-mod-1" &&
                    keys[0].ItemId == "target-key-1"),
                It.IsAny<List<BlocksLanguageKey>>(),
                It.IsAny<Dictionary<string, string>>(),
                "target",
                true), Times.Once);

            keyManagementService.Verify(x => x.CreateBulkKeyTimelineEntriesAsync(
                It.Is<List<BlocksLanguageKey>>(keys => keys.Count == 1),
                It.Is<List<BlocksLanguageKey>>(previous => previous.Count == 1 && previous[0].ItemId == "target-key-1"),
                "EnvironmentDataMigration",
                "target"), Times.Once);

            messageClient.Verify(x => x.SendToMassConsumerAsync(
                It.Is<ConsumerMessage<MigrationCompletionEvent>>(m =>
                    m.Payload.TrackerId == "tracker-overwrite" &&
                    m.Payload.IsSuccess)), Times.Once);
        }

        [Fact]
        public async Task EnvironmentDataMigrationEventConsumer_Consume_WhenOverwriteFalse_CreatesTimelineForInsertedKeysOnly()
        {
            var keyManagementService = new Mock<IKeyManagementService>();
            var migrationRepository = new Mock<IEnvironmentDataMigrationRepository>();
            var logger = new Mock<ILogger<EnvironmentDataMigrationEventConsumer>>();
            var messageClient = new Mock<IMessageClient>();

            var sourceModules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule
                {
                    ItemId = "src-mod-2",
                    ModuleName = "Payments",
                    Name = "Payments",
                    CreateDate = DateTime.UtcNow.AddDays(-10),
                    LastUpdateDate = DateTime.UtcNow.AddDays(-2),
                    TenantId = "source",
                    CreatedBy = "source-user",
                    LastUpdatedBy = "source-user"
                }
            };

            var targetModules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule
                {
                    ItemId = "target-mod-2",
                    ModuleName = "Payments",
                    Name = "Payments",
                    CreateDate = DateTime.UtcNow.AddDays(-20),
                    LastUpdateDate = DateTime.UtcNow.AddDays(-1),
                    TenantId = "target",
                    CreatedBy = "target-user",
                    LastUpdatedBy = "target-user"
                }
            };

            var sourceKeys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "src-key-2",
                    KeyName = "PaymentSuccess",
                    ModuleId = "src-mod-2",
                    Value = "Payment successful",
                    Resources = new[] { new Resource { Culture = "en", Value = "Payment successful", CharacterLength = 18 } },
                    Routes = new List<string> { "/payments" },
                    IsPartiallyTranslated = false,
                    CreateDate = DateTime.UtcNow.AddDays(-10),
                    LastUpdateDate = DateTime.UtcNow.AddDays(-1),
                    TenantId = "source",
                    CreatedBy = "source-user",
                    LastUpdatedBy = "source-user"
                }
            };

            migrationRepository.Setup(x => x.GetAllModulesAsync("source")).ReturnsAsync(sourceModules);
            migrationRepository.Setup(x => x.GetAllModulesAsync("target")).ReturnsAsync(targetModules);
            migrationRepository.Setup(x => x.GetExistingModulesByNamesAsync(It.IsAny<List<string>>(), "target"))
                .ReturnsAsync(targetModules);
            migrationRepository.Setup(x => x.BulkUpsertModulesByNameAsync(It.IsAny<List<BlocksLanguageModule>>(), "target", false))
                .Returns(Task.CompletedTask);

            migrationRepository.Setup(x => x.GetAllKeysAsync("source")).ReturnsAsync(sourceKeys);
            migrationRepository.Setup(x => x.GetExistingKeysByModuleNameAndKeyNameAsync(
                It.IsAny<List<(string ModuleName, string KeyName)>>(),
                It.IsAny<Dictionary<string, string>>(),
                "target")).ReturnsAsync(new List<BlocksLanguageKey>());

            migrationRepository.Setup(x => x.BulkUpsertKeysByModuleNameAndKeyNameAsync(
                It.IsAny<List<BlocksLanguageKey>>(),
                It.IsAny<List<BlocksLanguageKey>>(),
                It.IsAny<Dictionary<string, string>>(),
                "target",
                false)).ReturnsAsync(new BulkUpsertResult
                {
                    InsertedKeys = new List<BlocksLanguageKey>
                    {
                        new BlocksLanguageKey { ItemId = "inserted-1", KeyName = "PaymentSuccess", ModuleId = "target-mod-2", Value = "Payment successful", Resources = new[] { new Resource { Culture = "en", Value = "Payment successful", CharacterLength = 18 } }, Routes = new List<string>(), CreateDate = DateTime.UtcNow, LastUpdateDate = DateTime.UtcNow, TenantId = "target", CreatedBy = "source-user", LastUpdatedBy = "source-user" }
                    }
                });

            keyManagementService.Setup(x => x.CreateBulkKeyTimelineEntriesAsync(
                    It.IsAny<List<BlocksLanguageKey>>(),
                    "EnvironmentDataMigration",
                    "target"))
                .Returns(Task.CompletedTask);

            messageClient.Setup(x => x.SendToMassConsumerAsync(It.IsAny<ConsumerMessage<MigrationCompletionEvent>>()))
                .Returns(Task.CompletedTask);

            var consumer = new EnvironmentDataMigrationEventConsumer(
                keyManagementService.Object,
                migrationRepository.Object,
                logger.Object,
                messageClient.Object);

            var @event = new EnvironmentDataMigrationEvent
            {
                ProjectKey = "source",
                TargetedProjectKey = "target",
                ShouldOverWriteExistingData = false,
                TrackerId = "tracker-inserted"
            };

            await consumer.Consume(@event);

            keyManagementService.Verify(x => x.CreateBulkKeyTimelineEntriesAsync(
                It.Is<List<BlocksLanguageKey>>(keys => keys.Count == 1 && keys[0].ItemId == "inserted-1"),
                "EnvironmentDataMigration",
                "target"), Times.Once);

            keyManagementService.Verify(x => x.CreateBulkKeyTimelineEntriesAsync(
                It.IsAny<List<BlocksLanguageKey>>(),
                It.IsAny<List<BlocksLanguageKey>>(),
                It.IsAny<string>(),
                It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task EnvironmentDataMigrationEventConsumer_Consume_WithoutTrackerId_DoesNotSendCompletionMessage()
        {
            var keyManagementService = new Mock<IKeyManagementService>();
            var migrationRepository = new Mock<IEnvironmentDataMigrationRepository>();
            var logger = new Mock<ILogger<EnvironmentDataMigrationEventConsumer>>();
            var messageClient = new Mock<IMessageClient>();

            migrationRepository.Setup(x => x.GetAllModulesAsync("source")).ReturnsAsync(new List<BlocksLanguageModule>());
            migrationRepository.Setup(x => x.GetAllKeysAsync("source")).ReturnsAsync(new List<BlocksLanguageKey>());

            var consumer = new EnvironmentDataMigrationEventConsumer(
                keyManagementService.Object,
                migrationRepository.Object,
                logger.Object,
                messageClient.Object);

            var @event = new EnvironmentDataMigrationEvent
            {
                ProjectKey = "source",
                TargetedProjectKey = "target",
                ShouldOverWriteExistingData = false,
                TrackerId = null
            };

            await consumer.Consume(@event);

            messageClient.Verify(x => x.SendToMassConsumerAsync(It.IsAny<ConsumerMessage<MigrationCompletionEvent>>()), Times.Never);
        }

        [Fact]
        public async Task UilmImportEventConsumer_Consume_WhenFailure_DoesNotCallWebhook()
        {
            var keyManagementService = new Mock<IKeyManagementService>();
            var webHookService = new Mock<IWebHookService>();

            keyManagementService.Setup(x => x.ImportUilmFile(It.IsAny<UilmImportEvent>())).ReturnsAsync(false);

            var consumer = new UilmImportEventConsumer(keyManagementService.Object, webHookService.Object);
            var @event = new UilmImportEvent { MessageCoRelationId = "corr-fail", FileId = "file-fail", ProjectKey = "tenant-1" };

            await consumer.Consume(@event);

            keyManagementService.Verify(x => x.ImportUilmFile(@event), Times.Once);
            webHookService.Verify(x => x.CallWebhook(It.IsAny<object>()), Times.Never);
        }

        [Fact]
        public async Task EnvironmentDataMigrationEventConsumer_Consume_WhenNoSourceModules_SkipsModuleMigration()
        {
            var keyManagementService = new Mock<IKeyManagementService>();
            var migrationRepository = new Mock<IEnvironmentDataMigrationRepository>();
            var logger = new Mock<ILogger<EnvironmentDataMigrationEventConsumer>>();
            var messageClient = new Mock<IMessageClient>();

            migrationRepository.Setup(x => x.GetAllModulesAsync("source")).ReturnsAsync(new List<BlocksLanguageModule>());
            migrationRepository.Setup(x => x.GetAllKeysAsync("source")).ReturnsAsync(new List<BlocksLanguageKey>());

            var consumer = new EnvironmentDataMigrationEventConsumer(
                keyManagementService.Object,
                migrationRepository.Object,
                logger.Object,
                messageClient.Object);

            var @event = new EnvironmentDataMigrationEvent
            {
                ProjectKey = "source",
                TargetedProjectKey = "target",
                ShouldOverWriteExistingData = false,
                TrackerId = "tracker-empty"
            };

            await consumer.Consume(@event);

            migrationRepository.Verify(x => x.GetExistingModulesByNamesAsync(It.IsAny<List<string>>(), It.IsAny<string>()), Times.Never);
            migrationRepository.Verify(x => x.BulkUpsertModulesByNameAsync(It.IsAny<List<BlocksLanguageModule>>(), It.IsAny<string>(), It.IsAny<bool>()), Times.Never);
            messageClient.Verify(x => x.SendToMassConsumerAsync(
                It.Is<ConsumerMessage<MigrationCompletionEvent>>(m =>
                    m.Payload.TrackerId == "tracker-empty" &&
                    m.Payload.IsSuccess)), Times.Once);
        }

        [Fact]
        public async Task EnvironmentDataMigrationEventConsumer_Consume_WhenSourceModuleIsNewInTarget_GeneratesNewItemId()
        {
            var keyManagementService = new Mock<IKeyManagementService>();
            var migrationRepository = new Mock<IEnvironmentDataMigrationRepository>();
            var logger = new Mock<ILogger<EnvironmentDataMigrationEventConsumer>>();
            var messageClient = new Mock<IMessageClient>();

            var sourceModules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule
                {
                    ItemId = "src-mod-new",
                    ModuleName = "NewModule",
                    Name = "NewModule",
                    CreateDate = DateTime.UtcNow.AddDays(-5),
                    LastUpdateDate = DateTime.UtcNow.AddDays(-1),
                    TenantId = "source",
                    CreatedBy = "user-1",
                    LastUpdatedBy = "user-1"
                }
            };

            migrationRepository.Setup(x => x.GetAllModulesAsync("source")).ReturnsAsync(sourceModules);
            migrationRepository.Setup(x => x.GetExistingModulesByNamesAsync(It.IsAny<List<string>>(), "target"))
                .ReturnsAsync(new List<BlocksLanguageModule>()); // No existing modules in target
            migrationRepository.Setup(x => x.BulkUpsertModulesByNameAsync(It.IsAny<List<BlocksLanguageModule>>(), "target", false))
                .Returns(Task.CompletedTask);

            // Keys
            migrationRepository.Setup(x => x.GetAllKeysAsync("source")).ReturnsAsync(new List<BlocksLanguageKey>());

            messageClient.Setup(x => x.SendToMassConsumerAsync(It.IsAny<ConsumerMessage<MigrationCompletionEvent>>()))
                .Returns(Task.CompletedTask);

            var consumer = new EnvironmentDataMigrationEventConsumer(
                keyManagementService.Object,
                migrationRepository.Object,
                logger.Object,
                messageClient.Object);

            var @event = new EnvironmentDataMigrationEvent
            {
                ProjectKey = "source",
                TargetedProjectKey = "target",
                ShouldOverWriteExistingData = false,
                TrackerId = "tracker-new-module"
            };

            await consumer.Consume(@event);

            migrationRepository.Verify(x => x.BulkUpsertModulesByNameAsync(
                It.Is<List<BlocksLanguageModule>>(modules =>
                    modules.Count == 1 &&
                    modules[0].ItemId != "src-mod-new" && // Should get a new GUID, not source ItemId
                    modules[0].ModuleName == "NewModule" &&
                    modules[0].TenantId == "target" &&
                    modules[0].CreatedBy == "user-1"), // Falls through to source CreatedBy
                "target",
                false), Times.Once);
        }

        [Fact]
        public async Task EnvironmentDataMigrationEventConsumer_Consume_WhenNoSourceKeys_SkipsKeyMigration()
        {
            var keyManagementService = new Mock<IKeyManagementService>();
            var migrationRepository = new Mock<IEnvironmentDataMigrationRepository>();
            var logger = new Mock<ILogger<EnvironmentDataMigrationEventConsumer>>();
            var messageClient = new Mock<IMessageClient>();

            var sourceModules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule
                {
                    ItemId = "src-mod-1",
                    ModuleName = "Mod1",
                    Name = "Mod1",
                    CreateDate = DateTime.UtcNow,
                    LastUpdateDate = DateTime.UtcNow,
                    TenantId = "source",
                    CreatedBy = "user",
                    LastUpdatedBy = "user"
                }
            };

            migrationRepository.Setup(x => x.GetAllModulesAsync("source")).ReturnsAsync(sourceModules);
            migrationRepository.Setup(x => x.GetExistingModulesByNamesAsync(It.IsAny<List<string>>(), "target"))
                .ReturnsAsync(new List<BlocksLanguageModule>());
            migrationRepository.Setup(x => x.BulkUpsertModulesByNameAsync(It.IsAny<List<BlocksLanguageModule>>(), "target", false))
                .Returns(Task.CompletedTask);

            migrationRepository.Setup(x => x.GetAllKeysAsync("source")).ReturnsAsync(new List<BlocksLanguageKey>());

            messageClient.Setup(x => x.SendToMassConsumerAsync(It.IsAny<ConsumerMessage<MigrationCompletionEvent>>()))
                .Returns(Task.CompletedTask);

            var consumer = new EnvironmentDataMigrationEventConsumer(
                keyManagementService.Object,
                migrationRepository.Object,
                logger.Object,
                messageClient.Object);

            var @event = new EnvironmentDataMigrationEvent
            {
                ProjectKey = "source",
                TargetedProjectKey = "target",
                ShouldOverWriteExistingData = false,
                TrackerId = "tracker-no-keys"
            };

            await consumer.Consume(@event);

            migrationRepository.Verify(x => x.GetExistingKeysByModuleNameAndKeyNameAsync(
                It.IsAny<List<(string, string)>>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>()), Times.Never);
            migrationRepository.Verify(x => x.BulkUpsertKeysByModuleNameAndKeyNameAsync(
                It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<string>(), It.IsAny<bool>()), Times.Never);
        }

        [Fact]
        public async Task EnvironmentDataMigrationEventConsumer_Consume_WhenKeyModuleIdNotInSourceMapping_SkipsKey()
        {
            var keyManagementService = new Mock<IKeyManagementService>();
            var migrationRepository = new Mock<IEnvironmentDataMigrationRepository>();
            var logger = new Mock<ILogger<EnvironmentDataMigrationEventConsumer>>();
            var messageClient = new Mock<IMessageClient>();

            var sourceModules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule
                {
                    ItemId = "src-mod-1",
                    ModuleName = "Mod1",
                    Name = "Mod1",
                    CreateDate = DateTime.UtcNow,
                    LastUpdateDate = DateTime.UtcNow,
                    TenantId = "source",
                    CreatedBy = "user",
                    LastUpdatedBy = "user"
                }
            };

            var targetModules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule
                {
                    ItemId = "target-mod-1",
                    ModuleName = "Mod1",
                    Name = "Mod1",
                    CreateDate = DateTime.UtcNow,
                    LastUpdateDate = DateTime.UtcNow,
                    TenantId = "target",
                    CreatedBy = "user",
                    LastUpdatedBy = "user"
                }
            };

            // Key references a module that doesn't exist in source
            var sourceKeys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "src-key-orphan",
                    KeyName = "OrphanKey",
                    ModuleId = "non-existent-module-id",
                    Value = "Orphan",
                    Resources = new[] { new Resource { Culture = "en", Value = "Orphan", CharacterLength = 6 } },
                    Routes = new List<string>(),
                    IsPartiallyTranslated = false,
                    CreateDate = DateTime.UtcNow,
                    LastUpdateDate = DateTime.UtcNow,
                    TenantId = "source",
                    CreatedBy = "user",
                    LastUpdatedBy = "user"
                }
            };

            migrationRepository.Setup(x => x.GetAllModulesAsync("source")).ReturnsAsync(sourceModules);
            migrationRepository.Setup(x => x.GetExistingModulesByNamesAsync(It.IsAny<List<string>>(), "target"))
                .ReturnsAsync(targetModules);
            migrationRepository.Setup(x => x.BulkUpsertModulesByNameAsync(It.IsAny<List<BlocksLanguageModule>>(), "target", false))
                .Returns(Task.CompletedTask);

            migrationRepository.Setup(x => x.GetAllKeysAsync("source")).ReturnsAsync(sourceKeys);
            // When MigrateKeysAsync calls GetAllModulesAsync again for both source and target
            migrationRepository.Setup(x => x.GetAllModulesAsync("target")).ReturnsAsync(targetModules);
            migrationRepository.Setup(x => x.GetExistingKeysByModuleNameAndKeyNameAsync(
                It.IsAny<List<(string, string)>>(), It.IsAny<Dictionary<string, string>>(), "target"))
                .ReturnsAsync(new List<BlocksLanguageKey>());
            migrationRepository.Setup(x => x.BulkUpsertKeysByModuleNameAndKeyNameAsync(
                It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<Dictionary<string, string>>(), "target", false))
                .ReturnsAsync(new BulkUpsertResult());

            messageClient.Setup(x => x.SendToMassConsumerAsync(It.IsAny<ConsumerMessage<MigrationCompletionEvent>>()))
                .Returns(Task.CompletedTask);

            var consumer = new EnvironmentDataMigrationEventConsumer(
                keyManagementService.Object,
                migrationRepository.Object,
                logger.Object,
                messageClient.Object);

            var @event = new EnvironmentDataMigrationEvent
            {
                ProjectKey = "source",
                TargetedProjectKey = "target",
                ShouldOverWriteExistingData = false,
                TrackerId = "tracker-orphan"
            };

            await consumer.Consume(@event);

            // The orphan key should be skipped - 0 keys upserted
            migrationRepository.Verify(x => x.BulkUpsertKeysByModuleNameAndKeyNameAsync(
                It.Is<List<BlocksLanguageKey>>(keys => keys.Count == 0),
                It.IsAny<List<BlocksLanguageKey>>(),
                It.IsAny<Dictionary<string, string>>(),
                "target",
                false), Times.Once);
        }

        [Fact]
        public async Task EnvironmentDataMigrationEventConsumer_Consume_WhenKeyModuleNotInTarget_SkipsKey()
        {
            var keyManagementService = new Mock<IKeyManagementService>();
            var migrationRepository = new Mock<IEnvironmentDataMigrationRepository>();
            var logger = new Mock<ILogger<EnvironmentDataMigrationEventConsumer>>();
            var messageClient = new Mock<IMessageClient>();

            var sourceModules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule
                {
                    ItemId = "src-mod-1",
                    ModuleName = "Mod1",
                    Name = "Mod1",
                    CreateDate = DateTime.UtcNow,
                    LastUpdateDate = DateTime.UtcNow,
                    TenantId = "source",
                    CreatedBy = "user",
                    LastUpdatedBy = "user"
                }
            };

            // Source key belongs to Mod1, but target has no module named Mod1
            var sourceKeys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "src-key-1",
                    KeyName = "SomeKey",
                    ModuleId = "src-mod-1",
                    Value = "val",
                    Resources = new[] { new Resource { Culture = "en", Value = "val", CharacterLength = 3 } },
                    Routes = new List<string>(),
                    IsPartiallyTranslated = false,
                    CreateDate = DateTime.UtcNow,
                    LastUpdateDate = DateTime.UtcNow,
                    TenantId = "source",
                    CreatedBy = "user",
                    LastUpdatedBy = "user"
                }
            };

            migrationRepository.Setup(x => x.GetAllModulesAsync("source")).ReturnsAsync(sourceModules);
            migrationRepository.Setup(x => x.GetExistingModulesByNamesAsync(It.IsAny<List<string>>(), "target"))
                .ReturnsAsync(new List<BlocksLanguageModule>());
            migrationRepository.Setup(x => x.BulkUpsertModulesByNameAsync(It.IsAny<List<BlocksLanguageModule>>(), "target", false))
                .Returns(Task.CompletedTask);

            migrationRepository.Setup(x => x.GetAllKeysAsync("source")).ReturnsAsync(sourceKeys);
            // Target has no modules at all
            migrationRepository.Setup(x => x.GetAllModulesAsync("target")).ReturnsAsync(new List<BlocksLanguageModule>());
            migrationRepository.Setup(x => x.GetExistingKeysByModuleNameAndKeyNameAsync(
                It.IsAny<List<(string, string)>>(), It.IsAny<Dictionary<string, string>>(), "target"))
                .ReturnsAsync(new List<BlocksLanguageKey>());
            migrationRepository.Setup(x => x.BulkUpsertKeysByModuleNameAndKeyNameAsync(
                It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<Dictionary<string, string>>(), "target", false))
                .ReturnsAsync(new BulkUpsertResult());

            messageClient.Setup(x => x.SendToMassConsumerAsync(It.IsAny<ConsumerMessage<MigrationCompletionEvent>>()))
                .Returns(Task.CompletedTask);

            var consumer = new EnvironmentDataMigrationEventConsumer(
                keyManagementService.Object,
                migrationRepository.Object,
                logger.Object,
                messageClient.Object);

            var @event = new EnvironmentDataMigrationEvent
            {
                ProjectKey = "source",
                TargetedProjectKey = "target",
                ShouldOverWriteExistingData = false,
                TrackerId = "tracker-no-target-mod"
            };

            await consumer.Consume(@event);

            // Key should be skipped because target has no matching module
            migrationRepository.Verify(x => x.BulkUpsertKeysByModuleNameAndKeyNameAsync(
                It.Is<List<BlocksLanguageKey>>(keys => keys.Count == 0),
                It.IsAny<List<BlocksLanguageKey>>(),
                It.IsAny<Dictionary<string, string>>(),
                "target",
                false), Times.Once);
        }

        [Fact]
        public async Task EnvironmentDataMigrationEventConsumer_Consume_WhenNotOverwriteAndNoInsertedKeys_SkipsTimelineCreation()
        {
            var keyManagementService = new Mock<IKeyManagementService>();
            var migrationRepository = new Mock<IEnvironmentDataMigrationRepository>();
            var logger = new Mock<ILogger<EnvironmentDataMigrationEventConsumer>>();
            var messageClient = new Mock<IMessageClient>();

            var sourceModules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule
                {
                    ItemId = "src-mod-1",
                    ModuleName = "Mod1",
                    Name = "Mod1",
                    CreateDate = DateTime.UtcNow,
                    LastUpdateDate = DateTime.UtcNow,
                    TenantId = "source",
                    CreatedBy = "user",
                    LastUpdatedBy = "user"
                }
            };

            var targetModules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule
                {
                    ItemId = "target-mod-1",
                    ModuleName = "Mod1",
                    Name = "Mod1",
                    CreateDate = DateTime.UtcNow,
                    LastUpdateDate = DateTime.UtcNow,
                    TenantId = "target",
                    CreatedBy = "user",
                    LastUpdatedBy = "user"
                }
            };

            var sourceKeys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "src-key-1",
                    KeyName = "Key1",
                    ModuleId = "src-mod-1",
                    Value = "val",
                    Resources = new[] { new Resource { Culture = "en", Value = "val", CharacterLength = 3 } },
                    Routes = new List<string>(),
                    IsPartiallyTranslated = false,
                    CreateDate = DateTime.UtcNow,
                    LastUpdateDate = DateTime.UtcNow,
                    TenantId = "source",
                    CreatedBy = "user",
                    LastUpdatedBy = "user"
                }
            };

            // Existing target key means it won't be inserted (not overwriting)
            var existingTargetKeys = new List<BlocksLanguageKey>
            {
                new BlocksLanguageKey
                {
                    ItemId = "target-key-1",
                    KeyName = "Key1",
                    ModuleId = "target-mod-1",
                    Value = "existing-val",
                    Resources = new[] { new Resource { Culture = "en", Value = "existing-val", CharacterLength = 12 } },
                    Routes = new List<string>(),
                    IsPartiallyTranslated = false,
                    CreateDate = DateTime.UtcNow,
                    LastUpdateDate = DateTime.UtcNow,
                    TenantId = "target",
                    CreatedBy = "user",
                    LastUpdatedBy = "user"
                }
            };

            migrationRepository.Setup(x => x.GetAllModulesAsync("source")).ReturnsAsync(sourceModules);
            migrationRepository.Setup(x => x.GetAllModulesAsync("target")).ReturnsAsync(targetModules);
            migrationRepository.Setup(x => x.GetExistingModulesByNamesAsync(It.IsAny<List<string>>(), "target"))
                .ReturnsAsync(targetModules);
            migrationRepository.Setup(x => x.BulkUpsertModulesByNameAsync(It.IsAny<List<BlocksLanguageModule>>(), "target", false))
                .Returns(Task.CompletedTask);

            migrationRepository.Setup(x => x.GetAllKeysAsync("source")).ReturnsAsync(sourceKeys);
            migrationRepository.Setup(x => x.GetExistingKeysByModuleNameAndKeyNameAsync(
                It.IsAny<List<(string, string)>>(), It.IsAny<Dictionary<string, string>>(), "target"))
                .ReturnsAsync(existingTargetKeys);
            migrationRepository.Setup(x => x.BulkUpsertKeysByModuleNameAndKeyNameAsync(
                It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<Dictionary<string, string>>(), "target", false))
                .ReturnsAsync(new BulkUpsertResult { InsertedKeys = new List<BlocksLanguageKey>() }); // No inserted keys

            messageClient.Setup(x => x.SendToMassConsumerAsync(It.IsAny<ConsumerMessage<MigrationCompletionEvent>>()))
                .Returns(Task.CompletedTask);

            var consumer = new EnvironmentDataMigrationEventConsumer(
                keyManagementService.Object,
                migrationRepository.Object,
                logger.Object,
                messageClient.Object);

            var @event = new EnvironmentDataMigrationEvent
            {
                ProjectKey = "source",
                TargetedProjectKey = "target",
                ShouldOverWriteExistingData = false,
                TrackerId = "tracker-no-inserts"
            };

            await consumer.Consume(@event);

            // No timeline entries should be created since no keys were inserted
            keyManagementService.Verify(x => x.CreateBulkKeyTimelineEntriesAsync(
                It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
            keyManagementService.Verify(x => x.CreateBulkKeyTimelineEntriesAsync(
                It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task EnvironmentDataMigrationEventConsumer_Consume_OnFailure_WhenTrackerStatusLoggingFails_StillPublishesFailureAndRethrows()
        {
            var keyManagementService = new Mock<IKeyManagementService>();
            var migrationRepository = new Mock<IEnvironmentDataMigrationRepository>();
            var logger = new Mock<ILogger<EnvironmentDataMigrationEventConsumer>>();
            var messageClient = new Mock<IMessageClient>();

            migrationRepository.Setup(x => x.GetAllModulesAsync("source"))
                .ThrowsAsync(new InvalidOperationException("boom"));
            messageClient.Setup(x => x.SendToMassConsumerAsync(It.IsAny<ConsumerMessage<MigrationCompletionEvent>>()))
                .Returns(Task.CompletedTask);
            keyManagementService.Setup(x => x.PublishEnvironmentDataMigrationNotification(false, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .Returns(Task.CompletedTask);

            logger.Setup(x => x.Log(
                    LogLevel.Information,
                    It.IsAny<EventId>(),
                    It.Is<It.IsAnyType>((v, _) => v.ToString() != null && v.ToString()!.Contains("Updated migration tracker")),
                    It.IsAny<Exception?>(),
                    It.IsAny<Func<It.IsAnyType, Exception?, string>>()))
                .Throws(new Exception("logger-info-failed"));

            var consumer = new EnvironmentDataMigrationEventConsumer(
                keyManagementService.Object,
                migrationRepository.Object,
                logger.Object,
                messageClient.Object);

            var @event = new EnvironmentDataMigrationEvent
            {
                ProjectKey = "source",
                TargetedProjectKey = "target",
                ShouldOverWriteExistingData = true,
                TrackerId = "tracker-logger-failure"
            };

            var action = async () => await consumer.Consume(@event);

            await action.Should().ThrowAsync<InvalidOperationException>();

            messageClient.Verify(x => x.SendToMassConsumerAsync(
                It.Is<ConsumerMessage<MigrationCompletionEvent>>(m =>
                    m.Payload.TrackerId == "tracker-logger-failure" &&
                    m.Payload.IsSuccess == false)), Times.Once);

            keyManagementService.Verify(x => x.PublishEnvironmentDataMigrationNotification(
                false,
                "tracker-logger-failure",
                "source",
                "target"), Times.Once);
        }
    }
}
