using System.Net;
using System.Text;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Repositories.UilmStorage;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.UilmStorage;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using XUnitTest.Shared;

namespace XUnitTest.Services.UilmStorage
{
    /// <summary>GetUilmFile response rules (spec 6.7).</summary>
    public class UilmFileReaderTests
    {
        private const string Json = "{\"a\":\"A\"}";
        private static readonly byte[] Bytes = Encoding.UTF8.GetBytes(Json);
        private static readonly string HashOfJson = UilmFilePublisher.Hash(Bytes);

        private readonly Mock<IKeyRepository> _keys = new();
        private readonly Mock<IUilmStoredFileRepository> _ledger = new();
        private readonly Mock<ILogger<UilmFileReader>> _logger = new();
        private readonly StubStorageHttp _http = new();
        private readonly GetUilmFileRequest _request = new() { Language = "en-US", ModuleName = "app-login" };
        private UilmFileReader _reader;

        public UilmFileReaderTests()
        {
            TestBlocksContext.Set("tenant-a");
            _ledger.Setup(l => l.ExistsAsync(It.IsAny<string>())).ReturnsAsync(true);
            _http.Respond = _ => Task.FromResult(StubStorageHttp.Ok(Bytes));
            _reader = Reader(new UilmStorageOptions());
        }

        private UilmFileReader Reader(UilmStorageOptions options) =>
            new(_keys.Object, _ledger.Object, new UilmStorageInfrastructure(options, _http.Factory().Object, TimeProvider.System), _logger.Object);

        private UilmFile Row(string? content = Json, string fileId = "file-1", string? hash = null)
        {
            var row = new UilmFile
            {
                Id = "app-login|en-US", ModuleName = "app-login", Language = "en-US", Content = content!,
                FileId = fileId, Url = "https://files.test/" + fileId, ContentHash = hash ?? HashOfJson, Version = 3
            };
            _keys.Setup(k => k.GetUilmFile(_request)).ReturnsAsync(row);
            return row;
        }

        [Fact]
        public async Task NoRow_IsAnEmptyOk_C2_E6()
        {
            (await _reader.ReadAsync(_request, null)).Should().Be(UilmFileReadResult.NoFile);
        }

        [Theory]
        [InlineData(Json, Json)]
        [InlineData(null, "")]
        public async Task RowWithoutFileId_ServesItsContent_WithoutETag(string? content, string expected)
        {
            _keys.Setup(k => k.GetUilmFile(_request)).ReturnsAsync(new UilmFile { ModuleName = "app-login", Language = "en-US", Content = content! });

            var result = await _reader.ReadAsync(_request, "*");

            result.Should().Be(new UilmFileReadResult(UilmFileReadKind.Content, expected));
            _http.Requests.Should().BeEmpty();
        }

        [Fact]
        public async Task RowWithFileId_ServesTheVerifiedStorageBytes_WithTheQuotedHashAsETag_H2_E2()
        {
            Row();

            var result = await _reader.ReadAsync(_request, null);

            result.Kind.Should().Be(UilmFileReadKind.File);
            result.Bytes.Should().Equal(Bytes);
            result.ETag.Should().Be($"\"{HashOfJson}\"");
            _http.Urls(HttpMethod.Get).Should().Equal("https://files.test/file-1");
        }

        [Fact]
        public async Task SecondRequest_IsServedFromTheCache_WithoutStorageOrLedgerReads()
        {
            Row();
            await _reader.ReadAsync(_request, null);

            var second = await _reader.ReadAsync(_request, null);

            second.Bytes.Should().Equal(Bytes);
            _http.Requests.Should().ContainSingle();
            _ledger.Verify(l => l.ExistsAsync("file-1"), Times.Once);
        }

        [Fact]
        public async Task CacheEntries_AreKeyedByTenant_C11()
        {
            Row();
            await _reader.ReadAsync(_request, null);

            TestBlocksContext.Set("tenant-b");
            await _reader.ReadAsync(_request, null);

            _http.Requests.Should().HaveCount(2, "tenant B never gets tenant A's cache entry");
            UilmFileReader.CacheKey("tenant-a", "file-1").Should().Be("uilm:tenant-a:file-1");
        }

        [Fact]
        public async Task PointerSwitch_ServesTheNewFileOnTheNextRequest_H4()
        {
            Row();
            await _reader.ReadAsync(_request, null);
            var changed = Encoding.UTF8.GetBytes("{\"a\":\"B\"}");
            Row(content: "{\"a\":\"B\"}", fileId: "file-2", hash: UilmFilePublisher.Hash(changed));
            _http.Respond = _ => Task.FromResult(StubStorageHttp.Ok(changed));

            (await _reader.ReadAsync(_request, null)).Bytes.Should().Equal(changed);
        }

        [Theory]
        [InlineData("\"{0}\"")]
        [InlineData("W/\"{0}\"")]
        [InlineData("*")]
        [InlineData("\"other\", W/\"{0}\"")]
        public async Task MatchingIfNoneMatch_IsNotModified_WithoutFetchingTheFile_H3(string header)
        {
            Row();

            var result = await _reader.ReadAsync(_request, string.Format(header, HashOfJson));

            result.Should().Be(new UilmFileReadResult(UilmFileReadKind.NotModified, ETag: $"\"{HashOfJson}\""));
            _http.Requests.Should().BeEmpty();
        }

        [Theory]
        [InlineData(null, false)]
        [InlineData("", false)]
        [InlineData("\"other\"", false)]
        [InlineData("\"abc\"", true)]
        [InlineData("abc", true)]
        [InlineData(" W/\"abc\" ", true)]
        [InlineData("\"x\",*", true)]
        public void IfNoneMatchParsing(string? header, bool matches)
        {
            UilmFileReader.IfNoneMatchMatches(header, "abc").Should().Be(matches);
        }

        [Fact]
        public async Task NonMatchingIfNoneMatch_ServesTheFile()
        {
            Row();

            (await _reader.ReadAsync(_request, "\"stale\"")).Kind.Should().Be(UilmFileReadKind.File);
        }

        [Fact]
        public async Task StorageFailure_FallsBackToContent_WithoutETag_AndLogsWithoutTheContent_C3_E7()
        {
            Row();
            _http.Respond = _ => throw new HttpRequestException("down");

            var result = await _reader.ReadAsync(_request, null);

            result.Should().Be(new UilmFileReadResult(UilmFileReadKind.Content, Json));
            var warning = _logger.LoggedMessages().Should().ContainSingle(m => m.StartsWith("UilmStorageReadFallback")).Subject;
            warning.Should().NotContain(Json).And.NotContain("https://");
        }

        [Fact]
        public async Task StorageErrorStatus_FallsBackToContent()
        {
            Row();
            _http.Respond = _ => Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));

            (await _reader.ReadAsync(_request, null)).Kind.Should().Be(UilmFileReadKind.Content);
            _logger.LoggedMessages().Should().Contain(m => m.Contains("HTTP 404"));
        }

        [Fact]
        public async Task StorageTimeout_FallsBackToContent_C3()
        {
            _reader = Reader(new UilmStorageOptions { StorageFetchTimeout = TimeSpan.FromMilliseconds(50) });
            Row();
            _http.Delay = TimeSpan.FromSeconds(30);

            (await _reader.ReadAsync(_request, null)).Kind.Should().Be(UilmFileReadKind.Content);
            _logger.LoggedMessages().Should().Contain(m => m.Contains("timeout"));
        }

        [Fact]
        public async Task TamperedBytes_AreNeitherServedNorCached_C14()
        {
            Row();
            _http.Respond = _ => Task.FromResult(StubStorageHttp.Ok(Encoding.UTF8.GetBytes("{\"a\":\"evil\"}")));

            (await _reader.ReadAsync(_request, null)).Should().Be(new UilmFileReadResult(UilmFileReadKind.Content, Json));
            (await _reader.ReadAsync(_request, null)).Kind.Should().Be(UilmFileReadKind.Content);
            _http.Requests.Should().HaveCount(2, "nothing was cached");
            _logger.LoggedMessages().Should().Contain(m => m.Contains("content hash mismatch"));
        }

        [Fact]
        public async Task StorageFailure_WithoutContent_IsUnavailable_NeverAnEmptyOk_C4()
        {
            Row(content: null);
            _http.Respond = _ => throw new HttpRequestException("down");

            (await _reader.ReadAsync(_request, null)).Should().Be(UilmFileReadResult.Unavailable);
            _logger.LoggedMessages().Should().Contain(m => m.Contains("can't be served"));
        }

        [Fact]
        public async Task ForeignPointer_IsServedFromContent_WithoutFetchingItsUrl_C19()
        {
            Row();
            _ledger.Setup(l => l.ExistsAsync("file-1")).ReturnsAsync(false);

            var result = await _reader.ReadAsync(_request, "*");

            result.Should().Be(new UilmFileReadResult(UilmFileReadKind.Content, Json));
            _http.Requests.Should().BeEmpty();
            _logger.LoggedMessages().Should().Contain(m => m.StartsWith("UilmForeignPointer"));
        }

        [Fact]
        public async Task ForeignPointer_WithoutContent_IsUnavailable()
        {
            Row(content: null);
            _ledger.Setup(l => l.ExistsAsync("file-1")).ReturnsAsync(false);

            (await _reader.ReadAsync(_request, null)).Should().Be(UilmFileReadResult.Unavailable);
        }

        [Fact]
        public async Task CacheLimit_KeepsAFileLargerThanTheLimitOutOfTheCache_P3()
        {
            _reader = Reader(new UilmStorageOptions { CacheSizeLimitBytes = 4 });
            Row();

            await _reader.ReadAsync(_request, null);
            await _reader.ReadAsync(_request, null);

            _http.Requests.Should().HaveCount(2);
        }
    }
}
