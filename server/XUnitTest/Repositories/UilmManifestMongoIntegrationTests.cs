using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
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
    /// GetUilmManifest's query and reader on local MongoDB (port from BLOCKS_ROUTING_TEST_MONGO_PORT): the selection
    /// matches GetUilmFile, the ledger guard, filters, tenants, and a publish switching pointers.
    /// </summary>
    public sealed class UilmManifestMongoIntegrationTests : IDisposable
    {
        private const string Module = "app-login";
        private const string TenantA = "manifest-tenant-a";
        private const string TenantB = "manifest-tenant-b";
        private readonly MongoClient _client;
        private readonly string _databaseA = "blocks_uilm350a_" + Guid.NewGuid().ToString("N");
        private readonly string _databaseB = "blocks_uilm350b_" + Guid.NewGuid().ToString("N");
        private readonly Mock<IDbContextProvider> _provider = new();
        private readonly StubStorageHttp _http = new();

        public UilmManifestMongoIntegrationTests()
        {
            TestBlocksContext.Set(TenantA);
            var port = Environment.GetEnvironmentVariable("BLOCKS_ROUTING_TEST_MONGO_PORT") ?? "27017";
            _client = new MongoClient($"mongodb://localhost:{port}/?appName=uilm350-tests");
            _client.GetDatabase(_databaseA).RunCommand<BsonDocument>(new BsonDocument("ping", 1));
            _provider.Setup(x => x.GetDatabase(TenantA)).Returns(_client.GetDatabase(_databaseA));
            _provider.Setup(x => x.GetDatabase(TenantB)).Returns(_client.GetDatabase(_databaseB));
        }

        public void Dispose()
        {
            _client.DropDatabase(_databaseA);
            _client.DropDatabase(_databaseB);
            _client.Dispose();
        }

        private IMongoDatabase Database(string tenant = TenantA) => _provider.Object.GetDatabase(tenant);
        private IMongoCollection<UilmFile> UilmFiles(string tenant = TenantA) => Database(tenant).GetCollection<UilmFile>("UilmFiles");
        private IMongoCollection<UilmStoredFile> Ledger(string tenant = TenantA) => Database(tenant).GetCollection<UilmStoredFile>("UilmStoredFiles");
        private KeyRepository Keys() => new(_provider.Object, NullLogger<KeyRepository>.Instance);

        private UilmFileReader Reader() => new(Keys(), new UilmStoredFileRepository(_provider.Object),
            new UilmStorageInfrastructure(new UilmStorageOptions(), _http.Factory().Object, TimeProvider.System), NullLogger<UilmFileReader>.Instance);

        private static UilmFile Pointer(string module, string language, int version, string fileId) => new()
        {
            Id = UilmFile.PointerId(module, language), ModuleName = module, Language = language, Content = "{\"k\":\"v\"}",
            FileId = fileId, Url = "https://files.test/" + fileId, ContentHash = "hash-" + fileId, Size = 10 + version, Version = version
        };

        private async Task InsertLiveAsync(string tenant, params UilmFile[] pointers)
        {
            await UilmFiles(tenant).InsertManyAsync(pointers);
            await Ledger(tenant).InsertManyAsync(pointers.Select(p => new UilmStoredFile
            {
                Id = p.FileId!, ModuleName = p.ModuleName, Language = p.Language, State = UilmStoredFileState.Live
            }));
        }

        private static async Task<JsonElement> ManifestJsonAsync(UilmFileReader reader, GetUilmManifestRequest? request = null)
        {
            var result = await reader.GetManifestAsync(request ?? new GetUilmManifestRequest(), null);
            result.Kind.Should().Be(UilmFileReadKind.File);
            return JsonDocument.Parse(result.Bytes!).RootElement.Clone();
        }

        private static List<string> Pairs(JsonElement manifest) => manifest.GetProperty("files").EnumerateArray()
            .Select(f => $"{f.GetProperty("moduleName").GetString()}/{f.GetProperty("language").GetString()}").ToList();

        // ---- Selection (H1, H3, H7, C1, C5, C8) ----

        [Fact]
        public async Task Rows_AreTheOnesGetUilmFileServes_OnePerModuleAndLanguage_H1_C5()
        {
            await InsertLiveAsync(TenantA, Pointer(Module, "en-US", 5, "f5"), Pointer("root", "en-US", 6, "r6"));
            await UilmFiles().InsertManyAsync(new[]
            {
                new UilmFile { Id = "legacy-1", ModuleName = Module, Language = "en-US", Content = "{\"old\":1}" },
                new UilmFile { Id = "legacy-2", ModuleName = Module, Language = "xx-XX", Content = "{\"old\":2}" },
                new UilmFile { Id = "legacy-3", ModuleName = Module, Language = "xx-XX", Content = "{\"old\":3}" }
            });
            var keys = Keys();

            var rows = await keys.GetUilmManifestRowsAsync(null, null);

            rows.Should().HaveCount(3);
            foreach (var row in rows)
            {
                var served = await keys.GetUilmFile(new GetUilmFileRequest { ModuleName = row.ModuleName, Language = row.Language });
                row.FileId.Should().Be(served.FileId);
                row.Version.Should().Be(served.Version);
            }
            rows.Single(r => r.ModuleName == Module && r.Language == "en-US").Should().BeEquivalentTo(new UilmManifestRow
            {
                ModuleName = Module, Language = "en-US", FileId = "f5", Url = "https://files.test/f5", ContentHash = "hash-f5",
                Size = 15, Version = 5, LedgerState = UilmStoredFileState.Live
            }, "a module whose last publish failed keeps its previous pointer (C5)");
            rows.Single(r => r.Language == "xx-XX").LedgerState.Should().BeNull();
        }

        [Fact]
        public async Task Manifest_ListsLiveFiles_AndNullEntriesForEverythingElse_SortedOrdinally_H1_H3_H7_C1()
        {
            await InsertLiveAsync(TenantA, Pointer(Module, "en-US", 7, "live"), Pointer("Zeta", "en-US", 3, "upper"));
            await UilmFiles().InsertManyAsync(new[]
            {
                Pointer("root", "en-US", 6, "foreign"),
                Pointer("root", "xx-XX", 6, "uploading"),
                Pointer("root", "yy-YY", 6, "retired"),
                new UilmFile { Id = "legacy", ModuleName = "root", Language = "zz-ZZ", Content = "{\"k\":\"v\"}" }
            });
            await Ledger().InsertManyAsync(new[]
            {
                new UilmStoredFile { Id = "uploading", State = UilmStoredFileState.Uploading },
                new UilmStoredFile { Id = "retired", State = UilmStoredFileState.Retired, DeleteAfter = DateTime.UtcNow.AddHours(24) }
            });

            var manifest = await ManifestJsonAsync(Reader());

            Pairs(manifest).Should().Equal("Zeta/en-US", "app-login/en-US", "root/en-US", "root/xx-XX", "root/yy-YY", "root/zz-ZZ");
            manifest.GetProperty("version").GetInt32().Should().Be(7);
            var files = manifest.GetProperty("files");
            files[1].GetProperty("url").GetString().Should().Be("https://files.test/live");
            files[1].GetProperty("hash").GetString().Should().Be("hash-live");
            files[1].GetProperty("size").GetInt64().Should().Be(17);
            files[1].GetProperty("version").GetInt32().Should().Be(7);
            foreach (var entry in files.EnumerateArray().Skip(2))
            {
                foreach (var field in new[] { "url", "hash", "size", "version" })
                {
                    entry.GetProperty(field).ValueKind.Should().Be(JsonValueKind.Null, $"{field} of {entry}");
                }
            }
        }

        [Fact]
        public async Task Manifest_NeverContainsTheRowsContent_C8()
        {
            await InsertLiveAsync(TenantA, Pointer(Module, "en-US", 1, "f1"));
            await UilmFiles().UpdateOneAsync(f => f.FileId == "f1", Builders<UilmFile>.Update.Set(f => f.Content, "{\"secret-marker\":\"" + new string('x', 5000) + "\"}"));

            var result = await Reader().GetManifestAsync(new GetUilmManifestRequest(), null);

            var json = Encoding.UTF8.GetString(result.Bytes!);
            json.Should().NotContain("secret-marker");
            json.Length.Should().BeLessThan(300);
        }

        // ---- Filters and empty (H2, H8, E5) ----

        [Fact]
        public async Task Filters_MatchExactlyAndCaseSensitively_H2_E5()
        {
            await InsertLiveAsync(TenantA, Pointer(Module, "en-US", 1, "a"), Pointer(Module, "xx-XX", 1, "b"), Pointer("root", "en-US", 1, "c"),
                Pointer("app-login-extra", "en-US", 1, "d"));
            var reader = Reader();

            Pairs(await ManifestJsonAsync(reader, new() { Language = "en-US" })).Should().Equal("app-login/en-US", "app-login-extra/en-US", "root/en-US");
            Pairs(await ManifestJsonAsync(reader, new() { ModuleName = Module })).Should().Equal("app-login/en-US", "app-login/xx-XX");
            Pairs(await ManifestJsonAsync(reader, new() { ModuleName = Module, Language = "xx-XX" })).Should().Equal("app-login/xx-XX");
            Pairs(await ManifestJsonAsync(reader, new() { ModuleName = "App-Login" })).Should().BeEmpty();
            Pairs(await ManifestJsonAsync(reader, new() { Language = "en-us" })).Should().BeEmpty();
            var unknown = await reader.GetManifestAsync(new() { ModuleName = "app-unknown" }, null);
            Encoding.UTF8.GetString(unknown.Bytes!).Should().Be("{\"version\":0,\"files\":[]}");
        }

        [Fact]
        public async Task EmptyTenant_IsAnEmptyManifest_H8()
        {
            Encoding.UTF8.GetString((await Reader().GetManifestAsync(new GetUilmManifestRequest(), null)).Bytes!)
                .Should().Be("{\"version\":0,\"files\":[]}");
        }

        // ---- Tenants (C2) ----

        [Fact]
        public async Task EachTenant_SeesOnlyItsOwnFilesAndLedger_C2()
        {
            await InsertLiveAsync(TenantA, Pointer(Module, "en-US", 4, "a4"));
            await UilmFiles(TenantB).InsertOneAsync(Pointer("tenant-b-module", "en-US", 9, "a4"));
            var reader = Reader();

            var a = await ManifestJsonAsync(reader);
            TestBlocksContext.Set(TenantB);
            var b = await ManifestJsonAsync(reader);

            Pairs(a).Should().Equal("app-login/en-US");
            Pairs(b).Should().Equal("tenant-b-module/en-US");
            b.GetProperty("files")[0].GetProperty("url").ValueKind.Should().Be(JsonValueKind.Null,
                "tenant A's ledger row for the same file id does not count for tenant B");
            b.GetProperty("version").GetInt32().Should().Be(0);
        }

        // ---- Publish switching pointers (H4, H5, H6, C11) ----

        private sealed class FakeStorage
        {
            public Dictionary<string, byte[]> Blobs { get; } = new();
            public Mock<IStorageDriverService> Driver { get; } = new();

            public FakeStorage(StubStorageHttp http)
            {
                Driver.Setup(d => d.GetPerSignedUrlForUploadAsync(It.IsAny<GetPreSignedUrlForUploadRequest>()))
                    .ReturnsAsync((GetPreSignedUrlForUploadRequest r) => new GetPreSignedUrlForUploadResponse { UploadUrl = "https://upload.test/" + r.ItemId });
                Driver.Setup(d => d.GetUrlForDownloadFileAsync(It.IsAny<GetFileRequest>()))
                    .ReturnsAsync((GetFileRequest r) => new FileResponse { Url = "https://files.test/" + r.FileId });
                http.Respond = async request =>
                {
                    var id = request.RequestUri!.Segments[^1];
                    if (request.Method == HttpMethod.Put)
                    {
                        var bytes = await request.Content!.ReadAsByteArrayAsync();
                        lock (Blobs) Blobs[id] = bytes;
                        return new HttpResponseMessage(HttpStatusCode.Created);
                    }
                    lock (Blobs) return Blobs.TryGetValue(id, out var stored) ? StubStorageHttp.Ok(stored) : new HttpResponseMessage(HttpStatusCode.NotFound);
                };
            }
        }

        private UilmFilePublisher Publisher(FakeStorage storage) => new(Keys(), new UilmStoredFileRepository(_provider.Object),
            new UilmStorageSettingsRepository(_provider.Object),
            new UilmPublishCounterRepository(_provider.Object, new LanguageFileGenerationHistoryRepository(_provider.Object)),
            storage.Driver.Object, new UilmStorageInfrastructure(new UilmStorageOptions(), _http.Factory().Object, TimeProvider.System),
            NullLogger<UilmFilePublisher>.Instance);

        private static List<UilmFile> Files(string english) =>
        [
            new UilmFile { Language = "en-US", Content = english },
            new UilmFile { Language = "key", Content = "{\"title\":\"title\"}" }
        ];

        [Fact]
        public async Task AfterAPublish_EntriesMatchTheStoredBytesAndGetUilmFile_AndTheNextPublishChangesTheETag_H3_H4_H5_H6_E1_E2_E3()
        {
            await Database().GetCollection<UilmStorageSettings>("UilmStorageSettings").InsertOneAsync(new UilmStorageSettings { PublishToStorage = true });
            var storage = new FakeStorage(_http);
            var publisher = Publisher(storage);
            var reader = Reader();
            var english = new GetUilmFileRequest { ModuleName = Module, Language = "en-US" };

            var v1 = await publisher.BeginAsync(TenantA, false);
            await publisher.PublishModuleAsync(v1, Module, Files("{\"title\":\"Sign in\"}"));
            var first = await reader.GetManifestAsync(new GetUilmManifestRequest(), null);
            var firstJson = JsonDocument.Parse(first.Bytes!).RootElement.Clone();

            Pairs(firstJson).Should().Equal("app-login/en-US", "app-login/key");
            foreach (var entry in firstJson.GetProperty("files").EnumerateArray())
            {
                var hash = entry.GetProperty("hash").GetString()!;
                var stored = storage.Blobs[entry.GetProperty("url").GetString()!.Split('/')[^1]];
                Convert.ToHexStringLower(SHA256.HashData(stored)).Should().Be(hash, "H4: the stored bytes hash to the entry's hash");
                entry.GetProperty("size").GetInt64().Should().Be(stored.Length);
                entry.GetProperty("version").GetInt32().Should().Be(v1.Version);
                var file = await reader.ReadAsync(new GetUilmFileRequest { ModuleName = Module, Language = entry.GetProperty("language").GetString()! }, null);
                file.ETag.Should().Be($"\"{hash}\"", "H3: the hash equals GetUilmFile's ETag value");
                file.Bytes.Should().Equal(stored, "H4: GetUilmFile serves the same bytes");
            }
            firstJson.GetProperty("version").GetInt32().Should().Be(v1.Version);
            (await reader.GetManifestAsync(new GetUilmManifestRequest(), first.ETag)).Should()
                .Be(new UilmFileReadResult(UilmFileReadKind.NotModified, ETag: first.ETag), "E2");

            var v2 = await publisher.BeginAsync(TenantA, false);
            await publisher.PublishModuleAsync(v2, Module, Files("{\"title\":\"Log in\"}"));
            var second = await reader.GetManifestAsync(new GetUilmManifestRequest(), first.ETag);

            second.Kind.Should().Be(UilmFileReadKind.File, "H6: the old ETag no longer matches");
            second.ETag.Should().NotBe(first.ETag);
            var before = firstJson.GetProperty("files");
            var after = JsonDocument.Parse(second.Bytes!).RootElement.GetProperty("files");
            after[0].GetProperty("url").GetString().Should().NotBe(before[0].GetProperty("url").GetString(), "E3: the changed file has a new URL");
            after[0].GetProperty("version").GetInt32().Should().Be(v2.Version);
            after[1].ToString().Should().Be(before[1].ToString(), "E3: the unchanged file keeps its entry");
            (await reader.ReadAsync(english, null)).ETag.Should().Be($"\"{after[0].GetProperty("hash").GetString()}\"");
        }

        [Fact]
        public async Task AFailedPublish_KeepsThePreviousFileInTheManifest_C5()
        {
            await Database().GetCollection<UilmStorageSettings>("UilmStorageSettings").InsertOneAsync(new UilmStorageSettings { PublishToStorage = true });
            var storage = new FakeStorage(_http);
            var publisher = Publisher(storage);
            var reader = Reader();
            await publisher.PublishModuleAsync(await publisher.BeginAsync(TenantA, false), Module, Files("{\"title\":\"Sign in\"}"));
            var before = await reader.GetManifestAsync(new GetUilmManifestRequest(), null);
            var working = _http.Respond;
            _http.Respond = request => request.Method == HttpMethod.Put
                ? Task.FromResult(new HttpResponseMessage(HttpStatusCode.InternalServerError))
                : working(request);

            var failed = await publisher.PublishModuleAsync(await publisher.BeginAsync(TenantA, false), Module, Files("{\"title\":\"Log in\"}"));

            failed.Failed.Should().BeTrue();
            var after = await reader.GetManifestAsync(new GetUilmManifestRequest(), before.ETag);
            after.Should().Be(new UilmFileReadResult(UilmFileReadKind.NotModified, ETag: before.ETag), "the module keeps its previous files");
        }

        [Fact]
        public async Task APointerSwitchedBeforeItsFileIsLive_IsANullEntry_NeverAnUnknownUrl_C11()
        {
            await InsertLiveAsync(TenantA, Pointer(Module, "en-US", 1, "old"));
            var ledger = new UilmStoredFileRepository(_provider.Object);
            await ledger.InsertAsync(new UilmStoredFile { Id = "new", ModuleName = Module, Language = "en-US" });
            await Keys().ReplaceUilmFilePointerAsync(Pointer(Module, "en-US", 2, "new"));
            var reader = Reader();

            var switching = (await ManifestJsonAsync(reader)).GetProperty("files")[0];
            await ledger.MarkLiveAsync(["new"], UilmStoredFileState.Uploading);
            var live = (await ManifestJsonAsync(reader)).GetProperty("files")[0];

            switching.GetProperty("url").ValueKind.Should().Be(JsonValueKind.Null, "the new file is still Uploading; the client falls back");
            live.GetProperty("url").GetString().Should().Be("https://files.test/new");
        }

        [Fact]
        public async Task DuringAPointerSwitch_EachEntryIsTheOldFile_TheNewFile_OrNull_C11()
        {
            await InsertLiveAsync(TenantA, Pointer(Module, "en-US", 1, "old"));
            var keys = Keys();
            var ledger = new UilmStoredFileRepository(_provider.Object);
            var reader = Reader();
            await ledger.InsertAsync(new UilmStoredFile { Id = "new", ModuleName = Module, Language = "en-US" });

            async Task<JsonElement> FirstEntryAsync() => (await ManifestJsonAsync(reader)).GetProperty("files")[0];

            var reads = Enumerable.Range(0, 30).Select(_ => FirstEntryAsync()).ToList();
            await keys.ReplaceUilmFilePointerAsync(Pointer(Module, "en-US", 2, "new"));
            await ledger.MarkLiveAsync(["new"], UilmStoredFileState.Uploading);
            await ledger.RetireAsync(["old"], DateTime.UtcNow.AddHours(24));
            reads.Add(FirstEntryAsync());

            var urls = (await Task.WhenAll(reads)).Select(e => e.GetProperty("url").ValueKind == JsonValueKind.Null ? null : e.GetProperty("url").GetString()).ToList();

            urls.Should().OnlyContain(u => u == null || u == "https://files.test/old" || u == "https://files.test/new");
            urls[^1].Should().Be("https://files.test/new");
        }
    }
}
