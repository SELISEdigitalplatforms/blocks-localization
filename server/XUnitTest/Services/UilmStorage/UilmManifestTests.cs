using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Repositories.UilmStorage;
using Eurolm.DomainService.Services.UilmStorage;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using XUnitTest.Shared;

namespace XUnitTest.Services.UilmStorage
{
    /// <summary>GetUilmManifest: entries, null entries, sort, version, manifest hash and the reader's answer (spec 4, 6).</summary>
    public class UilmManifestTests
    {
        private readonly Mock<IKeyRepository> _keys = new(MockBehavior.Strict);
        private readonly Mock<IUilmStoredFileRepository> _ledger = new(MockBehavior.Strict);
        private readonly StubStorageHttp _http = new();
        private readonly UilmFileReader _reader;

        public UilmManifestTests()
        {
            TestBlocksContext.Set("tenant-a");
            _http.Respond = _ => throw new HttpRequestException("Storage must not be called");
            _reader = new UilmFileReader(_keys.Object, _ledger.Object,
                new UilmStorageInfrastructure(new UilmStorageOptions(), _http.Factory().Object, TimeProvider.System),
                Mock.Of<ILogger<UilmFileReader>>());
        }

        private static UilmManifestRow Live(string module, string language, int version = 7, string hash = "h") => new()
        {
            ModuleName = module, Language = language, FileId = $"f-{module}-{language}-{version}",
            Url = $"https://files.test/{module}.{language}.{version}.json", ContentHash = hash + version, Size = 100 + version,
            Version = version, LedgerState = UilmStoredFileState.Live
        };

        private void Rows(params UilmManifestRow[] rows) =>
            _keys.Setup(k => k.GetUilmManifestRowsAsync(It.IsAny<string?>(), It.IsAny<string?>())).ReturnsAsync(rows.ToList());

        private static string Sha256(string text) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(text)));

        private static JsonElement Json(UilmFileReadResult result) => JsonDocument.Parse(result.Bytes!).RootElement;

        // ---- Entries (H3, H7, C1, C8) ----

        [Fact]
        public void LiveFile_GetsItsUrlHashSizeAndVersion_H3()
        {
            var entry = UilmManifest.FromRows([Live("app-login", "en-US", 12)]).Files.Should().ContainSingle().Subject;

            entry.Should().BeEquivalentTo(new UilmManifestEntry
            {
                ModuleName = "app-login", Language = "en-US", Url = "https://files.test/app-login.en-US.12.json",
                Hash = "h12", Size = 112, Version = 12
            });
        }

        public static TheoryData<string, UilmManifestRow> NotLiveRows() => new()
        {
            { "legacy row", new UilmManifestRow { ModuleName = "m", Language = "en-US" } },
            { "Storage off (versioned, no file)", new UilmManifestRow { ModuleName = "m", Language = "en-US", Version = 3 } },
            { "foreign pointer (not in ledger)", new UilmManifestRow { ModuleName = "m", Language = "en-US", FileId = "f", Url = "u", ContentHash = "h", Size = 1, Version = 3 } },
            { "ledger Uploading", new UilmManifestRow { ModuleName = "m", Language = "en-US", FileId = "f", Url = "u", ContentHash = "h", Size = 1, Version = 3, LedgerState = UilmStoredFileState.Uploading } },
            { "ledger Retired", new UilmManifestRow { ModuleName = "m", Language = "en-US", FileId = "f", Url = "u", ContentHash = "h", Size = 1, Version = 3, LedgerState = UilmStoredFileState.Retired } },
            { "Live without URL", new UilmManifestRow { ModuleName = "m", Language = "en-US", FileId = "f", ContentHash = "h", Size = 1, Version = 3, LedgerState = UilmStoredFileState.Live } },
            { "Live without hash", new UilmManifestRow { ModuleName = "m", Language = "en-US", FileId = "f", Url = "u", Size = 1, Version = 3, LedgerState = UilmStoredFileState.Live } },
            { "Live without size", new UilmManifestRow { ModuleName = "m", Language = "en-US", FileId = "f", Url = "u", ContentHash = "h", Version = 3, LedgerState = UilmStoredFileState.Live } },
            { "Live without version", new UilmManifestRow { ModuleName = "m", Language = "en-US", FileId = "f", Url = "u", ContentHash = "h", Size = 1, LedgerState = UilmStoredFileState.Live } },
            { "Live without file id", new UilmManifestRow { ModuleName = "m", Language = "en-US", Url = "u", ContentHash = "h", Size = 1, Version = 3, LedgerState = UilmStoredFileState.Live } }
        };

        [Theory]
        [MemberData(nameof(NotLiveRows))]
        public void RowWithoutALiveFile_IsANullEntry_H7_C1(string because, UilmManifestRow row)
        {
            var entry = UilmManifest.FromRows([row]).Files.Should().ContainSingle().Subject;

            entry.Should().BeEquivalentTo(new UilmManifestEntry { ModuleName = "m", Language = "en-US" }, because);
            entry.Url.Should().BeNull(because);
        }

        [Fact]
        public void Json_IsCamelCase_WritesNullFields_AndHasNoContentOrInternalIds_H7_C8()
        {
            var json = Encoding.UTF8.GetString(UilmManifest.FromRows(
            [
                Live("app-login", "en-US", 12),
                new UilmManifestRow { ModuleName = "root", Language = "en-US", FileId = "foreign", Url = "u", ContentHash = "h", Version = 2 }
            ]).ToJsonBytes());

            json.Should().Be("{\"version\":12,\"files\":["
                + "{\"moduleName\":\"app-login\",\"language\":\"en-US\",\"url\":\"https://files.test/app-login.en-US.12.json\",\"hash\":\"h12\",\"size\":112,\"version\":12},"
                + "{\"moduleName\":\"root\",\"language\":\"en-US\",\"url\":null,\"hash\":null,\"size\":null,\"version\":null}]}");
            json.Should().NotContainAny("content", "fileId", "ledger", "foreign");
        }

        // ---- Sort and version (H1, top-level version) ----

        [Fact]
        public void Entries_AreSortedOrdinallyByModuleThenLanguage_H1()
        {
            var files = UilmManifest.FromRows(
            [
                Live("b", "en-US"), Live("a", "xx-XX"), Live("B", "en-US"), Live("a", "en-US"), Live("a", "en-GB"), Live("_", "en-US")
            ]).Files;

            files.Select(f => $"{f.ModuleName}/{f.Language}").Should().Equal("B/en-US", "_/en-US", "a/en-GB", "a/en-US", "a/xx-XX", "b/en-US");
        }

        [Fact]
        public void TopLevelVersion_IsTheHighestEntryVersion_IgnoringNullEntries()
        {
            UilmManifest.FromRows([Live("a", "en-US", 4), Live("b", "en-US", 9), new UilmManifestRow { ModuleName = "c", Language = "en-US", Version = 20 }])
                .Version.Should().Be(9);
        }

        [Fact]
        public void TopLevelVersion_IsZero_WhenNoEntryHasAFile_OrOnlyBackfilledOnes()
        {
            UilmManifest.FromRows([new UilmManifestRow { ModuleName = "c", Language = "en-US" }]).Version.Should().Be(0);
            UilmManifest.FromRows([Live("a", "en-US", 0)]).Version.Should().Be(0);
        }

        [Fact]
        public void NoRows_IsAnEmptyManifest_H8()
        {
            var manifest = UilmManifest.FromRows([]);

            Encoding.UTF8.GetString(manifest.ToJsonBytes()).Should().Be("{\"version\":0,\"files\":[]}");
            manifest.ComputeHash().Should().Be(Sha256(""));
        }

        // ---- Manifest hash (H6) ----

        [Fact]
        public void Hash_IsSha256OfTheTabSeparatedLinesInResponseOrder()
        {
            var manifest = UilmManifest.FromRows([new UilmManifestRow { ModuleName = "root", Language = "en-US" }, Live("app-login", "en-US", 3)]);

            manifest.ComputeHash().Should().Be(Sha256("app-login\ten-US\th3\thttps://files.test/app-login.en-US.3.json\nroot\ten-US\t\t\n"))
                .And.MatchRegex("^[0-9a-f]{64}$");
        }

        [Fact]
        public void Hash_IsStable_ForTheSameEntriesInAnyRowOrder()
        {
            var one = UilmManifest.FromRows([Live("a", "en-US"), Live("b", "en-US"), Live("a", "xx-XX")]);
            var two = UilmManifest.FromRows([Live("a", "xx-XX"), Live("b", "en-US"), Live("a", "en-US")]);

            one.ComputeHash().Should().Be(two.ComputeHash());
            one.ToJsonBytes().Should().Equal(two.ToJsonBytes());
        }

        [Fact]
        public void Hash_Changes_WhenAnyFileChanges_OrAnEntryBecomesNull_OrAppears_H6()
        {
            var before = UilmManifest.FromRows([Live("a", "en-US", 3), Live("b", "en-US", 3)]).ComputeHash();

            UilmManifest.FromRows([Live("a", "en-US", 4), Live("b", "en-US", 3)]).ComputeHash().Should().NotBe(before);
            UilmManifest.FromRows([new UilmManifestRow { ModuleName = "a", Language = "en-US" }, Live("b", "en-US", 3)]).ComputeHash().Should().NotBe(before);
            UilmManifest.FromRows([Live("a", "en-US", 3)]).ComputeHash().Should().NotBe(before);
            UilmManifest.FromRows([Live("a", "en-US", 3), Live("b", "en-US", 3), Live("c", "en-US", 3)]).ComputeHash().Should().NotBe(before);
        }

        [Fact]
        public void Hash_Changes_WhenAPointerSwitchesToAByteIdenticalFileWithANewUrl_H6()
        {
            var before = UilmManifest.FromRows([Live("a", "en-US", 3), Live("b", "en-US", 3)]);
            var reuploaded = Live("a", "en-US", 3);
            reuploaded.FileId = "f-reuploaded";
            reuploaded.Url = "https://files.test/a.en-US.reuploaded.json";

            var after = UilmManifest.FromRows([reuploaded, Live("b", "en-US", 3)]);

            after.Files[0].Hash.Should().Be(before.Files[0].Hash, "the re-uploaded file has the same bytes");
            after.ComputeHash().Should().NotBe(before.ComputeHash(), "the pointer now names another URL");
        }

        [Fact]
        public void Hash_IsUnchanged_WhenTheManifestIsUnchanged()
        {
            UilmManifest.FromRows([Live("a", "en-US", 3), new UilmManifestRow { ModuleName = "b", Language = "en-US" }]).ComputeHash()
                .Should().Be(UilmManifest.FromRows([Live("a", "en-US", 3), new UilmManifestRow { ModuleName = "b", Language = "en-US" }]).ComputeHash());
        }

        // ---- Reader (H2, H5, C7, C10, D5) ----

        [Fact]
        public async Task Reader_ReturnsTheJsonBytes_WithTheQuotedManifestHashAsETag_H1()
        {
            Rows(Live("b", "en-US"), Live("a", "en-US"));

            var result = await _reader.GetManifestAsync(new GetUilmManifestRequest(), null);

            var expected = UilmManifest.FromRows([Live("a", "en-US"), Live("b", "en-US")]);
            result.Kind.Should().Be(UilmFileReadKind.File);
            result.Bytes.Should().Equal(expected.ToJsonBytes());
            result.ETag.Should().Be($"\"{expected.ComputeHash()}\"");
            Json(result).GetProperty("files")[0].GetProperty("moduleName").GetString().Should().Be("a");
        }

        [Theory]
        [InlineData(null, null, null, null)]
        [InlineData("", "", null, null)]
        [InlineData("app-login", null, "app-login", null)]
        [InlineData(null, "en-US", null, "en-US")]
        [InlineData("App-Login", "EN-us", "App-Login", "EN-us")]
        public async Task Reader_PassesTheExactFilters_AndTreatsEmptyAsNoFilter_H2(string? module, string? language, string? expectedModule, string? expectedLanguage)
        {
            _keys.Setup(k => k.GetUilmManifestRowsAsync(expectedModule, expectedLanguage)).ReturnsAsync([]);

            var result = await _reader.GetManifestAsync(new GetUilmManifestRequest { ModuleName = module, Language = language }, null);

            Json(result).GetProperty("files").GetArrayLength().Should().Be(0);
            _keys.Verify(k => k.GetUilmManifestRowsAsync(expectedModule, expectedLanguage), Times.Once);
        }

        [Theory]
        [InlineData("\"{0}\"")]
        [InlineData("W/\"{0}\"")]
        [InlineData("\"other\", W/\"{0}\"")]
        [InlineData("*")]
        public async Task Reader_MatchingIfNoneMatch_IsNotModified_WithTheSameETag_H5_C7(string header)
        {
            Rows(Live("a", "en-US"));
            var hash = UilmManifest.FromRows([Live("a", "en-US")]).ComputeHash();

            var result = await _reader.GetManifestAsync(new GetUilmManifestRequest(), string.Format(header, hash));

            result.Should().Be(new UilmFileReadResult(UilmFileReadKind.NotModified, ETag: $"\"{hash}\""));
        }

        [Theory]
        [InlineData("\"other\"")]
        [InlineData("")]
        [InlineData("W/\"\"")]
        public async Task Reader_NonMatchingIfNoneMatch_ReturnsTheManifest(string header)
        {
            Rows(Live("a", "en-US"));

            (await _reader.GetManifestAsync(new GetUilmManifestRequest(), header)).Kind.Should().Be(UilmFileReadKind.File);
        }

        [Fact]
        public async Task Reader_EmptyManifest_HasItsOwnETag_AndCanBeNotModified_H8()
        {
            Rows();
            var etag = $"\"{Sha256("")}\"";

            (await _reader.GetManifestAsync(new GetUilmManifestRequest(), null)).ETag.Should().Be(etag);
            (await _reader.GetManifestAsync(new GetUilmManifestRequest(), etag)).Kind.Should().Be(UilmFileReadKind.NotModified);
        }

        [Fact]
        public async Task Reader_NeverCallsStorageOrTheLedgerRepository_C10()
        {
            Rows(Live("a", "en-US"), new UilmManifestRow { ModuleName = "b", Language = "en-US", FileId = "f", Url = "u", ContentHash = "h" });

            var result = await _reader.GetManifestAsync(new GetUilmManifestRequest(), null);

            result.Kind.Should().Be(UilmFileReadKind.File);
            _http.Requests.Should().BeEmpty();
            _ledger.VerifyNoOtherCalls();
            _keys.Verify(k => k.GetUilmManifestRowsAsync(null, null), Times.Once);
            _keys.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Reader_RepositoryFailure_Propagates_WithoutAPartialManifest_C4()
        {
            _keys.Setup(k => k.GetUilmManifestRowsAsync(It.IsAny<string?>(), It.IsAny<string?>()))
                .ThrowsAsync(new TimeoutException("MongoDB unavailable"));

            await _reader.Invoking(r => r.GetManifestAsync(new GetUilmManifestRequest(), null))
                .Should().ThrowAsync<TimeoutException>();
        }
    }
}
