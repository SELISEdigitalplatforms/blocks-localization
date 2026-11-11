using System.Text.Json;
using Blocks.Genesis;
using DomainService.Storage;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Repositories.UilmStorage;
using Eurolm.DomainService.Services.UilmStorage;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using StorageDriver;
using Worker.Consumers;
using XUnitTest.Shared;

namespace XUnitTest.Services.UilmStorage
{
    /// <summary>Maintenance (spec 6.9): payload, tenant loop, lease, live-reference guard, attempts and reconcile.</summary>
    public class UilmMaintenanceServiceTests
    {
        private const string Payload = "{\"task\":\"uilm-maintenance\"}";
        private readonly Mock<IUilmStoredFileRepository> _ledger = new();
        private readonly Mock<IUilmStorageSettingsRepository> _settings = new();
        private readonly Mock<IKeyRepository> _keys = new();
        private readonly Mock<IStorageDriverService> _driver = new();
        private readonly Mock<ITenants> _tenants = new();
        private readonly Mock<IMessageClient> _messages = new();
        private readonly Mock<ILogger<UilmMaintenanceService>> _logger = new();
        private readonly ManualTimeProvider _time = new();
        private readonly Queue<UilmStoredFile> _due = new();
        private readonly List<(string? Tenant, bool Authenticated, string UserId)> _contexts = new();
        private UilmMaintenanceService _service;

        private DateTime Now => _time.GetUtcNow().UtcDateTime;

        public UilmMaintenanceServiceTests()
        {
            TestBlocksContext.Set("caller");
            _tenants.Setup(t => t.GetTenantDatabaseConnectionStrings())
                .Returns(new Dictionary<string, (string, string)> { ["t1"] = ("db1", "c1"), ["t2"] = ("db2", "c2") });
            _ledger.Setup(l => l.ClaimDueAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>())).ReturnsAsync(() =>
            {
                var context = BlocksContext.GetContext();
                _contexts.Add((context?.TenantId, context?.IsAuthenticated ?? false, context?.UserId ?? ""));
                return _due.Count > 0 ? _due.Dequeue() : null;
            });
            _keys.Setup(k => k.GetReferencedUilmFileIdsAsync(It.IsAny<IReadOnlyCollection<string>>())).ReturnsAsync(new HashSet<string>());
            _ledger.Setup(l => l.GetIdsAsync(It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<string?>(), It.IsAny<int>())).ReturnsAsync(new List<string>());
            _driver.Setup(d => d.DeleteFileAsync(It.IsAny<DeleteFileRequest>())).ReturnsAsync(new BaseResponse { IsSuccess = true });
            _service = Service(new UilmStorageOptions());
        }

        private UilmMaintenanceService Service(UilmStorageOptions options) => new(_ledger.Object, _settings.Object, _keys.Object,
            _driver.Object, _tenants.Object, _messages.Object, options, _logger.Object, _time);

        private static UilmStoredFile Due(string id) => new() { Id = id, ModuleName = "app-login", Language = "en-US", State = UilmStoredFileState.Retired };

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("not json")]
        [InlineData("[]")]
        [InlineData("{\"task\":\"backup\"}")]
        [InlineData("{\"task\":5}")]
        [InlineData("{}")]
        public async Task InvalidOrOtherPayload_IsLoggedAndIgnored_WithoutThrowing_C9_E9(string? payload)
        {
            await _service.RunAsync(payload);

            _ledger.VerifyNoOtherCalls();
            _driver.VerifyNoOtherCalls();
            _logger.LoggedMessages().Should().ContainSingle(m => m.Contains("ignored a schedule payload"));
        }

        [Theory]
        [InlineData("{\"task\":\" UILM-Maintenance \"}", true, null)]
        [InlineData("{\"task\":\"uilm-maintenance\",\"tenantId\":\" t9 \"}", true, "t9")]
        [InlineData("{\"task\":\"uilm-maintenance\",\"tenantId\":\"\"}", true, null)]
        [InlineData("{\"task\":\"uilm-maintenance\",\"tenantId\":3}", true, null)]
        public void PayloadParsing(string payload, bool valid, string? tenantId)
        {
            UilmMaintenanceService.TryParsePayload(payload, out var parsed).Should().Be(valid);
            parsed.Should().Be(tenantId);
        }

        [Fact]
        public async Task WithoutTenantId_RunsEveryTenant_EachWithoutAUser_AndRestoresTheCallersContext_H8()
        {
            await _service.RunAsync(Payload);

            _contexts.Should().Equal(("t1", false, ""), ("t2", false, ""));
            BlocksContext.GetContext()!.TenantId.Should().Be("caller");
        }

        [Fact]
        public async Task WithTenantId_RunsOnlyThatTenant()
        {
            await _service.RunAsync("{\"task\":\"uilm-maintenance\",\"tenantId\":\"t2\"}");

            _contexts.Select(c => c.Tenant).Should().Equal("t2");
            _tenants.Verify(t => t.GetTenantDatabaseConnectionStrings(), Times.Never);
        }

        [Fact]
        public async Task OneTenantFailing_IsLogged_AndTheOthersStillRun_C10()
        {
            var calls = 0;
            _ledger.Setup(l => l.ClaimDueAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>())).ReturnsAsync(() =>
            {
                _contexts.Add((BlocksContext.GetContext()?.TenantId, false, ""));
                return ++calls == 1 ? throw new InvalidOperationException("tenant down") : null;
            });

            await _service.RunAsync(Payload);

            _contexts.Select(c => c.Tenant).Should().Equal("t1", "t2");
            _logger.LoggedMessages().Should().Contain("UILM maintenance failed for tenant t1");
            BlocksContext.GetContext()!.TenantId.Should().Be("caller");
        }

        [Fact]
        public async Task TenantListFailure_IsLogged_WithoutThrowing()
        {
            _tenants.Setup(t => t.GetTenantDatabaseConnectionStrings()).Throws(new InvalidOperationException("no tenants"));

            await _service.RunAsync(Payload);

            _logger.LoggedMessages().Should().Contain("UILM maintenance could not list the tenants");
        }

        [Fact]
        public async Task DueFile_IsLeasedForFifteenMinutes_DeletedPermanently_AndItsRowRemoved_H7_C7()
        {
            _due.Enqueue(Due("f1"));

            await _service.RunAsync("{\"task\":\"uilm-maintenance\",\"tenantId\":\"t1\"}");

            _ledger.Verify(l => l.ClaimDueAsync(Now, Now.AddMinutes(15)), Times.Exactly(2));
            _driver.Verify(d => d.DeleteFileAsync(It.Is<DeleteFileRequest>(r => r.FileId == "f1" && r.Permanent)), Times.Once);
            _ledger.Verify(l => l.RemoveAsync("f1"), Times.Once);
        }

        [Fact]
        public async Task FileAlreadyGone_RemovesItsRow()
        {
            _due.Enqueue(Due("f1"));
            _driver.Setup(d => d.DeleteFileAsync(It.IsAny<DeleteFileRequest>()))
                .ReturnsAsync(new BaseResponse { IsSuccess = false, Errors = new Dictionary<string, string> { ["file_not_found"] = "gone" } });

            await _service.RunAsync("{\"task\":\"uilm-maintenance\",\"tenantId\":\"t1\"}");

            _ledger.Verify(l => l.RemoveAsync("f1"), Times.Once);
        }

        [Theory]
        [InlineData(9, false)]
        [InlineData(10, true)]
        [InlineData(14, true)]
        public async Task FailedDelete_ReleasesTheLease_CountsTheAttempt_AndReportsStuckFilesFromTen(int attempts, bool stuck)
        {
            _due.Enqueue(Due("f1"));
            _driver.Setup(d => d.DeleteFileAsync(It.IsAny<DeleteFileRequest>()))
                .ReturnsAsync(new BaseResponse { IsSuccess = false, Errors = new Dictionary<string, string> { ["access_denied"] = "no" } });
            _ledger.Setup(l => l.RecordFailedDeleteAsync("f1")).ReturnsAsync(attempts);

            await _service.RunAsync("{\"task\":\"uilm-maintenance\",\"tenantId\":\"t1\"}");

            _ledger.Verify(l => l.RemoveAsync(It.IsAny<string>()), Times.Never);
            _ledger.Verify(l => l.RecordFailedDeleteAsync("f1"), Times.Once);
            _logger.LoggedMessages().Count(m => m.StartsWith("UilmFileDeleteStuck")).Should().Be(stuck ? 1 : 0);
            _logger.LoggedMessages().Should().Contain(m => m.Contains("could not delete file f1: access_denied"));
        }

        [Fact]
        public async Task DeleteException_CountsAsAFailedAttempt()
        {
            _due.Enqueue(Due("f1"));
            _driver.Setup(d => d.DeleteFileAsync(It.IsAny<DeleteFileRequest>())).ThrowsAsync(new TimeoutException());

            await _service.RunAsync("{\"task\":\"uilm-maintenance\",\"tenantId\":\"t1\"}");

            _ledger.Verify(l => l.RecordFailedDeleteAsync("f1"), Times.Once);
        }

        [Fact]
        public async Task FileStillReferencedByAPointer_IsMadeLive_AndNotDeleted_C6()
        {
            _due.Enqueue(Due("f1"));
            _keys.Setup(k => k.GetReferencedUilmFileIdsAsync(It.Is<IReadOnlyCollection<string>>(ids => ids.Contains("f1"))))
                .ReturnsAsync(new HashSet<string> { "f1" });

            await _service.RunAsync("{\"task\":\"uilm-maintenance\",\"tenantId\":\"t1\"}");

            _ledger.Verify(l => l.MarkLiveAsync(It.Is<IReadOnlyCollection<string>>(ids => ids.SequenceEqual(new[] { "f1" }))), Times.Once);
            _driver.Verify(d => d.DeleteFileAsync(It.IsAny<DeleteFileRequest>()), Times.Never);
        }

        [Fact]
        public async Task ARun_ClaimsAtMostTheBatchSizePerTenant()
        {
            _service = Service(new UilmStorageOptions { MaintenanceBatchSize = 3 });
            for (var i = 0; i < 5; i++) _due.Enqueue(Due("f" + i));

            await _service.RunAsync("{\"task\":\"uilm-maintenance\",\"tenantId\":\"t1\"}");

            _driver.Verify(d => d.DeleteFileAsync(It.IsAny<DeleteFileRequest>()), Times.Exactly(3));
        }

        [Fact]
        public async Task Reconcile_RetiresAbandonedUploadsNow_AndUnusedLiveFilesAfter24Hours_C8_C20()
        {
            _settings.Setup(s => s.TryStartReconcileAsync(Now, TimeSpan.FromHours(24))).ReturnsAsync(true);
            var uploading = Enumerable.Range(0, 500).Select(i => $"u{i:D3}").ToList();
            _ledger.Setup(l => l.GetIdsAsync(UilmStoredFileState.Uploading, Now.AddHours(-1), null, 500)).ReturnsAsync(uploading);
            _ledger.Setup(l => l.GetIdsAsync(UilmStoredFileState.Uploading, Now.AddHours(-1), "u499", 500)).ReturnsAsync(new List<string> { "u500" });
            _ledger.Setup(l => l.GetIdsAsync(UilmStoredFileState.Live, DateTime.MaxValue, null, 500)).ReturnsAsync(new List<string> { "live-used", "live-unused" });
            _keys.Setup(k => k.GetReferencedUilmFileIdsAsync(It.IsAny<IReadOnlyCollection<string>>()))
                .ReturnsAsync(new HashSet<string> { "u001", "live-used" });
            _ledger.Setup(l => l.RetireFromStateAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<string>(), It.IsAny<DateTime>()))
                .ReturnsAsync((IReadOnlyCollection<string> ids, string _, DateTime _) => ids.Count);

            await _service.RunAsync("{\"task\":\"uilm-maintenance\",\"tenantId\":\"t1\"}");

            _ledger.Verify(l => l.RetireFromStateAsync(It.Is<IReadOnlyCollection<string>>(ids => ids.Count == 499 && !ids.Contains("u001")),
                UilmStoredFileState.Uploading, Now), Times.Once);
            _ledger.Verify(l => l.RetireFromStateAsync(It.Is<IReadOnlyCollection<string>>(ids => ids.SequenceEqual(new[] { "u500" })),
                UilmStoredFileState.Uploading, Now), Times.Once);
            _ledger.Verify(l => l.RetireFromStateAsync(It.Is<IReadOnlyCollection<string>>(ids => ids.SequenceEqual(new[] { "live-unused" })),
                UilmStoredFileState.Live, Now.AddHours(24)), Times.Once);
            _logger.LoggedMessages().Should().Contain("UILM reconcile retired 500 abandoned uploads and 1 unused files");
        }

        [Fact]
        public async Task Reconcile_IsSkipped_WhenItRanWithinTheInterval()
        {
            _settings.Setup(s => s.TryStartReconcileAsync(It.IsAny<DateTime>(), It.IsAny<TimeSpan>())).ReturnsAsync(false);

            await _service.RunAsync("{\"task\":\"uilm-maintenance\",\"tenantId\":\"t1\"}");

            _ledger.Verify(l => l.GetIdsAsync(It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<string?>(), It.IsAny<int>()), Times.Never);
        }

        [Fact]
        public async Task QueueForCurrentTenant_SendsTheMaintenanceTaskForTheCallersTenantOnly_H14()
        {
            ConsumerMessage<PublishScheduleCommand>? sent = null;
            _messages.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<PublishScheduleCommand>>()))
                .Callback((ConsumerMessage<PublishScheduleCommand> m) => sent = m)
                .Returns(Task.CompletedTask);

            await _service.QueueForCurrentTenantAsync();

            sent!.ConsumerName.Should().Be("eurolm_maintenance_listener");
            UilmMaintenanceService.TryParsePayload(sent.Payload.Payload, out var tenantId).Should().BeTrue();
            tenantId.Should().Be("caller");
            JsonDocument.Parse(sent.Payload.Payload).RootElement.GetProperty("task").GetString().Should().Be("uilm-maintenance");
        }

        [Fact]
        public async Task QueueForCurrentTenant_RequiresATenant()
        {
            BlocksContext.SetContext(null!, true);

            await _service.Invoking(s => s.QueueForCurrentTenantAsync()).Should().ThrowAsync<InvalidOperationException>();
            _messages.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Consumer_PassesTheSchedulePayloadToTheService()
        {
            var service = new Mock<IUilmMaintenanceService>();

            await new UilmMaintenanceConsumer(service.Object).Consume(new PublishScheduleCommand { Payload = Payload });

            service.Verify(s => s.RunAsync(Payload), Times.Once);
        }
    }
}
