using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared.Events;
using FluentAssertions;
using Moq;
using Worker.Consumers;
using Xunit;

namespace XUnitTest
{
    public class ConsumerTests
    {
        private readonly Mock<IKeyManagementService> _keyManagementService = new();
        private readonly Mock<IWebHookService> _webHookService = new();

        [Fact]
        public async Task GenerateUilmFilesConsumer_Consume_GeneratesAndCallsWebhook()
        {
            var evt = new GenerateUilmFilesEvent { ModuleId = "m1", ProjectKey = "p1", Guid = "g1" };
            _keyManagementService.Setup(x => x.GenerateAsync(evt)).ReturnsAsync(true);

            var consumer = new GenerateUilmFilesConsumer(_keyManagementService.Object, _webHookService.Object);
            await consumer.Consume(evt);

            _keyManagementService.Verify(x => x.GenerateAsync(evt), Times.Once);
            _webHookService.Verify(x => x.CallWebhook(It.IsAny<object>()), Times.Once);
        }

        [Fact]
        public async Task TranslateAllEventConsumer_Consume_ChangesPublishesAndCallsWebhook()
        {
            var evt = new TranslateAllEvent { MessageCoRelationId = "cor-1", ProjectKey = "p1", DefaultLanguage = "en" };
            _keyManagementService.Setup(x => x.ChangeAll(evt)).ReturnsAsync(true);

            var consumer = new TranslateAllEventConsumer(_keyManagementService.Object, _webHookService.Object);
            await consumer.Consume(evt);

            _keyManagementService.Verify(x => x.ChangeAll(evt), Times.Once);
            _keyManagementService.Verify(x => x.PublishTranslateAllNotification(true, "cor-1"), Times.Once);
            _webHookService.Verify(x => x.CallWebhook(It.IsAny<object>()), Times.Once);
        }

        [Fact]
        public async Task TranslateBlocksLanguageKeyEventConsumer_Consume_TranslatesAndPublishes()
        {
            var evt = new TranslateBlocksLanguageKeyEvent { MessageCoRelationId = "cor-2", KeyId = "k1", DefaultLanguage = "en" };
            _keyManagementService.Setup(x => x.TranslateBlocksLanguageKey(evt)).ReturnsAsync(true);

            var consumer = new TranslateBlocksLanguageKeyEventConsumer(_keyManagementService.Object);
            await consumer.Consume(evt);

            _keyManagementService.Verify(x => x.TranslateBlocksLanguageKey(evt), Times.Once);
            _keyManagementService.Verify(x => x.PublishTranslateBlocksLanguageKeyNotification(true, "cor-2"), Times.Once);
        }

        [Fact]
        public async Task TranslateBlocksLanguageKeysEventConsumer_Consume_TranslatesAndPublishes()
        {
            var evt = new TranslateBlocksLanguageKeysEvent { MessageCoRelationId = "cor-3", KeyIds = new List<string> { "k1" }, DefaultLanguage = "en", OperationId = "op-1" };
            _keyManagementService.Setup(x => x.TranslateBlocksLanguageKeys(evt)).ReturnsAsync(false);

            var consumer = new TranslateBlocksLanguageKeysEventConsumer(_keyManagementService.Object);
            await consumer.Consume(evt);

            _keyManagementService.Verify(x => x.TranslateBlocksLanguageKeys(evt), Times.Once);
            _keyManagementService.Verify(x => x.PublishTranslateBlocksLanguageKeyNotification(false, "cor-3"), Times.Once);
        }

        [Fact]
        public async Task UilmImportEventConsumer_Consume_WhenSuccess_CallsWebhook()
        {
            var evt = new UilmImportEvent { FileId = "f1", MessageCoRelationId = "cor-4", ProjectKey = "p1" };
            _keyManagementService.Setup(x => x.ImportUilmFile(evt)).ReturnsAsync(true);

            var consumer = new UilmImportEventConsumer(_keyManagementService.Object, _webHookService.Object);
            await consumer.Consume(evt);

            _keyManagementService.Verify(x => x.ImportUilmFile(evt), Times.Once);
            _webHookService.Verify(x => x.CallWebhook(It.IsAny<object>()), Times.Once);
        }

        [Fact]
        public async Task UilmImportEventConsumer_Consume_WhenFailure_DoesNotCallWebhook()
        {
            var evt = new UilmImportEvent { FileId = "f1", MessageCoRelationId = "cor-4", ProjectKey = "p1" };
            _keyManagementService.Setup(x => x.ImportUilmFile(evt)).ReturnsAsync(false);

            var consumer = new UilmImportEventConsumer(_keyManagementService.Object, _webHookService.Object);
            await consumer.Consume(evt);

            _keyManagementService.Verify(x => x.ImportUilmFile(evt), Times.Once);
            _webHookService.Verify(x => x.CallWebhook(It.IsAny<object>()), Times.Never);
        }

        [Fact]
        public async Task UilmExportEventConsumer_Consume_ExportsAndPublishesNotification()
        {
            var evt = new UilmExportEvent
            {
                FileId = "file-9",
                MessageCoRelationId = "cor-5",
                CallerTenantId = "tenant-x",
                ProjectKey = "p1"
            };
            _keyManagementService.Setup(x => x.ExportUilmFile(evt)).ReturnsAsync(true);

            var consumer = new UilmExportEventConsumer(_keyManagementService.Object);
            await consumer.Consume(evt);

            _keyManagementService.Verify(x => x.ExportUilmFile(evt), Times.Once);
            _keyManagementService.Verify(x => x.PublishUilmExportNotification(true, "file-9", "cor-5", "tenant-x"), Times.Once);
        }
    }
}
