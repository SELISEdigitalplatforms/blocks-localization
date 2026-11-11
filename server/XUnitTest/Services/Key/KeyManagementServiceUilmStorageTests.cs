using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Services.UilmStorage;
using Eurolm.DomainService.Shared.Events;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.Extensions.Logging;
using Moq;
using StorageDriver;
using XUnitTest.Shared;
using KeyModel = Eurolm.DomainService.Services.Key;
using KeyTimeline = Eurolm.DomainService.Services.KeyTimeline;

namespace XUnitTest.Services.Key
{
    /// <summary>The publish flow around the file publisher (spec 6.8): history, per-module failure, key order, SaveKeys events.</summary>
    public class KeyManagementServiceUilmStorageTests
    {
        private readonly Mock<IKeyRepository> _keys = new();
        private readonly Mock<IKeyTimelineRepository> _timeline = new();
        private readonly Mock<ILanguageFileGenerationHistoryRepository> _history = new();
        private readonly Mock<IValidator<KeyModel>> _validator = new();
        private readonly Mock<ILanguageManagementService> _languages = new();
        private readonly Mock<IModuleManagementService> _modules = new();
        private readonly Mock<IMessageClient> _messages = new();
        private readonly Mock<IUilmFilePublisher> _publisher = new();
        private readonly List<GenerateUilmFilesEvent> _sent = new();
        private readonly List<LanguageFileGenerationHistory> _historyRows = new();
        private readonly KeyManagementService _service;

        public KeyManagementServiceUilmStorageTests()
        {
            TestBlocksContext.Set("tenant-1");
            _validator.Setup(v => v.ValidateAsync(It.IsAny<KeyModel>(), default)).ReturnsAsync(new ValidationResult());
            _keys.Setup(r => r.GetKeysByNameAndModuleAsync(It.IsAny<IReadOnlyCollection<(string KeyName, string ModuleId)>>()))
                .ReturnsAsync(new List<BlocksLanguageKey>());
            _keys.Setup(r => r.BulkSaveKeysAsync(It.IsAny<IReadOnlyList<KeyBulkSave>>())).ReturnsAsync(Array.Empty<KeyBulkSaveError>());
            _messages.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<GenerateUilmFilesEvent>>()))
                .Callback((ConsumerMessage<GenerateUilmFilesEvent> m) => _sent.Add(m.Payload))
                .Returns(Task.CompletedTask);
            _history.Setup(h => h.SaveAsync(It.IsAny<LanguageFileGenerationHistory>()))
                .Callback<LanguageFileGenerationHistory>(_historyRows.Add)
                .Returns(Task.CompletedTask);
            _languages.Setup(l => l.GetLanguagesAsync()).ReturnsAsync(() => new List<Language> { new() { LanguageCode = "en-US", LanguageName = "English" } });
            _publisher.Setup(p => p.BeginAsync("tenant-1", It.IsAny<bool>()))
                .ReturnsAsync((string _, bool force) => new UilmPublishSession(12, true, force));

            var storageDriver = new Mock<IStorageDriverService>();
            _service = new KeyManagementService(_keys.Object, _timeline.Object, _history.Object, _validator.Object,
                new Mock<ILogger<KeyManagementService>>().Object, _languages.Object, _modules.Object, _messages.Object,
                new Mock<IAssistantService>().Object, storageDriver.Object,
                new StorageHelper(new Mock<ILogger<StorageHelper>>().Object, storageDriver.Object),
                new Mock<IServiceProvider>().Object, new Mock<INotificationService>().Object, new Mock<IGlossaryRepository>().Object,
                _publisher.Object);
        }

        private static bool IsGuid(string value) => Guid.TryParse(value, out var _);

        private static KeyModel NewKey(string name, string module, bool publish) => new()
        {
            ItemId = "id-" + name,
            KeyName = name,
            ModuleId = module,
            ShouldPublish = publish,
            Resources = new[] { new Resource { Culture = "en-US", Value = "Text " + name } }
        };

        private void Modules(params (string Id, string Name, UilmModulePublishResult? Result)[] modules)
        {
            _modules.Setup(m => m.GetModulesAsync((string?)null)).ReturnsAsync(modules.Select(m => new BlocksLanguageModule { ItemId = m.Id, ModuleName = m.Name }).ToList());
            foreach (var module in modules)
            {
                _keys.Setup(k => k.GetAllKeysByModuleAsync(module.Id)).ReturnsAsync(new List<KeyModel> { NewKey(module.Name + ".title", module.Id, false) });
                var setup = _publisher.Setup(p => p.PublishModuleAsync(It.IsAny<UilmPublishSession>(), module.Name, It.IsAny<IReadOnlyList<UilmFile>>()));
                if (module.Result is { } result) setup.ReturnsAsync(result);
                else setup.ThrowsAsync(new InvalidOperationException("database down"));
            }
        }

        // ---- SaveKeys (H9, Q2: A) ----

        [Fact]
        public async Task SaveKeys_SendsOnePublishEventPerModule_WithANewGenerationId_H9_E8()
        {
            var keys = Enumerable.Range(0, 100).Select(i => NewKey($"k{i}", "riqs", true))
                .Append(NewKey("b1", "other", true))
                .Append(NewKey("b2", "other", false))
                .Append(NewKey("c1", "quiet", false))
                .ToList();

            var response = await _service.SaveKeysAsync(keys);

            response.Success.Should().BeTrue();
            _sent.Select(e => e.ModuleId).Should().Equal("riqs", "other");
            _sent.Should().OnlyContain(e => e.ProjectKey == "tenant-1" && !e.ForceUpload && IsGuid(e.Guid));
            _sent.Select(e => e.Guid).Should().OnlyHaveUniqueItems().And.NotContain(keys.Select(k => k.ItemId));
        }

        [Fact]
        public async Task SaveKeys_FailedSend_GivesEachPublishedKeyOfThatModuleAnErrorLine_AndKeepsTheirTimeline()
        {
            _messages.Setup(m => m.SendToConsumerAsync(It.Is<ConsumerMessage<GenerateUilmFilesEvent>>(c => c.Payload.ModuleId == "riqs")))
                .ThrowsAsync(new InvalidOperationException("broker down"));
            var keys = new List<KeyModel> { NewKey("a", "riqs", true), NewKey("b", "riqs", true), NewKey("c", "riqs", false), NewKey("d", "other", true) };

            var response = await _service.SaveKeysAsync(keys);

            response.Success.Should().BeFalse();
            response.ErrorMessage.Should().StartWith("Bulk save completed with 2 errors out of 4 keys");
            response.ErrorMessage.Should().Contain("broker down");
            _sent.Select(e => e.ModuleId).Should().Equal("other");
            _timeline.Verify(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()), Times.Exactly(4));
        }

        [Fact]
        public async Task SaveKeys_WithoutShouldPublish_SendsNothing()
        {
            await _service.SaveKeysAsync(new List<KeyModel> { NewKey("a", "riqs", false) });

            _sent.Should().BeEmpty();
        }

        // ---- Publish (6.8) ----

        [Fact]
        public async Task Generate_WritesOneHistoryRow_WithTheSessionVersionStatusAndCounts_H10()
        {
            Modules(("m1", "auth", new UilmModulePublishResult(2, 6, false)), ("m2", "dashboard", new UilmModulePublishResult(1, 7, false)));

            await _service.GenerateAsync(new GenerateUilmFilesEvent { Guid = "g", ProjectKey = "tenant-1" });

            var row = _historyRows.Should().ContainSingle().Subject;
            row.Version.Should().Be(12);
            row.Status.Should().Be("Success");
            row.UploadedFiles.Should().Be(3);
            row.SkippedFiles.Should().Be(13);
            row.FailedModules.Should().BeEmpty();
            _history.Verify(h => h.GetLatestLanguageFileGenerationHistory(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Generate_FailedModule_IsPartial_AndOnlyItsKeysArePublishFailed_C1_E5()
        {
            Modules(("m1", "auth", new UilmModulePublishResult(2, 0, false)), ("m2", "dashboard", new UilmModulePublishResult(0, 3, true)));

            var result = await _service.GenerateAsync(new GenerateUilmFilesEvent { Guid = "g", ProjectKey = "tenant-1" });

            result.Should().BeTrue("the action event and webhook keep today's isSuccess (spec 6.8.8)");
            var row = _historyRows.Single();
            row.Status.Should().Be("Partial");
            row.FailedModules.Should().Equal("dashboard");
            row.UploadedFiles.Should().Be(2);
            row.SkippedFiles.Should().Be(0);
            _timeline.Verify(t => t.BulkSaveKeyTimelinesAsync(It.Is<List<KeyTimeline>>(l =>
                l.Count == 1 && l[0].LogFrom == "PublishFailed" && l[0].EntityId == "id-dashboard.title"), "tenant-1"), Times.Once);
            _timeline.Verify(t => t.BulkSaveKeyTimelinesAsync(It.Is<List<KeyTimeline>>(l =>
                l.Count == 1 && l[0].LogFrom == "Published" && l[0].EntityId == "id-auth.title"), "tenant-1"), Times.Once);
        }

        [Fact]
        public async Task Generate_AllModulesFailing_IsFailed()
        {
            Modules(("m1", "auth", new UilmModulePublishResult(0, 0, true)), ("m2", "dashboard", null));

            await _service.GenerateAsync(new GenerateUilmFilesEvent { Guid = "g", ProjectKey = "tenant-1" });

            var row = _historyRows.Single();
            row.Status.Should().Be("Failed");
            row.FailedModules.Should().Equal("auth", "dashboard");
        }

        [Fact]
        public async Task Generate_PassesForceUploadToThePublishSession_H6()
        {
            Modules(("m1", "auth", new UilmModulePublishResult(1, 0, false)));

            await _service.GenerateAsync(new GenerateUilmFilesEvent { Guid = "g", ProjectKey = "tenant-1", ForceUpload = true });

            _publisher.Verify(p => p.BeginAsync("tenant-1", true), Times.Once);
            _publisher.Verify(p => p.PublishModuleAsync(It.Is<UilmPublishSession>(s => s.ForceUpload && s.Version == 12), "auth",
                It.Is<IReadOnlyList<UilmFile>>(files => files.Select(f => f.Language).SequenceEqual(new[] { "en-US", "key" }))), Times.Once);
        }

        [Fact]
        public void ProcessUilmFile_OrdersKeysOrdinally_SoTheSameKeysAlwaysGiveTheSameBytes_H11()
        {
            var keys = new[] { "b", "B", "a.x", "a" }.Select(n => NewKey(n, "m1", false)).ToList();
            var module = new BlocksLanguageModule { ItemId = "m1", ModuleName = "auth" };
            var command = new GenerateUilmFilesEvent { Guid = "g", ProjectKey = "tenant-1" };
            List<Language> Languages() => new() { new Language { LanguageCode = "en-US", LanguageName = "English" } };

            var first = _service.ProcessUilmFile(command, Languages(), keys, module);
            keys.Reverse();
            var second = _service.ProcessUilmFile(command, Languages(), keys, module);

            first[0].Content.Should().Be("{\"B\":\"Text B\",\"a\":\"Text a\",\"a.x\":\"Text a.x\",\"b\":\"Text b\"}");
            second.Select(f => f.Content).Should().Equal(first.Select(f => f.Content));
        }

        [Fact]
        public async Task SendGenerateUilmFilesEvent_CarriesForceUpload()
        {
            await _service.SendGenerateUilmFilesEvent(new GenerateUilmFilesRequest { Guid = "g", ModuleId = "m", ForceUpload = true });

            _sent.Should().ContainSingle().Which.Should().Be(new GenerateUilmFilesEvent { Guid = "g", ModuleId = "m", ProjectKey = "tenant-1", ForceUpload = true });
        }

        [Fact]
        public void OldEventWithoutForceUpload_DeserializesAsFalse_C16()
        {
            const string old = "{\"Guid\":\"g\",\"ModuleId\":\"m\",\"ProjectKey\":\"p\"}";

            System.Text.Json.JsonSerializer.Deserialize<GenerateUilmFilesEvent>(old)!.ForceUpload.Should().BeFalse();
            Newtonsoft.Json.JsonConvert.DeserializeObject<GenerateUilmFilesEvent>(old)!.ForceUpload.Should().BeFalse();
        }
    }
}
