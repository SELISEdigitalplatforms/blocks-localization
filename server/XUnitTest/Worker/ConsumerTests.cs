using Eurolm.DomainService.Repositories;
using Microsoft.Extensions.Logging;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared.Events;
using FluentAssertions;
using Moq;
using Blocks.Genesis;
using System.Text.Json;
using Worker.Consumers;
using Xunit;

namespace XUnitTest
{
    public class ConsumerTests
    {
        private readonly Mock<IKeyManagementService> _keyManagementService = new();
        private readonly Mock<IWebHookService> _webHookService = new();
        private readonly Mock<IActionPublisher> _actions = new();
        private readonly List<(string Action, string Json)> _published = new();

        public ConsumerTests()
        {
            _actions.Setup(a => a.PublishAsync(It.IsAny<string>(), It.IsAny<object?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
                .Callback<string, object?, string?, CancellationToken>((name, data, _, _) => _published.Add((name, JsonSerializer.Serialize(data))))
                .Returns(Task.CompletedTask);
        }

        [Fact]
        public async Task GenerateUilmFilesConsumer_Consume_GeneratesAndCallsWebhook()
        {
            var evt = new GenerateUilmFilesEvent { ModuleId = "m1", ProjectKey = "p1", Guid = "g1" };
            _keyManagementService.Setup(x => x.GenerateAsync(evt)).ReturnsAsync(true);

            var consumer = new GenerateUilmFilesConsumer(_keyManagementService.Object, _webHookService.Object, _actions.Object);
            await consumer.Consume(evt);

            _keyManagementService.Verify(x => x.GenerateAsync(evt), Times.Once);
            _webHookService.Verify(x => x.CallWebhook(It.IsAny<object>()), Times.Once);
            _published.Should().ContainSingle().Which.Should().Be(("localization.files.generated",
                "{\"generationId\":\"g1\",\"moduleId\":\"m1\",\"projectKey\":\"p1\",\"isSuccess\":true}"));
        }

        [Fact]
        public async Task GenerateUilmFilesConsumer_Consume_WhenGenerationFails_PublishesIsSuccessFalse_AndStillCallsWebhook()
        {
            var evt = new GenerateUilmFilesEvent { ModuleId = "m1", ProjectKey = "p1", Guid = "g1" };
            _keyManagementService.Setup(x => x.GenerateAsync(evt)).ReturnsAsync(false);

            await new GenerateUilmFilesConsumer(_keyManagementService.Object, _webHookService.Object, _actions.Object).Consume(evt);

            _webHookService.Verify(x => x.CallWebhook(It.IsAny<object>()), Times.Once);
            _published.Should().ContainSingle().Which.Json.Should().Contain("\"isSuccess\":false");
        }

        [Fact]
        public async Task TranslateAllEventConsumer_Consume_ChangesPublishesAndCallsWebhook()
        {
            var evt = new TranslateAllEvent { MessageCoRelationId = "cor-1", ProjectKey = "p1", DefaultLanguage = "en" };
            _keyManagementService.Setup(x => x.ChangeAll(evt)).ReturnsAsync(true);

            var consumer = new TranslateAllEventConsumer(_keyManagementService.Object, _webHookService.Object, _actions.Object);
            await consumer.Consume(evt);

            _keyManagementService.Verify(x => x.ChangeAll(evt), Times.Once);
            _keyManagementService.Verify(x => x.PublishTranslateAllNotification(true, "cor-1"), Times.Once);
            _webHookService.Verify(x => x.CallWebhook(It.IsAny<object>()), Times.Once);
            _published.Should().ContainSingle().Which.Should().Be(("localization.translation.completed",
                "{\"moduleId\":null,\"projectKey\":\"p1\",\"defaultLanguage\":\"en\",\"isSuccess\":true}"));
        }

        [Fact]
        public async Task TranslateAllEventConsumer_Consume_WhenChangeAllFails_PublishesIsSuccessFalse()
        {
            var evt = new TranslateAllEvent { MessageCoRelationId = "cor-1", ProjectKey = "p1", DefaultLanguage = "en" };
            _keyManagementService.Setup(x => x.ChangeAll(evt)).ReturnsAsync(false);

            await new TranslateAllEventConsumer(_keyManagementService.Object, _webHookService.Object, _actions.Object).Consume(evt);

            _published.Should().ContainSingle().Which.Json.Should().Contain("\"isSuccess\":false");
        }

        [Fact]
        public async Task RecheckGlossaryViolationsEventConsumer_Consume_RunsTheRecheck()
        {
            var evt = new RecheckGlossaryViolationsEvent { ProjectKey = "p1", GlossaryId = "g1" };
            var recheck = new Mock<IGlossaryRecheckService>();
            recheck.Setup(x => x.RecheckAsync(evt)).ReturnsAsync(new GlossaryRecheckResult { Ran = true });

            await new RecheckGlossaryViolationsEventConsumer(recheck.Object).Consume(evt);

            recheck.Verify(x => x.RecheckAsync(evt), Times.Once);
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

            var consumer = new UilmImportEventConsumer(_keyManagementService.Object, _webHookService.Object, new Mock<ILocalizationUniquenessRepository>().Object, new Mock<ILogger<UilmImportEventConsumer>>().Object, _actions.Object);
            await consumer.Consume(evt);

            _keyManagementService.Verify(x => x.ImportUilmFile(evt), Times.Once);
            _webHookService.Verify(x => x.CallWebhook(It.IsAny<object>()), Times.Once);
            _published.Should().ContainSingle().Which.Should().Be(("localization.import.completed",
                "{\"fileId\":\"f1\",\"projectKey\":\"p1\",\"isSuccess\":true}"));
        }

        [Fact]
        public async Task UilmImportEventConsumer_Consume_WhenFailure_SkipsOldWebhook_ButPublishesTheAction()
        {
            var evt = new UilmImportEvent { FileId = "f1", MessageCoRelationId = "cor-4", ProjectKey = "p1" };
            _keyManagementService.Setup(x => x.ImportUilmFile(evt)).ReturnsAsync(false);

            var consumer = new UilmImportEventConsumer(_keyManagementService.Object, _webHookService.Object, new Mock<ILocalizationUniquenessRepository>().Object, new Mock<ILogger<UilmImportEventConsumer>>().Object, _actions.Object);
            await consumer.Consume(evt);

            _keyManagementService.Verify(x => x.ImportUilmFile(evt), Times.Once);
            _webHookService.Verify(x => x.CallWebhook(It.IsAny<object>()), Times.Never);
            // The new action is sent on failure too; only the old webhook stays success-only.
            _published.Should().ContainSingle().Which.Should().Be(("localization.import.completed",
                "{\"fileId\":\"f1\",\"projectKey\":\"p1\",\"isSuccess\":false}"));
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
