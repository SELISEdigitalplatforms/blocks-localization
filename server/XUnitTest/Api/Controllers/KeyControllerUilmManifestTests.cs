using System.Reflection;
using System.Text;
using Blocks.Genesis;
using BlocksTemplate.Api.Controllers;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.UilmStorage;
using Eurolm.DomainService.Validation;
using FluentAssertions;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace XUnitTest.Api.Controllers
{
    /// <summary>GetUilmManifest's HTTP response (spec 4, section 6).</summary>
    public class KeyControllerUilmManifestTests
    {
        private readonly Mock<IUilmFileReader> _reader = new();
        private readonly DefaultHttpContext _http = new();
        private readonly KeyController _controller;

        public KeyControllerUilmManifestTests()
        {
            _http.Response.Body = new MemoryStream();
            _controller = new KeyController(Mock.Of<IKeyManagementService>(),
                Mock.Of<IValidator<TranslateBlocksLanguageKeyRequest>>(), Mock.Of<IValidator<TranslateBlocksLanguageKeysRequest>>(),
                new GetKeysRequestValidator(), new DeleteKeysRequestValidator())
            {
                ControllerContext = new ControllerContext { HttpContext = _http }
            };
        }

        private byte[] Body() => ((MemoryStream)_http.Response.Body).ToArray();

        [Fact]
        public async Task Manifest_IsWrittenAsJsonBytes_WithETagNoCacheAndLength_H1_H9()
        {
            var bytes = Encoding.UTF8.GetBytes("{\"version\":0,\"files\":[]}");
            var request = new GetUilmManifestRequest { Language = "en-US" };
            _reader.Setup(r => r.GetManifestAsync(request, "")).ReturnsAsync(new UilmFileReadResult(UilmFileReadKind.File, Bytes: bytes, ETag: "\"m1\""));

            await _controller.GetUilmManifest(request, _reader.Object);

            _http.Response.StatusCode.Should().Be(200);
            _http.Response.ContentType.Should().Be("application/json");
            _http.Response.Headers.ETag.ToString().Should().Be("\"m1\"");
            _http.Response.Headers.CacheControl.ToString().Should().Be("no-cache");
            _http.Response.ContentLength.Should().Be(bytes.Length);
            Body().Should().Equal(bytes);
        }

        [Fact]
        public async Task NotModified_Is304_WithAnEmptyBody_AndTheSameHeaders_H5_P2()
        {
            _http.Request.Headers.IfNoneMatch = "W/\"m1\", \"m0\"";
            _reader.Setup(r => r.GetManifestAsync(It.IsAny<GetUilmManifestRequest>(), "W/\"m1\", \"m0\""))
                .ReturnsAsync(new UilmFileReadResult(UilmFileReadKind.NotModified, ETag: "\"m1\""));

            await _controller.GetUilmManifest(new GetUilmManifestRequest(), _reader.Object);

            _http.Response.StatusCode.Should().Be(304);
            _http.Response.Headers.ETag.ToString().Should().Be("\"m1\"");
            _http.Response.Headers.CacheControl.ToString().Should().Be("no-cache");
            Body().Should().BeEmpty();
        }

        [Fact]
        public async Task NullRequest_MeansNoFilters()
        {
            _reader.Setup(r => r.GetManifestAsync(It.IsAny<GetUilmManifestRequest>(), It.IsAny<string?>()))
                .ReturnsAsync(new UilmFileReadResult(UilmFileReadKind.File, Bytes: [], ETag: "\"e\""));

            await _controller.GetUilmManifest(null!, _reader.Object);

            _reader.Verify(r => r.GetManifestAsync(It.Is<GetUilmManifestRequest>(q => q.ModuleName == null && q.Language == null), ""), Times.Once);
        }

        [Fact]
        public async Task ReaderFailure_Propagates_BeforeAnythingIsWritten_C4()
        {
            _reader.Setup(r => r.GetManifestAsync(It.IsAny<GetUilmManifestRequest>(), It.IsAny<string?>()))
                .ThrowsAsync(new TimeoutException("MongoDB unavailable"));

            await _controller.Invoking(c => c.GetUilmManifest(new GetUilmManifestRequest(), _reader.Object))
                .Should().ThrowAsync<TimeoutException>();

            _http.Response.StatusCode.Should().Be(200, "the pipeline turns the exception into a 500; nothing was set");
            _http.Response.Headers.ETag.Should().BeEmpty();
            Body().Should().BeEmpty();
        }

        [Fact]
        public void Manifest_IsAnAnonymousGet_LikeGetUilmFile_C3()
        {
            var manifest = typeof(KeyController).GetMethod(nameof(KeyController.GetUilmManifest))!;
            var file = typeof(KeyController).GetMethod(nameof(KeyController.GetUilmFile))!;

            manifest.GetCustomAttribute<HttpGetAttribute>().Should().NotBeNull();
            foreach (var method in new[] { manifest, file })
            {
                method.GetCustomAttribute<AuthorizeAttribute>().Should().BeNull();
                method.GetCustomAttribute<ProtectedEndPointAttribute>().Should().BeNull();
            }
            manifest.GetParameters()[0].GetCustomAttribute<FromQueryAttribute>().Should().NotBeNull();
            manifest.GetParameters()[1].GetCustomAttribute<FromServicesAttribute>().Should().NotBeNull();
        }

        [Fact]
        public async Task GetUilmFile_IsUnchanged_ByTheSharedResponseWriter_H10()
        {
            var request = new GetUilmFileRequest { Language = "en-US", ModuleName = "app-login" };
            _reader.Setup(r => r.ReadAsync(request, "")).ReturnsAsync(new UilmFileReadResult(UilmFileReadKind.Content, "{\"k\":1}"));

            await _controller.GetUilmFile(request, _reader.Object);

            _http.Response.StatusCode.Should().Be(200);
            _http.Response.ContentType.Should().Be("application/json");
            _http.Response.Headers.ETag.Should().BeEmpty();
            Encoding.UTF8.GetString(Body()).Should().Be("{\"k\":1}");
            _reader.Verify(r => r.GetManifestAsync(It.IsAny<GetUilmManifestRequest>(), It.IsAny<string?>()), Times.Never);
        }
    }
}
