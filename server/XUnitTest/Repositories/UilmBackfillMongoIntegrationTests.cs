using System.Net;
using System.Text;
using Blocks.Genesis;
using DomainService.Storage;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Repositories.UilmStorage;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.UilmStorage;
using FluentAssertions;
using Microsoft.Extensions.Logging;
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
    /// #349 backfill, content removal and restore on real collections: the selection and count queries, the conditional
    /// writes, and maintenance runs with publish and read. Runs against local MongoDB (port from BLOCKS_ROUTING_TEST_MONGO_PORT).
    /// </summary>
    public sealed class UilmBackfillMongoIntegrationTests : IDisposable
    {
        private const string Module = "app-login";
        private const string Tenant = "uilm-tenant";
        private const string RunMaintenance = "{\"task\":\"uilm-maintenance\",\"tenantId\":\"uilm-tenant\"}";
        private const string RunRestore = "{\"task\":\"uilm-restore-content\",\"tenantId\":\"uilm-tenant\"}";
        private readonly MongoClient _client;
        private readonly string _databaseName = "blocks_uilm349_" + Guid.NewGuid().ToString("N");
        private readonly IMongoDatabase _database;
        private readonly Mock<IDbContextProvider> _provider = new();
        private readonly Mock<ITenants> _tenants = new();
        private readonly Mock<ILogger<UilmMaintenanceService>> _logger = new();
        private readonly ManualTimeProvider _time = new();
        private readonly FakeStorage _storage = new();

        public UilmBackfillMongoIntegrationTests()
        {
            TestBlocksContext.Set(Tenant);
            var port = Environment.GetEnvironmentVariable("BLOCKS_ROUTING_TEST_MONGO_PORT") ?? "27017";
            _client = new MongoClient($"mongodb://localhost:{port}/?appName=uilm349-tests");
            _database = _client.GetDatabase(_databaseName);
            _database.RunCommand<BsonDocument>(new BsonDocument("ping", 1));
            _provider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(_database);
            _tenants.Setup(t => t.GetTenantDatabaseConnectionStrings())
                .Returns(new Dictionary<string, (string, string)> { [Tenant] = ("db", "c") });
        }

        public void Dispose()
        {
            _client.DropDatabase(_databaseName);
            _client.Dispose();
        }

        private DateTime Now => _time.GetUtcNow().UtcDateTime;
        private KeyRepository Keys() => new(_provider.Object, NullLogger<KeyRepository>.Instance);
        private UilmStoredFileRepository Ledger() => new(_provider.Object);
        private UilmStorageSettingsRepository Settings() => new(_provider.Object);
        private IMongoCollection<UilmFile> UilmFiles => _database.GetCollection<UilmFile>("UilmFiles");
        private IMongoCollection<UilmStoredFile> StoredFiles => _database.GetCollection<UilmStoredFile>("UilmStoredFiles");
        private IMongoCollection<UilmStorageSettings> SettingsDocuments => _database.GetCollection<UilmStorageSettings>("UilmStorageSettings");

        private UilmStorageInfrastructure Infrastructure(UilmStorageOptions? options = null) =>
            new(options ?? new UilmStorageOptions(), _storage.Http.Factory().Object, _time);

        /// <summary>Without retry delays: the manual clock never advances on its own.</summary>
        private UilmMaintenanceService Maintenance(UilmStorageOptions? options = null) => new(Ledger(), Settings(), Keys(),
            _storage.Driver.Object, _tenants.Object, Infrastructure(options ?? new UilmStorageOptions { UploadRetryDelays = [] }), _logger.Object);

        private UilmFilePublisher Publisher() => new(Keys(), Ledger(), Settings(),
            new UilmPublishCounterRepository(_provider.Object, new LanguageFileGenerationHistoryRepository(_provider.Object)),
            _storage.Driver.Object, Infrastructure(), NullLogger<UilmFilePublisher>.Instance);

        private UilmFileReader Reader() => new(Keys(), Ledger(), Infrastructure(), NullLogger<UilmFileReader>.Instance);

        private static UilmFile Legacy(string id, string language, string content, string module = Module) =>
            new() { Id = id, ModuleName = module, Language = language, Content = content };

        private Task<UilmFile> Row(string id) => UilmFiles.Find(f => f.Id == id).SingleAsync();

        private Task<UilmFileReadResult> ReadAsync(string language, string? ifNoneMatch = null, string module = Module) =>
            Reader().ReadAsync(new GetUilmFileRequest { ModuleName = module, Language = language }, ifNoneMatch);

        /// <summary>The body a client gets, as bytes: Storage bytes, or the row's content written as UTF-8.</summary>
        private static byte[] Body(UilmFileReadResult result) => result.Bytes ?? Encoding.UTF8.GetBytes(result.Content ?? "");

        private async Task LiveFileAsync(string id) =>
            await StoredFiles.InsertOneAsync(new UilmStoredFile { Id = id, ModuleName = Module, Language = "en-US", State = UilmStoredFileState.Live, CreatedAt = Now });

        // ---- Repository queries ----

        [Fact]
        public async Task BackfillGroups_AreTheGroupsWithContentAndNoLedgerFile_InOrder_UpToTheLimit_H1_C3()
        {
            await LiveFileAsync("ledger-file");
            await UilmFiles.InsertManyAsync(new[]
            {
                Legacy("l1", "en-US", "{}", "b-module"),
                Legacy("l2", "en-US", "{}", "b-module"),
                new UilmFile { Id = "foreign", ModuleName = "a-module", Language = "xx-XX", Content = "{}", FileId = "copied-file", Version = 4 },
                new UilmFile { Id = "pointer", ModuleName = "c-module", Language = "en-US", Content = "{}", FileId = "ledger-file", Version = 2 },
                new UilmFile { Id = "no-content", ModuleName = "d-module", Language = "en-US" },
                Legacy("l3", "en-US", "", "e-module")
            });
            var keys = Keys();

            (await keys.GetUilmBackfillGroupsAsync(10)).Should().Equal(
                new UilmFileGroup("a-module", "xx-XX"), new UilmFileGroup("b-module", "en-US"), new UilmFileGroup("e-module", "en-US"));
            (await keys.GetUilmBackfillGroupsAsync(1)).Should().Equal(new UilmFileGroup("a-module", "xx-XX"));
        }

        [Fact]
        public async Task Counts_SplitLegacyRows_AndPointerRowsWithAndWithoutContent_H12()
        {
            await LiveFileAsync("f1");
            await LiveFileAsync("f2");
            await UilmFiles.InsertManyAsync(new[]
            {
                Legacy("l1", "en-US", "{}"),
                new UilmFile { Id = "foreign", ModuleName = Module, Language = "xx-XX", Content = "{}", FileId = "copied-file" },
                new UilmFile { Id = "p1", ModuleName = Module, Language = "a", Content = "{}", FileId = "f1", ContentHash = "h" },
                new UilmFile { Id = "p2", ModuleName = Module, Language = "b", FileId = "f2", ContentHash = "h" }
            });

            (await Keys().CountUilmFilesAsync()).Should().Be(new UilmFileCounts(2, 1, 1));
            await UilmFiles.DeleteManyAsync(FilterDefinition<UilmFile>.Empty);
            (await Keys().CountUilmFilesAsync()).Should().Be(new UilmFileCounts(0, 0, 0));
        }

        [Fact]
        public async Task BackfillReplace_OfARowWithThePointerId_AppliesOnlyWhileVersionAndFileAreUnchanged_Q2_C1()
        {
            var keys = Keys();
            var served = new UilmFile { Id = "app-login|en-US", ModuleName = Module, Language = "en-US", Content = "{}", Version = 5 };
            await UilmFiles.InsertOneAsync(served);
            var pointer = new UilmFile { Id = served.Id, ModuleName = Module, Language = "en-US", Content = "{}", FileId = "b1", Version = 5 };

            (await keys.ReplaceUilmFileFromBackfillAsync(served, pointer)).Should().BeTrue();
            (await keys.ReplaceUilmFileFromBackfillAsync(served, new UilmFile { Id = served.Id, FileId = "b2", Version = 5 }))
                .Should().BeFalse("the row has a file now");
            (await Row(served.Id)).FileId.Should().Be("b1");
        }

        [Fact]
        public async Task BackfillReplace_OfALegacyRow_InsertsThePointer_UnlessARowWithAVersionHasThatId_C1_C10()
        {
            var keys = Keys();
            var legacy = Legacy("legacy", "en-US", "{}");
            await UilmFiles.InsertOneAsync(legacy);
            UilmFile Pointer(string fileId) => new() { Id = "app-login|en-US", ModuleName = Module, Language = "en-US", Content = "{}", FileId = fileId, Version = 0 };

            var results = await Task.WhenAll(Enumerable.Range(0, 5).Select(i => keys.ReplaceUilmFileFromBackfillAsync(legacy, Pointer("b" + i))));

            results.Count(r => r).Should().Be(1, "overlapping runs convert a group once");
            (await keys.ReplaceUilmFileFromBackfillAsync(legacy, Pointer("late"))).Should().BeFalse();
            (await UilmFiles.CountDocumentsAsync(f => f.Id == "app-login|en-US")).Should().Be(1);
        }

        [Fact]
        public async Task LiveRows_ArePagedById_OnlyWithALiveFileAndAHash_WithoutLoadingContent()
        {
            await LiveFileAsync("f1");
            await LiveFileAsync("f2");
            await LiveFileAsync("f3");
            await StoredFiles.InsertOneAsync(new UilmStoredFile { Id = "retired", State = UilmStoredFileState.Retired });
            await UilmFiles.InsertManyAsync(new[]
            {
                new UilmFile { Id = "a", ModuleName = Module, Language = "a", Content = "{}", FileId = "f1", ContentHash = "h1" },
                new UilmFile { Id = "b", ModuleName = Module, Language = "b", Content = "{}", FileId = "retired", ContentHash = "h" },
                new UilmFile { Id = "c", ModuleName = Module, Language = "c", Content = "{}", FileId = "f2" },
                new UilmFile { Id = "d", ModuleName = Module, Language = "d", Content = "{}", FileId = "f3", ContentHash = "h3" },
                new UilmFile { Id = "e", ModuleName = Module, Language = "e", FileId = "f3", ContentHash = "h3" }
            });
            var keys = Keys();

            var first = await keys.GetUilmFilesWithLiveFileAsync(withContent: true, null, 1);
            first.Should().ContainSingle().Which.Id.Should().Be("a");
            first[0].Content.Should().BeNull("content is not loaded");
            (await keys.GetUilmFilesWithLiveFileAsync(true, "a", 10)).Select(r => r.Id).Should().Equal("d");
            (await keys.GetUilmFilesWithLiveFileAsync(false, null, 10)).Select(r => r.Id).Should().Equal("e");
        }

        [Fact]
        public async Task ContentWrites_ApplyOnlyWhileTheRowHasTheSameFileAndHash_D9()
        {
            var keys = Keys();
            var row = new UilmFile { Id = "p", ModuleName = Module, Language = "en-US", Content = "{}", FileId = "f1", ContentHash = "h1" };
            await UilmFiles.InsertOneAsync(row);

            (await keys.RemoveUilmFileContentAsync(new UilmFile { Id = "p", FileId = "f2", ContentHash = "h1" })).Should().BeFalse();
            (await keys.RemoveUilmFileContentAsync(row)).Should().BeTrue();
            (await keys.RemoveUilmFileContentAsync(row)).Should().BeFalse("there is no content left");
            (await _database.GetCollection<BsonDocument>("UilmFiles").Find(new BsonDocument("_id", "p")).SingleAsync())
                .Contains("Content").Should().BeFalse("the field is unset");

            (await keys.RestoreUilmFileContentAsync(new UilmFile { Id = "p", FileId = "f1", ContentHash = "other" }, "{}")).Should().BeFalse();
            (await keys.RestoreUilmFileContentAsync(row, "{\"a\":1}")).Should().BeTrue();
            (await keys.RestoreUilmFileContentAsync(row, "{\"b\":2}")).Should().BeFalse("content exists again");
            (await Row("p")).Content.Should().Be("{\"a\":1}");
        }

        [Fact]
        public async Task SetKeepContent_CreatesOrUpdatesTheDocument_WithoutTouchingTheSwitch()
        {
            var settings = Settings();
            await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => settings.SetKeepContentAsync(false)));
            (await settings.GetModeAsync()).Should().Be(new UilmStorageMode(true, false));

            await SettingsDocuments.UpdateOneAsync(s => s.Id == "default", Builders<UilmStorageSettings>.Update.Set(s => s.PublishToStorage, false));
            await settings.SetKeepContentAsync(true);

            (await settings.GetModeAsync()).Should().Be(new UilmStorageMode(false, true));
        }

        // ---- Maintenance runs ----

        [Fact]
        public async Task Backfill_ConvertsTheBatchPerRun_ByteIdentical_WithAnETag_AndVersionZero_E1_H1_H2_H7_H10_H5()
        {
            // No settings document: Storage is on by default (H5).
            var bodies = Enumerable.Range(0, 5).ToDictionary(i => $"l{i}", i => $"{{\"title\":\"Ä {i}\",  \"z\":1,\"a\":2}}");
            await UilmFiles.InsertManyAsync(bodies.Select(b => Legacy("legacy-" + b.Key, b.Key, b.Value)));
            var before = new Dictionary<string, byte[]>();
            foreach (var language in bodies.Keys) before[language] = Body(await ReadAsync(language));
            var maintenance = Maintenance(new UilmStorageOptions { BackfillBatchSize = 3, UploadRetryDelays = [] });

            await maintenance.RunAsync(RunMaintenance);
            (await UilmFiles.CountDocumentsAsync(f => f.FileId != null)).Should().Be(3);
            _logger.LoggedMessages().Should().Contain(m => m.StartsWith("UilmBackfillSummary: tenant uilm-tenant: 3 converted, 0 failed")
                && m.Contains("2 legacy rows remaining, 3 pointer rows with content, 0 pointer rows without content"));
            await maintenance.RunAsync(RunMaintenance);

            foreach (var (language, body) in bodies)
            {
                var row = await Row(UilmFile.PointerId(Module, language));
                row.Version.Should().Be(0);
                row.Content.Should().Be(body, "the row keeps its content while KeepContent is true");
                (await StoredFiles.Find(f => f.Id == row.FileId).SingleAsync()).State.Should().Be(UilmStoredFileState.Live);
                var read = await ReadAsync(language);
                read.Kind.Should().Be(UilmFileReadKind.File);
                read.ETag.Should().Be($"\"{row.ContentHash}\"");
                read.Bytes.Should().Equal(before[language]);
            }
            (await UilmFiles.CountDocumentsAsync(FilterDefinition<UilmFile>.Empty)).Should().Be(5);
            _logger.LoggedMessages().Should().Contain(m => m.Contains("0 legacy rows remaining, 5 pointer rows with content"));
        }

        [Fact]
        public async Task Backfill_UploadsTheStoredContent_NotTheCurrentKeys_H3()
        {
            await UilmFiles.InsertOneAsync(Legacy("legacy", "en-US", "{\"title\":\"Sign in\"}"));
            await _database.GetCollection<BsonDocument>("BlocksLanguageKeys").InsertOneAsync(new BsonDocument
            {
                { "KeyName", "title" }, { "ModuleId", Module }, { "Resources", new BsonArray { new BsonDocument { { "Culture", "en-US" }, { "Value", "Edited, not published" } } } }
            });

            await Maintenance().RunAsync(RunMaintenance);

            _storage.Blobs.Values.Should().ContainSingle().Which.Should().Equal(Encoding.UTF8.GetBytes("{\"title\":\"Sign in\"}"));
        }

        [Fact]
        public async Task Duplicates_TheReadersRowIsBackfilled_AndTheOthersDeletedAfterThePointerExists_H4()
        {
            await UilmFiles.InsertManyAsync(new[] { Legacy("first", "en-US", "{\"n\":1}"), Legacy("second", "en-US", "{\"n\":2}") });
            var served = Body(await ReadAsync("en-US"));

            await Maintenance().RunAsync(RunMaintenance);

            var rows = await UilmFiles.Find(FilterDefinition<UilmFile>.Empty).ToListAsync();
            rows.Should().ContainSingle().Which.Id.Should().Be("app-login|en-US");
            _storage.Blobs.Values.Should().ContainSingle().Which.Should().Equal(served);
            Body(await ReadAsync("en-US")).Should().Equal(served);
        }

        [Fact]
        public async Task ARowASwitchOffPublishWrote_KeepsItsVersion_AndAForeignFileIsReplaced_Q2_C3()
        {
            await UilmFiles.InsertManyAsync(new[]
            {
                new UilmFile { Id = "app-login|en-US", ModuleName = Module, Language = "en-US", Content = "{\"a\":1}", Version = 7 },
                new UilmFile { Id = "app-login|xx-XX", ModuleName = Module, Language = "xx-XX", Content = "{\"b\":1}", Version = 3,
                    FileId = "copied-file", Url = "https://elsewhere.test/copied-file", ContentHash = "x" }
            });

            await Maintenance().RunAsync(RunMaintenance);

            var en = await Row("app-login|en-US");
            en.Version.Should().Be(7);
            en.FileId.Should().NotBeNull();
            var xx = await Row("app-login|xx-XX");
            xx.FileId.Should().NotBe("copied-file");
            xx.Content.Should().Be("{\"b\":1}", "content stays until the row has a verified tenant file");
            _storage.Http.Urls(HttpMethod.Get).Should().NotContain(u => u.Contains("elsewhere"));
        }

        [Fact]
        public async Task ByteOrderMark_IsLeftOutOfTheFile_AndLogged_RowKeepsItsContent_C13()
        {
            await UilmFiles.InsertOneAsync(Legacy("legacy", "en-US", "﻿{\"a\":1}"));

            await Maintenance().RunAsync(RunMaintenance);

            _storage.Blobs.Values.Single().Should().Equal(Encoding.UTF8.GetBytes("{\"a\":1}"));
            (await Row("app-login|en-US")).Content.Should().Be("﻿{\"a\":1}");
            _logger.LoggedMessages().Should().Contain("UilmBackfillBomRemoved: module app-login language en-US");
        }

        [Fact]
        public async Task APublishDuringTheUpload_Wins_AndTheBackfillFileIsRetiredAtOnce_C1_E3()
        {
            await UilmFiles.InsertOneAsync(Legacy("legacy", "en-US", "{\"title\":\"Old\"}"));
            var publisher = Publisher();
            _storage.BeforeFirstPut = async () =>
            {
                await publisher.PublishModuleAsync(await publisher.BeginAsync(Tenant, false), Module,
                    new List<UilmFile> { new() { Language = "en-US", Content = "{\"title\":\"New\"}" } });
            };

            await Maintenance().RunAsync(RunMaintenance);

            var row = await Row("app-login|en-US");
            row.Version.Should().BeGreaterThan(0);
            Body(await ReadAsync("en-US")).Should().Equal(Encoding.UTF8.GetBytes("{\"title\":\"New\"}"));
            var retired = await StoredFiles.Find(f => f.State == UilmStoredFileState.Retired).SingleAsync();
            retired.Id.Should().NotBe(row.FileId);
            retired.DeleteAfter.Should().Be(Now);
            _logger.LoggedMessages().Should().Contain(m => m.Contains("0 converted, 0 failed, 1 superseded by a publish"));
        }

        [Fact]
        public async Task AFailedUpload_LeavesTheRow_LogsUilmBackfillFailed_AndTheNextRunConverts_C2()
        {
            await UilmFiles.InsertOneAsync(Legacy("legacy", "en-US", "{}"));
            _storage.FailPuts = true;
            var maintenance = Maintenance();

            await maintenance.RunAsync(RunMaintenance);

            (await Row("legacy")).FileId.Should().BeNull();
            _logger.LoggedMessages().Should().Contain("UilmBackfillFailed: module app-login language en-US: HTTP 503");
            (await StoredFiles.Find(FilterDefinition<UilmStoredFile>.Empty).SingleAsync()).State.Should().Be(UilmStoredFileState.Retired);

            _storage.FailPuts = false;
            await maintenance.RunAsync(RunMaintenance);

            (await Row("app-login|en-US")).FileId.Should().NotBeNull();
            (await UilmFiles.CountDocumentsAsync(f => f.Id == "legacy")).Should().Be(0);
        }

        [Fact]
        public async Task OverlappingRuns_ConvertEachGroupOnce_C10()
        {
            await UilmFiles.InsertManyAsync(Enumerable.Range(0, 20).Select(i => Legacy($"legacy-{i}", $"l{i:D2}", $"{{\"n\":{i}}}")));

            await Task.WhenAll(Maintenance().RunAsync(RunMaintenance), Maintenance().RunAsync(RunMaintenance));

            var rows = await UilmFiles.Find(FilterDefinition<UilmFile>.Empty).ToListAsync();
            rows.Should().HaveCount(20).And.OnlyContain(r => r.Id.StartsWith("app-login|") && r.FileId != null);
            var live = await StoredFiles.Find(f => f.State == UilmStoredFileState.Live).Project(f => f.Id).ToListAsync();
            live.Should().BeEquivalentTo(rows.Select(r => r.FileId));
        }

        [Fact]
        public async Task SwitchOff_SkipsBackfillAndRemoval_C6()
        {
            await SettingsDocuments.InsertOneAsync(new UilmStorageSettings { PublishToStorage = false, KeepContent = false });
            await UilmFiles.InsertOneAsync(Legacy("legacy", "en-US", "{}"));

            await Maintenance().RunAsync(RunMaintenance);

            (await Row("legacy")).FileId.Should().BeNull();
            _storage.Http.Requests.Should().BeEmpty();
            _logger.LoggedMessages().Should().NotContain(m => m.StartsWith("UilmBackfillSummary"));
        }

        [Fact]
        public async Task KeepContentFalse_RemovesContentOnlyFromVerifiedRows_ReadsStayTheSame_AndNewPublishesWriteNone_H6_H7_C4_E4()
        {
            await UilmFiles.InsertManyAsync(new[] { Legacy("legacy-en", "en-US", "{\"a\":\"en\"}"), Legacy("legacy-xx", "xx-XX", "{\"a\":\"xx\"}") });
            var maintenance = Maintenance();
            await maintenance.RunAsync(RunMaintenance);
            var before = Body(await ReadAsync("en-US"));
            var etag = (await ReadAsync("en-US")).ETag;
            // A seed row copied in afterwards has no file: it keeps its content (C4).
            await UilmFiles.InsertOneAsync(Legacy("seed", "yy-YY", "{\"a\":\"seed\"}"));
            _storage.Blobs[(await Row("app-login|xx-XX")).FileId!] = Encoding.UTF8.GetBytes("tampered");
            await Settings().SetKeepContentAsync(false);
            _storage.FailPuts = true;

            await maintenance.RunAsync(RunMaintenance);

            (await Row("app-login|en-US")).Content.Should().BeNull();
            (await Row("app-login|xx-XX")).Content.Should().Be("{\"a\":\"xx\"}", "its file doesn't match the hash");
            (await Row("seed")).Content.Should().Be("{\"a\":\"seed\"}");
            _logger.LoggedMessages().Should().Contain(m => m.StartsWith("UilmContentRemovalSkipped: module app-login language xx-XX") && m.EndsWith("content hash mismatch"));
            _logger.LoggedMessages().Should().Contain("UilmContentRemoval: tenant uilm-tenant: content removed from 1 rows, kept on 1 rows that failed verification");
            var after = await ReadAsync("en-US");
            after.Bytes.Should().Equal(before);
            after.ETag.Should().Be(etag);

            _storage.FailPuts = false;
            var publisher = Publisher();
            await publisher.PublishModuleAsync(await publisher.BeginAsync(Tenant, false), "other",
                new List<UilmFile> { new() { Language = "en-US", Content = "{\"b\":1}" } });
            (await Row("other|en-US")).Content.Should().BeNull();
            Body(await ReadAsync("en-US", module: "other")).Should().Equal(Encoding.UTF8.GetBytes("{\"b\":1}"));
        }

        [Fact]
        public async Task StorageDown_AfterContentRemoval_IsUnavailable_NeverAnEmptyBody_C5_E6()
        {
            await Settings().SetKeepContentAsync(false);
            await UilmFiles.InsertOneAsync(Legacy("legacy", "en-US", "{}"));
            await Maintenance().RunAsync(RunMaintenance);
            (await Row("app-login|en-US")).Content.Should().BeNull();
            _storage.Blobs.Clear();

            (await ReadAsync("en-US")).Should().Be(UilmFileReadResult.Unavailable);
        }

        [Fact]
        public async Task SeedRowsCopiedLater_AreServedFromContent_ThenBackfilled_H9()
        {
            await UilmFiles.InsertOneAsync(Legacy("legacy", "en-US", "{\"a\":1}"));
            var maintenance = Maintenance();
            await maintenance.RunAsync(RunMaintenance);
            // A blocks-os data cleanup replaces the rows with seed rows.
            await UilmFiles.DeleteManyAsync(FilterDefinition<UilmFile>.Empty);
            await UilmFiles.InsertOneAsync(Legacy("seed", "en-US", "{\"seed\":1}"));

            (await ReadAsync("en-US")).Should().Be(new UilmFileReadResult(UilmFileReadKind.Content, "{\"seed\":1}"));
            await maintenance.RunAsync(RunMaintenance);

            (await ReadAsync("en-US")).Bytes.Should().Equal(Encoding.UTF8.GetBytes("{\"seed\":1}"));
        }

        [Fact]
        public async Task Restore_WritesBackVerifiedContent_SetsKeepContent_AndSkipsTamperedOrMissingFiles_H8_C8_C9_E7()
        {
            await Settings().SetKeepContentAsync(false);
            await UilmFiles.InsertManyAsync(new[]
            {
                Legacy("a", "en-US", "{\"a\":\"Ä\"}"), Legacy("b", "xx-XX", "{\"b\":1}"), Legacy("c", "yy-YY", "{\"c\":1}")
            });
            await Maintenance().RunAsync(RunMaintenance);
            (await UilmFiles.CountDocumentsAsync(f => f.Content == null)).Should().Be(3);
            _storage.Blobs[(await Row("app-login|xx-XX")).FileId!] = Encoding.UTF8.GetBytes("tampered");
            _storage.Blobs.Remove((await Row("app-login|yy-YY")).FileId!);

            await Maintenance().RunAsync(RunRestore);

            (await Row("app-login|en-US")).Content.Should().Be("{\"a\":\"Ä\"}");
            (await Row("app-login|xx-XX")).Content.Should().BeNull();
            (await Row("app-login|yy-YY")).Content.Should().BeNull();
            (await Settings().GetModeAsync()).KeepContent.Should().BeTrue();
            _logger.LoggedMessages().Should().Contain(m => m.StartsWith("UilmRestoreHashMismatch: module app-login language xx-XX"));
            _logger.LoggedMessages().Should().Contain(m => m.StartsWith("UilmRestoreDownloadFailed: module app-login language yy-YY") && m.EndsWith("HTTP 404"));
            _logger.LoggedMessages().Should().Contain("UilmRestoreContent: tenant uilm-tenant: content restored on 1 rows, 1 hash mismatches, 1 downloads failed; KeepContent is true");
        }

        [Fact]
        public async Task AnInterruptedConversion_IsFinished_AndItsOrphanUploadRetiredByReconcile_C7()
        {
            // A run that stopped after the pointer write left a duplicate, and one that stopped after the upload an orphan.
            await LiveFileAsync("converted");
            await UilmFiles.InsertManyAsync(new[]
            {
                new UilmFile { Id = "app-login|en-US", ModuleName = Module, Language = "en-US", Content = "{}", FileId = "converted", ContentHash = "h", Version = 0 },
                Legacy("leftover", "en-US", "{}")
            });
            await StoredFiles.InsertOneAsync(new UilmStoredFile { Id = "orphan", ModuleName = Module, Language = "en-US",
                State = UilmStoredFileState.Uploading, CreatedAt = Now.AddHours(-2) });

            await Maintenance().RunAsync(RunMaintenance);

            (await UilmFiles.Find(FilterDefinition<UilmFile>.Empty).Project(f => f.Id).ToListAsync()).Should().Equal("app-login|en-US");
            (await StoredFiles.Find(f => f.Id == "orphan").SingleAsync()).State.Should().Be(UilmStoredFileState.Retired);
            _storage.Blobs.Should().BeEmpty("nothing was uploaded");
        }

        /// <summary>Storage files in memory behind the stub HTTP handler and a mocked driver.</summary>
        private sealed class FakeStorage
        {
            private int _puts;

            public Dictionary<string, byte[]> Blobs { get; } = new();
            public StubStorageHttp Http { get; } = new();
            public Mock<IStorageDriverService> Driver { get; } = new();
            public bool FailPuts { get; set; }

            /// <summary>Runs once, before the first upload is stored (to race a publish against it).</summary>
            public Func<Task>? BeforeFirstPut { get; set; }

            public FakeStorage()
            {
                Driver.Setup(d => d.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>()))
                    .ReturnsAsync((GetPreSignedUrlForUploadRequest r) => new GetPreSignedUrlForUploadResponse { UploadUrl = "https://upload.test/" + r.ItemId });
                Driver.Setup(d => d.GetUrlForDownloadFileAsync(It.IsAny<GetFileRequest>()))
                    .ReturnsAsync((GetFileRequest r) => new FileResponse { Url = "https://files.test/" + r.FileId });
                Http.Respond = async request =>
                {
                    var id = request.RequestUri!.Segments[^1];
                    if (request.Method == HttpMethod.Put)
                    {
                        if (FailPuts) return new HttpResponseMessage(HttpStatusCode.ServiceUnavailable);
                        if (Interlocked.Increment(ref _puts) == 1 && BeforeFirstPut != null) await BeforeFirstPut();
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
    }
}
