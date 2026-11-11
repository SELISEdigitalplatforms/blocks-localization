using System.Net;
using System.Text;
using Blocks.Genesis;
using DomainService.Storage;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Repositories.UilmStorage;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.UilmStorage;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using StorageDriver;
using XUnitTest.Services.UilmStorage;
using XUnitTest.Shared;

namespace XUnitTest.Repositories
{
    /// <summary>
    /// UILM Storage data behaviour that a mocked collection cannot show (conditional upserts, leases, the atomic counter,
    /// indexes) and one publish → read → maintenance flow. Runs against local MongoDB, like the other integration tests
    /// (port from BLOCKS_ROUTING_TEST_MONGO_PORT).
    /// </summary>
    public sealed class UilmStorageMongoIntegrationTests : IDisposable
    {
        private const string Module = "app-login";
        private readonly MongoClient _client;
        private readonly string _databaseName = "blocks_uilm348_" + Guid.NewGuid().ToString("N");
        private readonly IMongoDatabase _database;
        private readonly Mock<IDbContextProvider> _provider = new();
        private readonly ManualTimeProvider _time = new();

        public UilmStorageMongoIntegrationTests()
        {
            TestBlocksContext.Set("uilm-tenant");
            var port = Environment.GetEnvironmentVariable("BLOCKS_ROUTING_TEST_MONGO_PORT") ?? "27017";
            _client = new MongoClient($"mongodb://localhost:{port}/?appName=uilm348-tests");
            _database = _client.GetDatabase(_databaseName);
            _database.RunCommand<BsonDocument>(new BsonDocument("ping", 1));
            _provider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(_database);
        }

        public void Dispose()
        {
            _client.DropDatabase(_databaseName);
            _client.Dispose();
        }

        private DateTime Now => _time.GetUtcNow().UtcDateTime;
        private KeyRepository Keys() => new(_provider.Object, NullLogger<KeyRepository>.Instance);
        private UilmStoredFileRepository Ledger() => new(_provider.Object);
        private IMongoCollection<UilmFile> UilmFiles => _database.GetCollection<UilmFile>("UilmFiles");
        private IMongoCollection<UilmStoredFile> StoredFiles => _database.GetCollection<UilmStoredFile>("UilmStoredFiles");

        private static UilmFile Pointer(string language, int version, string? fileId = null, string content = "{}") => new()
        {
            Id = UilmFile.PointerId(Module, language), ModuleName = Module, Language = language, Content = content,
            FileId = fileId, Version = version
        };

        private async Task<List<string>> IndexNamesAsync(string collection)
        {
            for (var i = 0; i < 50; i++)
            {
                var names = (await (await _database.GetCollection<BsonDocument>(collection).Indexes.ListAsync()).ToListAsync())
                    .Select(ix => ix["name"].AsString).ToList();
                if (names.Count > 1) return names;
                await Task.Delay(100);
            }
            return new List<string>();
        }

        // ---- UilmFiles pointers (6.1) ----

        [Fact]
        public async Task PointerWrite_InsertsTheDeterministicRow_ThenDuplicatesGo_H15()
        {
            await UilmFiles.InsertManyAsync(new[]
            {
                new UilmFile { Id = "legacy-1", ModuleName = Module, Language = "en-US", Content = "{\"old\":1}" },
                new UilmFile { Id = "legacy-2", ModuleName = Module, Language = "en-US", Content = "{\"old\":2}" },
                new UilmFile { Id = "other", ModuleName = Module, Language = "xx-XX", Content = "{}" }
            });
            var keys = Keys();

            var write = await keys.ReplaceUilmFilePointerAsync(Pointer("en-US", 3, "f1"));
            (await UilmFiles.CountDocumentsAsync(f => f.Language == "en-US")).Should().Be(3, "the new row exists before any delete");
            await keys.DeleteUilmFileDuplicatesAsync(Module, "en-US", "app-login|en-US");

            write.Should().Be(new UilmFilePointerWrite(true, null));
            (await UilmFiles.Find(f => f.Language == "en-US").ToListAsync()).Should().ContainSingle().Which.FileId.Should().Be("f1");
            (await UilmFiles.CountDocumentsAsync(f => f.Id == "other")).Should().Be(1);
            (await IndexNamesAsync("UilmFiles")).Should().Contain("ModuleName_1_Language_1_Version_-1");
        }

        [Fact]
        public async Task PointerWrite_OnlyReplacesALowerVersion_AndReturnsTheReplacedRow_C5()
        {
            var keys = Keys();
            await keys.ReplaceUilmFilePointerAsync(Pointer("en-US", 5, "f5"));

            (await keys.ReplaceUilmFilePointerAsync(Pointer("en-US", 4, "f4"))).Should().Be(new UilmFilePointerWrite(false, null));
            (await keys.ReplaceUilmFilePointerAsync(Pointer("en-US", 5, "f5b"))).Applied.Should().BeFalse();
            var newer = await keys.ReplaceUilmFilePointerAsync(Pointer("en-US", 6, "f6"));

            newer.Applied.Should().BeTrue();
            newer.Previous!.FileId.Should().Be("f5");
            (await UilmFiles.Find(f => f.Id == "app-login|en-US").SingleAsync()).FileId.Should().Be("f6");
        }

        [Fact]
        public async Task ConcurrentPointerWrites_LeaveTheHighestVersion_C5()
        {
            var keys = Keys();

            var writes = await Task.WhenAll(Enumerable.Range(1, 10).Select(v => keys.ReplaceUilmFilePointerAsync(Pointer("en-US", v, "f" + v))));

            (await UilmFiles.Find(f => f.Id == "app-login|en-US").SingleAsync()).Version.Should().Be(10);
            writes[9].Applied.Should().BeTrue();
        }

        [Fact]
        public async Task Read_PrefersTheHighestVersion_AndStillServesLegacyOnlyRows()
        {
            var keys = Keys();
            var request = new GetUilmFileRequest { ModuleName = Module, Language = "en-US" };
            await UilmFiles.InsertOneAsync(new UilmFile { Id = "legacy", ModuleName = Module, Language = "en-US", Content = "legacy" });
            (await keys.GetUilmFile(request)).Content.Should().Be("legacy");

            await UilmFiles.InsertOneAsync(Pointer("en-US", 2, "f2", "pointer"));

            var row = await keys.GetUilmFile(request);
            row.Content.Should().Be("pointer");
            row.FileId.Should().Be("f2");
            row.Version.Should().Be(2);
        }

        [Fact]
        public async Task RemovedLanguages_AreDeletedForTheModuleOnly_AndReturned_H12()
        {
            await UilmFiles.InsertManyAsync(new[]
            {
                Pointer("en-US", 1, "f-en"), Pointer("xx-XX", 1, "f-xx"),
                new UilmFile { Id = "other|xx-XX", ModuleName = "other", Language = "xx-XX", Content = "{}" }
            });

            var removed = await Keys().DeleteUilmFilesOfOtherLanguagesAsync(Module, new[] { "en-US", "key" });

            removed.Select(r => r.FileId).Should().Equal("f-xx");
            (await UilmFiles.Find(FilterDefinition<UilmFile>.Empty).Project(f => f.Id).ToListAsync())
                .Should().BeEquivalentTo("app-login|en-US", "other|xx-XX");
        }

        [Fact]
        public async Task ReferencedFileIds_AreTheOnesSomeRowPointsAt()
        {
            await UilmFiles.InsertManyAsync(new[] { Pointer("en-US", 1, "f1"), Pointer("key", 1) });

            (await Keys().GetReferencedUilmFileIdsAsync(new[] { "f1", "f2" })).Should().BeEquivalentTo("f1");
            (await Keys().GetReferencedUilmFileIdsAsync(Array.Empty<string>())).Should().BeEmpty();
        }

        // ---- UilmStoredFiles ledger (6.2, 6.9) ----

        [Fact]
        public async Task Claim_LeasesEachDueFileOnce_AndAgainOnlyAfterTheLeaseExpires_C7()
        {
            var ledger = Ledger();
            await StoredFiles.InsertManyAsync(new[]
            {
                new UilmStoredFile { Id = "due", State = UilmStoredFileState.Retired, DeleteAfter = Now.AddMinutes(-1) },
                new UilmStoredFile { Id = "later", State = UilmStoredFileState.Retired, DeleteAfter = Now.AddHours(1) },
                new UilmStoredFile { Id = "live", State = UilmStoredFileState.Live }
            });

            var first = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => ledger.ClaimDueAsync(Now, Now.AddMinutes(15))));

            first.Where(f => f != null).Should().ContainSingle().Which.Id.Should().Be("due");
            (await ledger.ClaimDueAsync(Now.AddMinutes(14), Now.AddMinutes(29))).Should().BeNull("the lease still holds");
            (await ledger.ClaimDueAsync(Now.AddMinutes(16), Now.AddMinutes(31)))!.Id.Should().Be("due");
            (await IndexNamesAsync("UilmStoredFiles")).Should().Contain("State_1_DeleteAfter_1");
        }

        [Fact]
        public async Task LedgerTransitions_Retire_MarkLive_FailedAttempts_AndRemove()
        {
            var ledger = Ledger();
            await ledger.InsertAsync(new UilmStoredFile { Id = "f1", State = UilmStoredFileState.Uploading, CreatedAt = Now });
            (await ledger.ExistsAsync("f1")).Should().BeTrue();
            (await ledger.ExistsAsync("nope")).Should().BeFalse();

            await ledger.RetireAsync(new[] { "f1" }, Now);
            (await ledger.ClaimDueAsync(Now, Now.AddMinutes(15))).Should().NotBeNull();
            (await ledger.RecordFailedDeleteAsync("f1", Now)).Should().Be(1);
            (await ledger.RecordFailedDeleteAsync("f1", Now)).Should().Be(2);
            var row = await StoredFiles.Find(f => f.Id == "f1").SingleAsync();
            row.LeaseUntil.Should().Be(Now, "a failed delete ends the lease at the run's start");
            (await ledger.ClaimDueAsync(Now, Now.AddMinutes(15))).Should().BeNull("the failing run doesn't claim it again");
            (await ledger.ClaimDueAsync(Now.AddHours(1), Now.AddHours(1).AddMinutes(15))).Should().NotBeNull("the next run does");
            await ledger.RetireAsync(new[] { "f1" }, Now);
            await ledger.MarkLiveAsync(new[] { "f1" }, UilmStoredFileState.Uploading);
            (await StoredFiles.Find(f => f.Id == "f1").SingleAsync()).State.Should().Be(UilmStoredFileState.Retired,
                "a publish never revives a file that was retired meanwhile");

            await ledger.MarkLiveAsync(new[] { "f1" });
            row = await StoredFiles.Find(f => f.Id == "f1").SingleAsync();
            row.State.Should().Be(UilmStoredFileState.Live);
            row.DeleteAfter.Should().BeNull();

            (await ledger.RetireFromStateAsync(new[] { "f1" }, UilmStoredFileState.Uploading, Now)).Should().Be(0);
            (await ledger.RetireFromStateAsync(new[] { "f1" }, UilmStoredFileState.Live, Now)).Should().Be(1);
            await ledger.RemoveAsync("f1");
            (await ledger.ExistsAsync("f1")).Should().BeFalse();
            (await ledger.RecordFailedDeleteAsync("f1", Now)).Should().Be(0);
        }

        [Fact]
        public async Task GetIds_PagesByIdWithinStateAndAge()
        {
            var ledger = Ledger();
            await StoredFiles.InsertManyAsync(new[]
            {
                new UilmStoredFile { Id = "a", State = UilmStoredFileState.Uploading, CreatedAt = Now.AddHours(-2) },
                new UilmStoredFile { Id = "b", State = UilmStoredFileState.Uploading, CreatedAt = Now.AddHours(-2) },
                new UilmStoredFile { Id = "c", State = UilmStoredFileState.Uploading, CreatedAt = Now },
                new UilmStoredFile { Id = "d", State = UilmStoredFileState.Live, CreatedAt = Now.AddHours(-2) }
            });

            (await ledger.GetIdsAsync(UilmStoredFileState.Uploading, Now.AddHours(-1), null, 1)).Should().Equal("a");
            (await ledger.GetIdsAsync(UilmStoredFileState.Uploading, Now.AddHours(-1), "a", 10)).Should().Equal("b");
        }

        [Fact]
        public async Task UilmStorageRepositories_RequireATenant()
        {
            BlocksContext.SetContext(null!, true);

            await Ledger().Invoking(l => l.ExistsAsync("f1")).Should().ThrowAsync<InvalidOperationException>();
            _provider.Verify(p => p.GetDatabase(It.IsAny<string>()), Times.Never);
        }

        // ---- Settings and counter (6.3, 6.4) ----

        [Fact]
        public async Task Switch_IsOffWithoutADocument_AndFollowsTheDocument()
        {
            var settings = new UilmStorageSettingsRepository(_provider.Object);
            (await settings.IsPublishToStorageEnabledAsync()).Should().BeFalse();

            await _database.GetCollection<UilmStorageSettings>("UilmStorageSettings").InsertOneAsync(new UilmStorageSettings { PublishToStorage = true });

            (await settings.IsPublishToStorageEnabledAsync()).Should().BeTrue();
        }

        [Fact]
        public async Task Reconcile_StartsAtMostOncePerInterval_WithoutTouchingTheSwitch()
        {
            var settings = new UilmStorageSettingsRepository(_provider.Object);
            var day = TimeSpan.FromHours(24);

            (await settings.TryStartReconcileAsync(Now, day)).Should().BeTrue();
            (await settings.TryStartReconcileAsync(Now.AddHours(23), day)).Should().BeFalse();
            (await settings.TryStartReconcileAsync(Now.AddHours(24), day)).Should().BeTrue();
            (await settings.IsPublishToStorageEnabledAsync()).Should().BeFalse();
        }

        [Fact]
        public async Task Counter_ContinuesFromTheSeed_AndNeverRepeatsUnderConcurrency_H10()
        {
            var counter = new UilmPublishCounterRepository(_provider.Object);

            (await counter.NextVersionAsync(41)).Should().Be(42);
            (await counter.NextVersionAsync(0)).Should().Be(43);
            (await counter.NextVersionAsync(100)).Should().Be(101);
            var concurrent = await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => counter.NextVersionAsync(0)));

            concurrent.Should().OnlyHaveUniqueItems().And.BeEquivalentTo(Enumerable.Range(102, 20));
        }

        [Fact]
        public async Task HighestHistoryVersion_IsTheMaximumVersion_NotTheLatestRow()
        {
            var history = new LanguageFileGenerationHistoryRepository(_provider.Object);
            (await history.GetHighestVersionAsync("p")).Should().Be(0);

            await history.SaveAsync(new LanguageFileGenerationHistory { ItemId = "1", ProjectKey = "p", Version = 9, CreateDate = Now.AddDays(-1) });
            await history.SaveAsync(new LanguageFileGenerationHistory { ItemId = "2", ProjectKey = "p", Version = 3, CreateDate = Now });

            (await history.GetHighestVersionAsync("p")).Should().Be(9);
        }

        // ---- Publish → read → maintenance on real collections (E1, E4, H4, H7, C8, C20) ----

        private sealed class FakeStorage
        {
            public Dictionary<string, byte[]> Blobs { get; } = new();
            public List<string> Deleted { get; } = new();
            public StubStorageHttp Http { get; } = new();
            public Mock<IStorageDriverService> Driver { get; } = new();

            public FakeStorage()
            {
                Driver.Setup(d => d.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>()))
                    .ReturnsAsync((GetPreSignedUrlForUploadRequest r) => new GetPreSignedUrlForUploadResponse { UploadUrl = "https://upload.test/" + r.ItemId });
                Driver.Setup(d => d.GetUrlForDownloadFileAsync(It.IsAny<GetFileRequest>()))
                    .ReturnsAsync((GetFileRequest r) => new FileResponse { Url = "https://files.test/" + r.FileId });
                Driver.Setup(d => d.DeleteFileAsync(It.IsAny<DeleteFileRequest>())).ReturnsAsync((DeleteFileRequest r) =>
                {
                    lock (Blobs) { Deleted.Add(r.FileId); Blobs.Remove(r.FileId); }
                    return new BaseResponse { IsSuccess = true };
                });
                Http.Respond = async request =>
                {
                    var id = request.RequestUri!.Segments[^1];
                    if (request.Method == HttpMethod.Put)
                    {
                        var bytes = await request.Content!.ReadAsByteArrayAsync();
                        lock (Blobs) Blobs[id] = bytes;
                        return new HttpResponseMessage(HttpStatusCode.Created);
                    }
                    lock (Blobs)
                    {
                        return Blobs.TryGetValue(id, out var stored)
                            ? StubStorageHttp.Ok(request.Method == HttpMethod.Get ? stored : null)
                            : new HttpResponseMessage(HttpStatusCode.NotFound);
                    }
                };
            }
        }

        private (UilmFilePublisher Publisher, UilmFileReader Reader, UilmMaintenanceService Maintenance) Pipeline(FakeStorage storage)
        {
            var options = new UilmStorageOptions();
            var keys = Keys();
            var ledger = Ledger();
            var settings = new UilmStorageSettingsRepository(_provider.Object);
            var factory = storage.Http.Factory().Object;
            var tenants = new Mock<ITenants>();
            tenants.Setup(t => t.GetTenantDatabaseConnectionStrings()).Returns(new Dictionary<string, (string, string)> { ["uilm-tenant"] = ("db", "c") });
            return (
                new UilmFilePublisher(keys, ledger, settings, new UilmPublishCounterRepository(_provider.Object),
                    new LanguageFileGenerationHistoryRepository(_provider.Object), storage.Driver.Object, factory, options,
                    NullLogger<UilmFilePublisher>.Instance, _time),
                new UilmFileReader(keys, ledger, factory, options, NullLogger<UilmFileReader>.Instance),
                new UilmMaintenanceService(ledger, settings, keys, storage.Driver.Object, tenants.Object, Mock.Of<IMessageClient>(),
                    options, NullLogger<UilmMaintenanceService>.Instance, _time));
        }

        private static List<UilmFile> Files(string english) => new()
        {
            new UilmFile { Language = "en-US", Content = english },
            new UilmFile { Language = "key", Content = "{\"title\":\"title\"}" }
        };

        [Fact]
        public async Task PublishReadAndMaintenance_EndToEnd_E1_E4_H4_H7()
        {
            await _database.GetCollection<UilmStorageSettings>("UilmStorageSettings").InsertOneAsync(new UilmStorageSettings { PublishToStorage = true });
            await UilmFiles.InsertOneAsync(new UilmFile { Id = "legacy", ModuleName = Module, Language = "en-US", Content = "{\"title\":\"Legacy\"}" });
            var storage = new FakeStorage();
            var (publisher, reader, maintenance) = Pipeline(storage);
            var request = new GetUilmFileRequest { ModuleName = Module, Language = "en-US" };

            var v1 = await publisher.BeginAsync("uilm-tenant", false);
            (await publisher.PublishModuleAsync(v1, Module, Files("{\"title\":\"Sign in\"}"))).Should().Be(new UilmModulePublishResult(2, 0, false));
            var first = await reader.ReadAsync(request, null);
            first.Bytes.Should().Equal(Encoding.UTF8.GetBytes("{\"title\":\"Sign in\"}"));
            (await reader.ReadAsync(request, first.ETag)).Kind.Should().Be(UilmFileReadKind.NotModified);
            (await UilmFiles.CountDocumentsAsync(f => f.Id == "legacy")).Should().Be(0);
            var oldFileId = (await UilmFiles.Find(f => f.Id == "app-login|en-US").SingleAsync()).FileId!;

            var v2 = await publisher.BeginAsync("uilm-tenant", false);
            v2.Version.Should().Be(v1.Version + 1);
            (await publisher.PublishModuleAsync(v2, Module, Files("{\"title\":\"Log in\"}"))).Should().Be(new UilmModulePublishResult(1, 1, false));
            (await reader.ReadAsync(request, first.ETag)).Bytes.Should().Equal(Encoding.UTF8.GetBytes("{\"title\":\"Log in\"}"));
            var retired = await StoredFiles.Find(f => f.Id == oldFileId).SingleAsync();
            retired.State.Should().Be(UilmStoredFileState.Retired);
            retired.DeleteAfter.Should().Be(Now.AddHours(24));

            await maintenance.RunAsync("{\"task\":\"uilm-maintenance\"}");
            storage.Deleted.Should().BeEmpty("the replaced file is kept for 24 hours");

            _time.Advance(TimeSpan.FromHours(25));
            await maintenance.RunAsync("{\"task\":\"uilm-maintenance\"}");

            storage.Deleted.Should().Equal(oldFileId);
            (await StoredFiles.CountDocumentsAsync(f => f.Id == oldFileId)).Should().Be(0);
            (await StoredFiles.CountDocumentsAsync(f => f.State == UilmStoredFileState.Live)).Should().Be(2);
        }

        [Fact]
        public async Task FailingDelete_IsAttemptedOncePerRun()
        {
            var storage = new FakeStorage();
            storage.Driver.Setup(d => d.DeleteFileAsync(It.IsAny<DeleteFileRequest>()))
                .ReturnsAsync(new BaseResponse { IsSuccess = false, Errors = new Dictionary<string, string> { ["access_denied"] = "no" } });
            var (_, _, maintenance) = Pipeline(storage);
            await StoredFiles.InsertManyAsync(new[]
            {
                new UilmStoredFile { Id = "stuck", State = UilmStoredFileState.Retired, DeleteAfter = Now.AddHours(-2) },
                new UilmStoredFile { Id = "next", State = UilmStoredFileState.Retired, DeleteAfter = Now.AddHours(-1) }
            });

            await maintenance.RunAsync("{\"task\":\"uilm-maintenance\"}");
            _time.Advance(TimeSpan.FromHours(1));
            await maintenance.RunAsync("{\"task\":\"uilm-maintenance\"}");

            storage.Driver.Verify(d => d.DeleteFileAsync(It.Is<DeleteFileRequest>(r => r.FileId == "stuck")), Times.Exactly(2));
            storage.Driver.Verify(d => d.DeleteFileAsync(It.Is<DeleteFileRequest>(r => r.FileId == "next")), Times.Exactly(2));
            (await StoredFiles.Find(f => f.Id == "stuck").SingleAsync()).Attempts.Should().Be(2);
        }

        [Fact]
        public async Task Reconcile_RetiresAnAbandonedUpload_AndFilesWhosePointersWereReplacedOutsideLocalization_C8_C20()
        {
            await _database.GetCollection<UilmStorageSettings>("UilmStorageSettings").InsertOneAsync(new UilmStorageSettings { PublishToStorage = true });
            var storage = new FakeStorage();
            var (publisher, reader, maintenance) = Pipeline(storage);
            await publisher.PublishModuleAsync(await publisher.BeginAsync("uilm-tenant", false), Module, Files("{\"title\":\"Sign in\"}"));
            await StoredFiles.InsertOneAsync(new UilmStoredFile { Id = "crashed", ModuleName = Module, Language = "en-US",
                State = UilmStoredFileState.Uploading, CreatedAt = Now.AddHours(-2) });
            // A blocks-os data cleanup replaces the rows with legacy seed rows.
            await UilmFiles.DeleteManyAsync(FilterDefinition<UilmFile>.Empty);
            await UilmFiles.InsertOneAsync(new UilmFile { Id = "seed", ModuleName = Module, Language = "en-US", Content = "{\"title\":\"Seed\"}" });

            (await reader.ReadAsync(new GetUilmFileRequest { ModuleName = Module, Language = "en-US" }, null))
                .Should().Be(new UilmFileReadResult(UilmFileReadKind.Content, "{\"title\":\"Seed\"}"));
            await maintenance.RunAsync("{\"task\":\"uilm-maintenance\"}");
            _time.Advance(TimeSpan.FromHours(1));
            await maintenance.RunAsync("{\"task\":\"uilm-maintenance\"}");
            storage.Deleted.Should().Equal("crashed");

            _time.Advance(TimeSpan.FromHours(24));
            await maintenance.RunAsync("{\"task\":\"uilm-maintenance\"}");

            storage.Deleted.Should().HaveCount(3, "the two unused live files are deleted 24 hours after the reconcile");
            (await StoredFiles.CountDocumentsAsync(FilterDefinition<UilmStoredFile>.Empty)).Should().Be(0);
        }
    }
}
