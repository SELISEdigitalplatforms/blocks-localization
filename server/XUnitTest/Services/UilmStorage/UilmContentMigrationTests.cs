using System.Net;
using System.Text;
using System.Text.Json;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Data;
using BlocksTemplate.Api.Controllers;
using DomainService.Storage;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Repositories.UilmStorage;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.UilmStorage;
using Eurolm.DomainService.Validation;
using FluentAssertions;
using FluentValidation;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using StorageDriver;
using XUnitTest.Shared;

namespace XUnitTest.Services.UilmStorage
{
    /// <summary>
    /// #349 with mocked data access: task parsing and dispatch, the per-tenant order, failure isolation, paging, the queue,
    /// the endpoint body, the publish without content and the settings defaults.
    /// </summary>
    public class UilmContentMigrationTests
    {
        private const string Maintenance = "{\"task\":\"uilm-maintenance\",\"tenantId\":\"t1\"}";
        private const string Restore = "{\"task\":\"uilm-restore-content\",\"tenantId\":\"t1\"}";
        private readonly Mock<IUilmStoredFileRepository> _ledger = new();
        private readonly Mock<IUilmStorageSettingsRepository> _settings = new();
        private readonly Mock<IKeyRepository> _keys = new();
        private readonly Mock<IStorageDriverService> _driver = new();
        private readonly Mock<ITenants> _tenants = new();
        private readonly Mock<ILogger<UilmMaintenanceService>> _logger = new();
        private readonly StubStorageHttp _http = new();
        private readonly ManualTimeProvider _time = new();
        private readonly List<string> _order = new();

        public UilmContentMigrationTests()
        {
            TestBlocksContext.Set("caller");
            _settings.Setup(s => s.GetModeAsync()).ReturnsAsync(new UilmStorageMode(true, true));
            _settings.Setup(s => s.SetKeepContentAsync(It.IsAny<bool>())).Callback(() => _order.Add("keep-content")).Returns(Task.CompletedTask);
            _keys.Setup(k => k.GetUilmBackfillGroupsAsync(It.IsAny<int>())).Callback(() => _order.Add("backfill")).ReturnsAsync(new List<UilmFileGroup>());
            _keys.Setup(k => k.CountUilmFilesAsync()).ReturnsAsync(new UilmFileCounts(0, 0, 0));
            _keys.Setup(k => k.GetUilmFilesWithLiveFileAsync(It.IsAny<bool>(), It.IsAny<string?>(), It.IsAny<int>()))
                .Callback((bool withContent, string? _, int _) => _order.Add(withContent ? "removal" : "restore"))
                .ReturnsAsync(new List<UilmFile>());
            _keys.Setup(k => k.GetReferencedUilmFileIdsAsync(It.IsAny<IReadOnlyCollection<string>>())).ReturnsAsync(new HashSet<string>());
            _ledger.Setup(l => l.ClaimDueAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>())).Callback(() => _order.Add("deletes")).ReturnsAsync((UilmStoredFile?)null);
            _ledger.Setup(l => l.GetIdsAsync(It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<string?>(), It.IsAny<int>())).ReturnsAsync(new List<string>());
        }

        private UilmMaintenanceService Service(UilmStorageOptions? options = null) => new(_ledger.Object, _settings.Object, _keys.Object, _driver.Object,
            _tenants.Object, new UilmStorageInfrastructure(options ?? new UilmStorageOptions { UploadRetryDelays = [] }, _http.Factory().Object, _time), _logger.Object);

        private static UilmFile Pointer(string id, string? url = "https://files.test/f", string hash = "h") =>
            new() { Id = id, ModuleName = "app-login", Language = id, FileId = "file-" + id, Url = url, ContentHash = hash };

        private void Legacy(string language, string content = "{}")
        {
            _keys.Setup(k => k.GetUilmBackfillGroupsAsync(It.IsAny<int>())).ReturnsAsync(new List<UilmFileGroup> { new("app-login", language) });
            _keys.Setup(k => k.GetUilmFile(It.Is<GetUilmFileRequest>(r => r.Language == language)))
                .ReturnsAsync(new UilmFile { Id = "legacy", ModuleName = "app-login", Language = language, Content = content });
        }

        private void LiveRows(bool withContent, params UilmFile[] rows) =>
            _keys.Setup(k => k.GetUilmFilesWithLiveFileAsync(withContent, null, It.IsAny<int>())).ReturnsAsync(rows.ToList());

        // ---- Tasks and order ----

        [Theory]
        [InlineData("{\"task\":\"uilm-restore-content\"}", true, "uilm-restore-content")]
        [InlineData("{\"task\":\" UILM-Restore-Content \",\"tenantId\":\"t\"}", true, "uilm-restore-content")]
        [InlineData("{\"task\":\"uilm-maintenance\"}", true, "uilm-maintenance")]
        [InlineData("{\"task\":\"other\"}", false, "")]
        public void TaskParsing_KnowsBothTasks_6_5(string payload, bool valid, string task)
        {
            UilmMaintenanceService.TryParsePayload(payload, out var parsed, out _).Should().Be(valid);
            parsed.Should().Be(task);
        }

        [Fact]
        public async Task AnotherTask_IsLoggedAndNothingRuns_C12()
        {
            await Service().RunAsync("{\"task\":\"other\",\"tenantId\":\"t1\"}");

            _order.Should().BeEmpty();
            _logger.LoggedMessages().Should().ContainSingle(m => m == "UILM maintenance ignored a schedule payload that is not a uilm-maintenance or uilm-restore-content task");
        }

        [Fact]
        public async Task Maintenance_RunsBackfill_ThenRemoval_ThenDeletes_D3()
        {
            _settings.Setup(s => s.GetModeAsync()).ReturnsAsync(new UilmStorageMode(true, false));

            await Service().RunAsync(Maintenance);

            _order.Should().Equal("backfill", "removal", "deletes");
        }

        [Fact]
        public async Task KeepContentTrue_SkipsRemoval_AndSwitchOff_SkipsBoth_C6()
        {
            await Service().RunAsync(Maintenance);
            _order.Should().Equal("backfill", "deletes");

            _order.Clear();
            _settings.Setup(s => s.GetModeAsync()).ReturnsAsync(new UilmStorageMode(false, false));
            await Service().RunAsync(Maintenance);
            _order.Should().Equal("deletes");
        }

        [Fact]
        public async Task Restore_SetsKeepContentFirst_AndRunsNothingElse_D8()
        {
            await Service().RunAsync(Restore);

            _order.Should().Equal("keep-content", "restore");
            _settings.Verify(s => s.SetKeepContentAsync(true), Times.Once);
            _settings.Verify(s => s.TryStartReconcileAsync(It.IsAny<DateTime>(), It.IsAny<TimeSpan>()), Times.Never);
        }

        [Fact]
        public async Task ABackfillError_IsLogged_AndTheDeletesStillRun()
        {
            _keys.Setup(k => k.GetUilmBackfillGroupsAsync(It.IsAny<int>())).ThrowsAsync(new TimeoutException());

            await Service().RunAsync(Maintenance);

            _order.Should().Equal("deletes");
            _logger.LoggedMessages().Should().Contain("UILM backfill or content removal failed for tenant t1");
        }

        [Fact]
        public async Task Backfill_AsksForTheBatchSize_200ByDefault_P1()
        {
            await Service().RunAsync(Maintenance);

            _keys.Verify(k => k.GetUilmBackfillGroupsAsync(200), Times.Once);
        }

        // ---- Backfill groups ----

        [Fact]
        public async Task AGroupThatIsGone_OrWithoutContent_IsSkipped()
        {
            _keys.Setup(k => k.GetUilmBackfillGroupsAsync(It.IsAny<int>())).ReturnsAsync(new List<UilmFileGroup> { new("app-login", "gone"), new("app-login", "empty") });
            _keys.Setup(k => k.GetUilmFile(It.Is<GetUilmFileRequest>(r => r.Language == "empty")))
                .ReturnsAsync(new UilmFile { Id = "e", ModuleName = "app-login", Language = "empty", FileId = "copied" });

            await Service().RunAsync(Maintenance);

            _ledger.Verify(l => l.InsertAsync(It.IsAny<UilmStoredFile>()), Times.Never);
            _logger.LoggedMessages().Should().Contain(m => m.StartsWith("UilmBackfillSummary: tenant t1: 0 converted, 0 failed, 0 superseded"));
        }

        [Theory]
        [InlineData(false, true, "no upload URL")]
        [InlineData(true, false, "no download URL")]
        public async Task UploadFailures_AreLoggedWithTheirReason_AndTheAttemptRetired_C2(bool uploadUrl, bool downloadUrl, string reason)
        {
            Legacy("en-US");
            _driver.Setup(d => d.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>()))
                .ReturnsAsync(new GetPreSignedUrlForUploadResponse { UploadUrl = uploadUrl ? "https://upload.test/x" : null! });
            _driver.Setup(d => d.GetUrlForDownloadFileAsync(It.IsAny<GetFileRequest>()))
                .ReturnsAsync(new FileResponse { Url = downloadUrl ? "https://files.test/x" : null! });

            await Service().RunAsync(Maintenance);

            _logger.LoggedMessages().Should().Contain($"UilmBackfillFailed: module app-login language en-US: {reason}");
            _ledger.Verify(l => l.RetireAsync(It.Is<IReadOnlyCollection<string>>(ids => ids.Count == 1), It.IsAny<DateTime>()), Times.Once);
            _keys.Verify(k => k.ReplaceUilmFileFromBackfillAsync(It.IsAny<UilmFile>(), It.IsAny<UilmFile>()), Times.Never);
        }

        [Fact]
        public async Task AnUploadRejectedByStorage_IsAFailure_C2()
        {
            Legacy("en-US");
            _driver.Setup(d => d.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>()))
                .ReturnsAsync(new GetPreSignedUrlForUploadResponse { UploadUrl = "https://upload.test/x", UploadCompletionRequired = true });
            _driver.Setup(d => d.CompleteUploadAsync(It.IsAny<CompleteUploadRequest>()))
                .ReturnsAsync(new CompleteUploadResponse { VerificationStatus = FileVerificationStatus.Rejected, RejectionReason = "size" });

            await Service().RunAsync(Maintenance);

            _logger.LoggedMessages().Should().Contain("UilmBackfillFailed: module app-login language en-US: rejected by Storage");
        }

        [Fact]
        public async Task AnErrorAfterThePointerWrite_KeepsTheFileInUse_AndCountsAsFailed()
        {
            Legacy("en-US", "{\"a\":1}");
            _driver.Setup(d => d.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>()))
                .ReturnsAsync(new GetPreSignedUrlForUploadResponse { UploadUrl = "https://upload.test/x" });
            _driver.Setup(d => d.GetUrlForDownloadFileAsync(It.IsAny<GetFileRequest>())).ReturnsAsync(new FileResponse { Url = "https://files.test/x" });
            UilmFile? written = null;
            _keys.Setup(k => k.ReplaceUilmFileFromBackfillAsync(It.IsAny<UilmFile>(), It.IsAny<UilmFile>()))
                .Callback((UilmFile _, UilmFile pointer) => written = pointer).ReturnsAsync(true);
            _keys.Setup(k => k.DeleteUilmFileDuplicatesAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>())).ThrowsAsync(new TimeoutException());
            _keys.Setup(k => k.GetReferencedUilmFileIdsAsync(It.IsAny<IReadOnlyCollection<string>>()))
                .ReturnsAsync(() => new HashSet<string> { written!.FileId! });

            await Service().RunAsync(Maintenance);

            written!.Content.Should().Be("{\"a\":1}");
            written.Size.Should().Be(7);
            written.ContentHash.Should().Be(UilmFilePublisher.Hash(Encoding.UTF8.GetBytes("{\"a\":1}")));
            _ledger.Verify(l => l.RetireAsync(It.Is<IReadOnlyCollection<string>>(ids => ids.Count > 0), It.IsAny<DateTime>()), Times.Never);
            _logger.LoggedMessages().Should().Contain("UilmBackfillFailed: module app-login language en-US: TimeoutException");
        }

        [Fact]
        public async Task AFailingRetireAfterAnError_IsOnlyLogged()
        {
            Legacy("en-US");
            _ledger.Setup(l => l.InsertAsync(It.IsAny<UilmStoredFile>())).Returns(Task.CompletedTask);
            _driver.Setup(d => d.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>()))
                .ReturnsAsync(new GetPreSignedUrlForUploadResponse { UploadUrl = "https://upload.test/x" });
            _driver.Setup(d => d.GetUrlForDownloadFileAsync(It.IsAny<GetFileRequest>())).ReturnsAsync(new FileResponse { Url = "https://files.test/x" });
            _keys.Setup(k => k.ReplaceUilmFileFromBackfillAsync(It.IsAny<UilmFile>(), It.IsAny<UilmFile>())).ThrowsAsync(new TimeoutException());
            _keys.Setup(k => k.GetReferencedUilmFileIdsAsync(It.IsAny<IReadOnlyCollection<string>>())).ThrowsAsync(new TimeoutException());

            await Service().RunAsync(Maintenance);

            _logger.LoggedMessages().Should().Contain("UILM backfill could not retire its unused uploads; reconcile retires them");
            _logger.LoggedMessages().Should().Contain(m => m.Contains("0 converted, 1 failed"));
        }

        // ---- Removal and restore ----

        [Fact]
        public async Task Removal_KeepsContentWhenTheFileCantBeRead_AndCountsOnlyAppliedWrites_Q3()
        {
            _settings.Setup(s => s.GetModeAsync()).ReturnsAsync(new UilmStorageMode(true, false));
            var body = Encoding.UTF8.GetBytes("{}");
            LiveRows(true, Pointer("ok", hash: UilmFilePublisher.Hash(body)), Pointer("raced", hash: UilmFilePublisher.Hash(body)),
                Pointer("no-url", url: null), Pointer("down", url: "https://down.test/f"), Pointer("slow", url: "https://slow.test/f"));
            _http.Respond = request => request.RequestUri!.Host switch
            {
                "down.test" => throw new HttpRequestException("refused"),
                "slow.test" => throw new TaskCanceledException(),
                _ => Task.FromResult(StubStorageHttp.Ok(body))
            };
            _keys.Setup(k => k.RemoveUilmFileContentAsync(It.Is<UilmFile>(r => r.Id == "ok"))).ReturnsAsync(true);

            await Service().RunAsync(Maintenance);

            _keys.Verify(k => k.RemoveUilmFileContentAsync(It.IsAny<UilmFile>()), Times.Exactly(2));
            var logged = _logger.LoggedMessages();
            logged.Should().Contain(m => m.StartsWith("UilmContentRemovalSkipped: module app-login language no-url") && m.EndsWith("no URL"));
            logged.Should().Contain(m => m.StartsWith("UilmContentRemovalSkipped: module app-login language down") && m.EndsWith("HttpRequestException"));
            logged.Should().Contain(m => m.StartsWith("UilmContentRemovalSkipped: module app-login language slow") && m.EndsWith("timeout"));
            logged.Should().Contain("UilmContentRemoval: tenant t1: content removed from 1 rows, kept on 3 rows that failed verification");
        }

        [Fact]
        public async Task Removal_WithNothingToDo_LogsNothing()
        {
            _settings.Setup(s => s.GetModeAsync()).ReturnsAsync(new UilmStorageMode(true, false));

            await Service().RunAsync(Maintenance);

            _logger.LoggedMessages().Should().NotContain(m => m.StartsWith("UilmContentRemoval"));
        }

        [Fact]
        public async Task Restore_PagesThroughEveryRow_AndWritesTheDownloadedText()
        {
            var body = Encoding.UTF8.GetBytes("{\"a\":\"Ä\"}");
            var hash = UilmFilePublisher.Hash(body);
            _keys.Setup(k => k.GetUilmFilesWithLiveFileAsync(false, null, 2)).ReturnsAsync(new List<UilmFile> { Pointer("a", hash: hash), Pointer("b", hash: hash) });
            _keys.Setup(k => k.GetUilmFilesWithLiveFileAsync(false, "b", 2)).ReturnsAsync(new List<UilmFile> { Pointer("c", hash: hash) });
            _http.Respond = _ => Task.FromResult(StubStorageHttp.Ok(body));
            _keys.Setup(k => k.RestoreUilmFileContentAsync(It.IsAny<UilmFile>(), It.IsAny<string>()))
                .ReturnsAsync((UilmFile row, string _) => row.Id != "c");

            await Service(new UilmStorageOptions { ContentPageSize = 2 }).RunAsync(Restore);

            _keys.Verify(k => k.RestoreUilmFileContentAsync(It.IsAny<UilmFile>(), "{\"a\":\"Ä\"}"), Times.Exactly(3));
            _logger.LoggedMessages().Should().Contain("UilmRestoreContent: tenant t1: content restored on 2 rows, 0 hash mismatches, 0 downloads failed; KeepContent is true");
        }

        // ---- Queue, endpoint, publish and settings ----

        [Theory]
        [InlineData(null, "uilm-maintenance")]
        [InlineData(" ", "uilm-maintenance")]
        [InlineData("uilm-restore-content", "uilm-restore-content")]
        [InlineData("other", "other")]
        public async Task Queue_SendsTheTask_OrMaintenanceWithoutOne_ForTheCallersTenant_H11_D7(string? task, string sent)
        {
            var messages = new Mock<IMessageClient>();
            ConsumerMessage<PublishScheduleCommand>? message = null;
            messages.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<PublishScheduleCommand>>()))
                .Callback((ConsumerMessage<PublishScheduleCommand> m) => message = m).Returns(Task.CompletedTask);

            await new UilmMaintenanceQueue(messages.Object).QueueForCurrentTenantAsync(task);

            var payload = JsonDocument.Parse(message!.Payload.Payload).RootElement;
            payload.GetProperty("task").GetString().Should().Be(sent);
            payload.GetProperty("tenantId").GetString().Should().Be("caller");
        }

        [Fact]
        public async Task Endpoint_PassesTheBodysTask_6_5()
        {
            var queue = new Mock<IUilmMaintenanceQueue>();
            var controller = new KeyController(Mock.Of<IKeyManagementService>(),
                Mock.Of<IValidator<TranslateBlocksLanguageKeyRequest>>(), Mock.Of<IValidator<TranslateBlocksLanguageKeysRequest>>(),
                new GetKeysRequestValidator(), new DeleteKeysRequestValidator())
            { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };

            var result = await controller.RunUilmMaintenance(new RunUilmMaintenanceRequest { Task = "uilm-restore-content" }, queue.Object);

            result.Should().BeOfType<OkObjectResult>();
            queue.Verify(q => q.QueueForCurrentTenantAsync("uilm-restore-content"), Times.Once);
            JsonSerializer.Deserialize<RunUilmMaintenanceRequest>("{\"task\":\"x\"}", new JsonSerializerOptions(JsonSerializerDefaults.Web))!.Task.Should().Be("x");
        }

        [Fact]
        public async Task Publish_WithKeepContentFalse_WritesPointersWithoutContent_ButContentOnlyRowsKeepIt_H6()
        {
            var keys = new Mock<IKeyRepository>();
            var written = new List<UilmFile>();
            keys.Setup(k => k.GetUilmFilesOfModuleAsync("m")).ReturnsAsync(new List<UilmFile>());
            keys.Setup(k => k.ReplaceUilmFilePointerAsync(It.IsAny<UilmFile>())).Callback((UilmFile p) => written.Add(p))
                .ReturnsAsync(new UilmFilePointerWrite(true, null));
            keys.Setup(k => k.DeleteUilmFilesOfOtherLanguagesAsync(It.IsAny<string>(), It.IsAny<IReadOnlyCollection<string>>())).ReturnsAsync(new List<UilmFile>());
            _driver.Setup(d => d.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>()))
                .ReturnsAsync(new GetPreSignedUrlForUploadResponse { UploadUrl = "https://upload.test/x" });
            _driver.Setup(d => d.GetUrlForDownloadFileAsync(It.IsAny<GetFileRequest>())).ReturnsAsync(new FileResponse { Url = "https://files.test/x" });
            var publisher = new UilmFilePublisher(keys.Object, _ledger.Object, _settings.Object, Mock.Of<IUilmPublishCounterRepository>(), _driver.Object,
                new UilmStorageInfrastructure(new UilmStorageOptions(), _http.Factory().Object, _time), Mock.Of<ILogger<UilmFilePublisher>>());
            var files = new List<UilmFile> { new() { Language = "en-US", Content = "{}" } };

            await publisher.PublishModuleAsync(new UilmPublishSession(3, true, false, KeepContent: false), "m", files);
            await publisher.PublishModuleAsync(new UilmPublishSession(4, false, false, KeepContent: false), "m", files);

            written[0].FileId.Should().NotBeNull();
            written[0].Content.Should().BeNull();
            written[1].FileId.Should().BeNull();
            written[1].Content.Should().Be("{}", "a row without a file always keeps its content");
        }

        [Fact]
        public void Settings_MissingDocumentOrFieldsMeanOn_OnlyExplicitFalseTurnsOff_H5_Q1()
        {
            UilmStorageMode.From(null).Should().Be(new UilmStorageMode(true, true));
            UilmStorageMode.From(new UilmStorageSettings()).Should().Be(new UilmStorageMode(true, true));
            UilmStorageMode.From(new UilmStorageSettings { PublishToStorage = false }).Should().Be(new UilmStorageMode(false, true));
            UilmStorageMode.From(new UilmStorageSettings { KeepContent = false }).Should().Be(new UilmStorageMode(true, false));
            new UilmPublishSession(1, true, false).KeepContent.Should().BeTrue();
        }
    }
}
