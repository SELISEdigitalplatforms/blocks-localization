using System.Net;
using System.Text;
using Blocks.Genesis.Entities.Data;
using DomainService.Storage;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Repositories.UilmStorage;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.UilmStorage;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using StorageDriver;
using XUnitTest.Shared;

namespace XUnitTest.Services.UilmStorage
{
    /// <summary>Publish algorithm (spec 6.8): skip, force, per-module failure, superseded writes, removed languages, switch off.</summary>
    public class UilmFilePublisherTests
    {
        private const string Module = "app-login";
        private readonly Mock<IKeyRepository> _keys = new();
        private readonly Mock<IUilmStoredFileRepository> _ledger = new();
        private readonly Mock<IUilmStorageSettingsRepository> _settings = new();
        private readonly Mock<IUilmPublishCounterRepository> _counter = new();
        private readonly Mock<ILanguageFileGenerationHistoryRepository> _history = new();
        private readonly Mock<IStorageDriverService> _driver = new();
        private readonly Mock<ILogger<UilmFilePublisher>> _logger = new();
        private readonly StubStorageHttp _http = new();
        private readonly ManualTimeProvider _time = new();
        private readonly List<UilmFile> _rows = new();
        private readonly List<string> _order = new();
        private readonly List<GetPreSignedUrlForUploadRequest> _presigned = new();
        private readonly UilmFilePublisher _publisher;

        private DateTime Now => _time.GetUtcNow().UtcDateTime;

        public UilmFilePublisherTests()
        {
            _keys.Setup(k => k.GetUilmFilesOfModuleAsync(Module)).ReturnsAsync(() => _rows.ToList());
            _keys.Setup(k => k.ReplaceUilmFilePointerAsync(It.IsAny<UilmFile>())).ReturnsAsync((UilmFile pointer) =>
            {
                _order.Add("replace:" + pointer.Language);
                var existing = _rows.SingleOrDefault(r => r.Id == pointer.Id);
                if (existing?.Version >= pointer.Version) return new UilmFilePointerWrite(false, null);
                if (existing != null) _rows.Remove(existing);
                _rows.Add(pointer);
                return new UilmFilePointerWrite(true, existing);
            });
            _keys.Setup(k => k.DeleteUilmFileDuplicatesAsync(Module, It.IsAny<string>(), It.IsAny<string>()))
                .Callback((string _, string language, string keepId) =>
                {
                    _order.Add("dedupe:" + language);
                    _rows.RemoveAll(r => r.Language == language && r.Id != keepId);
                })
                .Returns(Task.CompletedTask);
            _keys.Setup(k => k.DeleteUilmFilesOfOtherLanguagesAsync(Module, It.IsAny<IReadOnlyCollection<string>>()))
                .ReturnsAsync((string _, IReadOnlyCollection<string> languages) =>
                {
                    var removed = _rows.Where(r => !languages.Contains(r.Language)).ToList();
                    _rows.RemoveAll(removed.Contains);
                    return removed;
                });
            _ledger.Setup(l => l.ExistsAsync(It.IsAny<string>())).ReturnsAsync(true);
            _ledger.Setup(l => l.InsertAsync(It.IsAny<UilmStoredFile>()))
                .Callback((UilmStoredFile f) => { lock (_order) _order.Add("ledger:" + f.Id); })
                .Returns(Task.CompletedTask);
            _driver.Setup(d => d.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>()))
                .ReturnsAsync((GetPreSignedUrlForUploadRequest r) =>
                {
                    lock (_order) { _order.Add("presign:" + r.ItemId); _presigned.Add(r); }
                    return new GetPreSignedUrlForUploadResponse { IsSuccess = true, FileId = r.ItemId!, UploadUrl = "https://upload.test/" + r.ItemId };
                });
            _driver.Setup(d => d.GetUrlForDownloadFileAsync(It.IsAny<GetFileRequest>()))
                .ReturnsAsync((GetFileRequest r) => new FileResponse { Url = "https://files.test/" + r.FileId });

            var options = new UilmStorageOptions { UploadRetryDelays = [TimeSpan.Zero, TimeSpan.Zero, TimeSpan.Zero] };
            _publisher = new UilmFilePublisher(_keys.Object, _ledger.Object, _settings.Object, _counter.Object, _history.Object,
                _driver.Object, _http.Factory().Object, options, _logger.Object, _time);
        }

        private static UilmPublishSession On(int version = 7, bool force = false) => new(version, true, force);

        private static List<UilmFile> Files(params (string Language, string Json)[] files) =>
            files.Select(f => new UilmFile { Id = Guid.NewGuid().ToString(), ModuleName = Module, Language = f.Language, Content = f.Json }).ToList();

        private static string HashOf(string json) => UilmFilePublisher.Hash(Encoding.UTF8.GetBytes(json));

        private UilmFile Published(string language, string json, int version, string fileId)
        {
            var row = new UilmFile
            {
                Id = UilmFile.PointerId(Module, language), ModuleName = Module, Language = language, Content = json,
                FileId = fileId, Url = "https://files.test/" + fileId, ContentHash = HashOf(json), Size = json.Length, Version = version
            };
            _rows.Add(row);
            return row;
        }

        private IEnumerable<HttpMethod> Methods => _http.Requests.Select(r => r.Method);

        [Fact]
        public async Task SwitchOn_FirstPublish_UploadsEveryFile_AndWritesPointersWithContent_H1()
        {
            var legacy = new UilmFile { Id = "legacy-1", ModuleName = Module, Language = "en-US", Content = "{\"a\":\"old\"}" };
            _rows.Add(legacy);
            var files = Files(("en-US", "{\"a\":\"A\"}"), ("key", "{\"a\":\"a\"}"));

            var result = await _publisher.PublishModuleAsync(On(), Module, files);

            result.Should().Be(new UilmModulePublishResult(2, 0, false));
            var pointer = _rows.Single(r => r.Language == "en-US");
            pointer.Id.Should().Be("app-login|en-US");
            pointer.FileId.Should().NotBeNullOrEmpty();
            pointer.Url.Should().Be("https://files.test/" + pointer.FileId);
            pointer.ContentHash.Should().Be(HashOf("{\"a\":\"A\"}"));
            pointer.Size.Should().Be(9);
            pointer.Version.Should().Be(7);
            pointer.PublishedAt.Should().Be(Now);
            pointer.Content.Should().Be("{\"a\":\"A\"}", "Content is still written in this phase (dual write)");
            _rows.Should().NotContain(legacy, "the legacy duplicate is deleted once the pointer row exists (H15)");
            _order.IndexOf("replace:en-US").Should().BeLessThan(_order.IndexOf("dedupe:en-US"));
            _ledger.Verify(l => l.MarkLiveAsync(It.Is<IReadOnlyCollection<string>>(ids => ids.Count == 2), UilmStoredFileState.Uploading), Times.Once);
        }

        [Fact]
        public async Task SwitchOn_Upload_RecordsTheLedgerRowFirst_AndSendsThePublicJsonFile()
        {
            var files = Files(("en-US", "{\"a\":\"Ä\"}"));

            await _publisher.PublishModuleAsync(On(), Module, files);

            var fileId = _presigned.Single().ItemId!;
            _order.IndexOf("ledger:" + fileId).Should().BeLessThan(_order.IndexOf("presign:" + fileId));
            _ledger.Verify(l => l.InsertAsync(It.Is<UilmStoredFile>(f => f.Id == fileId && f.ModuleName == Module && f.Language == "en-US"
                && f.State == UilmStoredFileState.Uploading && f.CreatedAt == Now)), Times.Once);
            var request = _presigned.Single();
            request.Name.Should().Be("app-login.en-US.json");
            request.AccessModifier.Should().Be("Public");
            request.ContentType.Should().Be("application/json");
            request.SizeInBytes.Should().Be(Encoding.UTF8.GetByteCount("{\"a\":\"Ä\"}"));
            request.Tags.Should().Be("[\"UilmFile\"]");
            request.ModuleName.Should().Be(ModuleName.Localization);

            var put = _http.Requests.Single(r => r.Method == HttpMethod.Put);
            put.Url.Should().Be("https://upload.test/" + fileId);
            put.Body.Should().Equal(Encoding.UTF8.GetBytes("{\"a\":\"Ä\"}"));
            put.Body![0].Should().Be((byte)'{', "the bytes carry no byte order mark");
            put.Headers["x-ms-blob-type"].Should().Be("BlockBlob");
            put.Headers["Content-Type"].Should().Be("application/json");
        }

        [Fact]
        public async Task SwitchOn_UsesTheRequiredUploadHeaders_WhenStorageNamesThem()
        {
            _driver.Setup(d => d.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>()))
                .ReturnsAsync((GetPreSignedUrlForUploadRequest r) => new GetPreSignedUrlForUploadResponse
                {
                    UploadUrl = "https://upload.test/" + r.ItemId,
                    RequiredHeaders = new Dictionary<string, string> { ["x-amz-acl"] = "public-read", ["Content-Type"] = "application/json" }
                });

            (await _publisher.PublishModuleAsync(On(), Module, Files(("en-US", "{}")))).Failed.Should().BeFalse();

            var put = _http.Requests.Single(r => r.Method == HttpMethod.Put);
            put.Headers["x-amz-acl"].Should().Be("public-read");
            put.Headers.Should().NotContainKey("x-ms-blob-type");
        }

        [Fact]
        public async Task SwitchOn_SkipsAnUnchangedFile_AndUploadsOnlyTheChangedOne_H5_E4()
        {
            var unchanged = Published("key", "{\"a\":\"a\"}", 7, "old-key");
            Published("en-US", "{\"a\":\"A\"}", 7, "old-en");
            var files = Files(("en-US", "{\"a\":\"B\"}"), ("key", "{\"a\":\"a\"}"));

            var result = await _publisher.PublishModuleAsync(On(8), Module, files);

            result.Should().Be(new UilmModulePublishResult(1, 1, false));
            _http.Urls(HttpMethod.Head).Should().Equal("https://files.test/old-key");
            _http.Urls(HttpMethod.Put).Should().ContainSingle();
            _rows.Should().Contain(unchanged, "the skipped pointer is left as it is");
            unchanged.Version.Should().Be(7);
            _rows.Single(r => r.Language == "en-US").Version.Should().Be(8);
            _ledger.Verify(l => l.RetireAsync(It.Is<IReadOnlyCollection<string>>(ids => ids.SequenceEqual(new[] { "old-en" })), Now.AddHours(24)), Times.Once);
        }

        [Fact]
        public async Task SwitchOn_UploadsAgain_WhenTheUnchangedFileIsGoneFromStorage_C13()
        {
            Published("en-US", "{}", 7, "old-en");
            _http.Respond = r => Task.FromResult(new HttpResponseMessage(r.Method == HttpMethod.Head ? HttpStatusCode.NotFound : HttpStatusCode.Created));

            var result = await _publisher.PublishModuleAsync(On(8), Module, Files(("en-US", "{}")));

            result.Should().Be(new UilmModulePublishResult(1, 0, false));
            Methods.Should().Equal(HttpMethod.Head, HttpMethod.Put);
        }

        [Fact]
        public async Task SwitchOn_UploadsAgain_WhenTheHeadRequestFails()
        {
            Published("en-US", "{}", 7, "old-en");
            _http.Respond = r => r.Method == HttpMethod.Head
                ? throw new HttpRequestException("unreachable")
                : Task.FromResult(new HttpResponseMessage(HttpStatusCode.Created));

            (await _publisher.PublishModuleAsync(On(8), Module, Files(("en-US", "{}")))).UploadedFiles.Should().Be(1);
        }

        [Fact]
        public async Task UnchangedForeignPointer_IsUploadedAgain_WithoutRequestingItsUrl_C19()
        {
            Published("en-US", "{}", 7, "copied-file");
            _ledger.Setup(l => l.ExistsAsync("copied-file")).ReturnsAsync(false);

            var result = await _publisher.PublishModuleAsync(On(8), Module, Files(("en-US", "{}")));

            result.Should().Be(new UilmModulePublishResult(1, 0, false));
            Methods.Should().Equal(HttpMethod.Put);
        }

        [Fact]
        public async Task ForceUpload_UploadsEveryFile_WithoutCheckingStorage_H6()
        {
            Published("en-US", "{}", 7, "old-en");

            var result = await _publisher.PublishModuleAsync(On(8, force: true), Module, Files(("en-US", "{}")));

            result.Should().Be(new UilmModulePublishResult(1, 0, false));
            Methods.Should().Equal(HttpMethod.Put);
            _ledger.Verify(l => l.RetireAsync(It.Is<IReadOnlyCollection<string>>(ids => ids.Contains("old-en")), Now.AddHours(24)), Times.Once);
        }

        [Fact]
        public async Task UploadFailingAfterThreeRetries_KeepsTheModulesPointers_AndRetiresThisRunsFilesNow_C1()
        {
            var current = Published("key", "{\"a\":\"a\"}", 7, "old-key");
            _driver.Setup(d => d.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>()))
                .ReturnsAsync((GetPreSignedUrlForUploadRequest r) =>
                {
                    lock (_order) _presigned.Add(r);
                    return new GetPreSignedUrlForUploadResponse { UploadUrl = $"https://upload.test/{r.Name}/{r.ItemId}" };
                });
            _http.Respond = r => Task.FromResult(new HttpResponseMessage(
                r.RequestUri!.ToString().Contains("en-US") ? HttpStatusCode.ServiceUnavailable : HttpStatusCode.Created));
            var files = Files(("en-US", "{\"a\":\"A\"}"), ("key", "{\"a\":\"b\"}"));

            var result = await _publisher.PublishModuleAsync(On(8), Module, files);

            result.Failed.Should().BeTrue();
            result.UploadedFiles.Should().Be(0);
            _http.Urls(HttpMethod.Put).Count(u => u.Contains("en-US")).Should().Be(4, "one attempt plus three retries");
            _keys.Verify(k => k.ReplaceUilmFilePointerAsync(It.IsAny<UilmFile>()), Times.Never);
            _rows.Should().ContainSingle().Which.Should().BeSameAs(current);
            _ledger.Verify(l => l.RetireAsync(It.Is<IReadOnlyCollection<string>>(ids => ids.Count == 2
                && ids.All(id => _presigned.Select(p => p.ItemId).Contains(id))), Now), Times.Once);
            _logger.LoggedMessages().Should().Contain(m => m.Contains("failed after 4 attempts"));
        }

        [Theory]
        [InlineData(HttpStatusCode.TooManyRequests)]
        [InlineData(HttpStatusCode.BadGateway)]
        public async Task RetryableStatus_IsRetried_AndThenSucceeds(HttpStatusCode first)
        {
            var calls = 0;
            _http.Respond = _ => Task.FromResult(new HttpResponseMessage(Interlocked.Increment(ref calls) == 1 ? first : HttpStatusCode.Created));

            var result = await _publisher.PublishModuleAsync(On(), Module, Files(("en-US", "{}")));

            result.Should().Be(new UilmModulePublishResult(1, 0, false));
            calls.Should().Be(2);
        }

        [Fact]
        public async Task NetworkError_IsRetried_AndThenSucceeds()
        {
            var calls = 0;
            _http.Respond = _ => Interlocked.Increment(ref calls) == 1
                ? throw new HttpRequestException("reset")
                : Task.FromResult(new HttpResponseMessage(HttpStatusCode.Created));

            (await _publisher.PublishModuleAsync(On(), Module, Files(("en-US", "{}")))).Failed.Should().BeFalse();
            calls.Should().Be(2);
        }

        [Fact]
        public async Task ClientError_IsNotRetried()
        {
            _http.Respond = _ => Task.FromResult(new HttpResponseMessage(HttpStatusCode.Forbidden));

            (await _publisher.PublishModuleAsync(On(), Module, Files(("en-US", "{}")))).Failed.Should().BeTrue();
            _http.Requests.Should().ContainSingle();
        }

        [Fact]
        public async Task RejectedCompletion_FailsTheUpload_C18()
        {
            _driver.Setup(d => d.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>()))
                .ReturnsAsync((GetPreSignedUrlForUploadRequest r) => new GetPreSignedUrlForUploadResponse
                {
                    UploadUrl = "https://upload.test/" + r.ItemId, UploadCompletionRequired = true, FileVersionId = "v1"
                });
            _driver.Setup(d => d.CompleteUploadAsync(It.IsAny<CompleteUploadRequest>()))
                .ReturnsAsync(new CompleteUploadResponse { VerificationStatus = FileVerificationStatus.Rejected, RejectionReason = "type" });

            var result = await _publisher.PublishModuleAsync(On(), Module, Files(("en-US", "{}")));

            result.Failed.Should().BeTrue();
            _driver.Verify(d => d.CompleteUploadAsync(It.Is<CompleteUploadRequest>(c => c.FileVersionId == "v1")), Times.Once);
            _keys.Verify(k => k.ReplaceUilmFilePointerAsync(It.IsAny<UilmFile>()), Times.Never);
        }

        [Fact]
        public async Task VerifiedCompletion_PublishesTheFile()
        {
            _driver.Setup(d => d.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>()))
                .ReturnsAsync((GetPreSignedUrlForUploadRequest r) => new GetPreSignedUrlForUploadResponse
                {
                    UploadUrl = "https://upload.test/" + r.ItemId, UploadCompletionRequired = true
                });
            _driver.Setup(d => d.CompleteUploadAsync(It.IsAny<CompleteUploadRequest>()))
                .ReturnsAsync(new CompleteUploadResponse { VerificationStatus = FileVerificationStatus.Verified });

            (await _publisher.PublishModuleAsync(On(), Module, Files(("en-US", "{}")))).Should().Be(new UilmModulePublishResult(1, 0, false));
        }

        [Fact]
        public async Task CompletionNotRequired_IsNotCalled()
        {
            await _publisher.PublishModuleAsync(On(), Module, Files(("en-US", "{}")));

            _driver.Verify(d => d.CompleteUploadAsync(It.IsAny<CompleteUploadRequest>()), Times.Never);
        }

        [Fact]
        public async Task MissingUploadUrl_FailsTheModule()
        {
            _driver.Setup(d => d.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>()))
                .ReturnsAsync(new GetPreSignedUrlForUploadResponse { UploadUrl = "" });

            (await _publisher.PublishModuleAsync(On(), Module, Files(("en-US", "{}")))).Failed.Should().BeTrue();
            _http.Requests.Should().BeEmpty();
        }

        [Fact]
        public async Task MissingDownloadUrl_FailsTheModule()
        {
            _driver.Setup(d => d.GetUrlForDownloadFileAsync(It.IsAny<GetFileRequest>())).ReturnsAsync((FileResponse?)null);

            (await _publisher.PublishModuleAsync(On(), Module, Files(("en-US", "{}")))).Failed.Should().BeTrue();
        }

        [Fact]
        public async Task StorageDriverException_FailsTheUpload_WithoutThrowing()
        {
            _driver.Setup(d => d.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>())).ThrowsAsync(new InvalidOperationException("down"));

            (await _publisher.PublishModuleAsync(On(), Module, Files(("en-US", "{}")))).Failed.Should().BeTrue();
            _ledger.Verify(l => l.RetireAsync(It.Is<IReadOnlyCollection<string>>(ids => ids.Count == 1), Now), Times.Once);
        }

        [Fact]
        public async Task SupersededPointer_RetiresTheNewFileNow_AndLeavesTheHigherVersion_C5()
        {
            var newer = Published("en-US", "{\"a\":\"newer\"}", 9, "newer-file");

            var result = await _publisher.PublishModuleAsync(On(8), Module, Files(("en-US", "{\"a\":\"older\"}")));

            result.Failed.Should().BeFalse();
            _rows.Should().ContainSingle().Which.Should().BeSameAs(newer);
            var loser = _presigned.Single().ItemId!;
            _ledger.Verify(l => l.RetireAsync(It.Is<IReadOnlyCollection<string>>(ids => ids.SequenceEqual(new[] { loser })), Now), Times.Once);
            _ledger.Verify(l => l.MarkLiveAsync(It.Is<IReadOnlyCollection<string>>(ids => ids.Count == 0), UilmStoredFileState.Uploading), Times.Once);
            _keys.Verify(k => k.DeleteUilmFileDuplicatesAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task RemovedLanguage_DeletesItsPointer_AndRetiresItsFile_H12()
        {
            Published("xx-XX", "{}", 7, "dropped-file");
            Published("en-US", "{}", 7, "en-file");

            await _publisher.PublishModuleAsync(On(8), Module, Files(("en-US", "{}")));

            _rows.Should().NotContain(r => r.Language == "xx-XX");
            _keys.Verify(k => k.DeleteUilmFilesOfOtherLanguagesAsync(Module, It.Is<IReadOnlyCollection<string>>(l => l.SequenceEqual(new[] { "en-US" }))), Times.Once);
            _ledger.Verify(l => l.RetireAsync(It.Is<IReadOnlyCollection<string>>(ids => ids.SequenceEqual(new[] { "dropped-file" })), Now.AddHours(24)), Times.Once);
        }

        [Fact]
        public async Task SwitchOff_WritesContentOnlyRows_WithoutUploads_AndRetiresTheStorageFiles_H13_C15()
        {
            Published("en-US", "{\"a\":\"A\"}", 7, "storage-file");
            _rows.Add(new UilmFile { Id = "legacy", ModuleName = Module, Language = "en-US", Content = "{}" });

            var result = await _publisher.PublishModuleAsync(new UilmPublishSession(8, false, true), Module, Files(("en-US", "{\"a\":\"B\"}")));

            result.Should().Be(new UilmModulePublishResult(0, 0, false));
            _http.Requests.Should().BeEmpty();
            _driver.VerifyNoOtherCalls();
            var row = _rows.Should().ContainSingle().Subject;
            row.Id.Should().Be("app-login|en-US");
            row.Content.Should().Be("{\"a\":\"B\"}");
            row.FileId.Should().BeNull();
            row.Url.Should().BeNull();
            row.ContentHash.Should().BeNull();
            row.Version.Should().Be(8);
            _ledger.Verify(l => l.RetireAsync(It.Is<IReadOnlyCollection<string>>(ids => ids.SequenceEqual(new[] { "storage-file" })), Now.AddHours(24)), Times.Once);
        }

        [Fact]
        public async Task SwitchOff_LeavesAHigherVersionAlone()
        {
            Published("en-US", "{}", 9, "storage-file");

            await _publisher.PublishModuleAsync(new UilmPublishSession(8, false, false), Module, Files(("en-US", "{\"a\":1}")));

            _rows.Single().Version.Should().Be(9);
            _keys.Verify(k => k.DeleteUilmFileDuplicatesAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task BeginAsync_ReadsTheSwitch_AndTakesTheNextVersionSeededWithTheHighestHistoryVersion_H10()
        {
            _settings.Setup(s => s.IsPublishToStorageEnabledAsync()).ReturnsAsync(true);
            _history.Setup(h => h.GetHighestVersionAsync("proj")).ReturnsAsync(41);
            _counter.Setup(c => c.NextVersionAsync(41)).ReturnsAsync(42);

            var session = await _publisher.BeginAsync("proj", forceUpload: true);

            session.Should().Be(new UilmPublishSession(42, true, true));
        }

        [Fact]
        public void BytesAndHash_AreUtf8WithoutBom_AndLowercaseHexSha256()
        {
            UilmFilePublisher.ToBytes("{}").Should().Equal((byte)'{', (byte)'}');
            UilmFilePublisher.Hash(Encoding.ASCII.GetBytes("abc"))
                .Should().Be("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        }
    }
}
