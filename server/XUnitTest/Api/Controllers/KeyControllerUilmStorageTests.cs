using Blocks.Genesis;
using BlocksTemplate.Api.Controllers;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.UilmStorage;
using Eurolm.DomainService.Validation;
using FluentAssertions;
using FluentValidation;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using System.Reflection;
using System.Text;

namespace XUnitTest.Api.Controllers
{
    /// <summary>The read endpoints' responses (spec 6.7), forceUpload and RunUilmMaintenance (6.6).</summary>
    public class KeyControllerUilmStorageTests
    {
        private readonly Mock<IKeyManagementService> _keyManagementService = new();
        private readonly Mock<IUilmFileReader> _reader = new();
        private readonly Mock<IUilmMaintenanceService> _maintenance = new();
        private readonly GetUilmFileRequest _request = new() { Language = "en-US", ModuleName = "app-login" };
        private readonly DefaultHttpContext _http = new();
        private readonly KeyController _controller;

        public KeyControllerUilmStorageTests()
        {
            _http.Response.Body = new MemoryStream();
            _controller = new KeyController(_keyManagementService.Object,
                Mock.Of<IValidator<TranslateBlocksLanguageKeyRequest>>(), Mock.Of<IValidator<TranslateBlocksLanguageKeysRequest>>(),
                new GetKeysRequestValidator(), new DeleteKeysRequestValidator(), _reader.Object, _maintenance.Object)
            {
                ControllerContext = new ControllerContext { HttpContext = _http }
            };
        }

        private string Body()
        {
            _http.Response.Body.Seek(0, SeekOrigin.Begin);
            return new StreamReader(_http.Response.Body).ReadToEnd();
        }

        private void Returns(UilmFileReadResult result) =>
            _reader.Setup(r => r.ReadAsync(_request, It.IsAny<string?>())).ReturnsAsync(result);

        [Fact]
        public async Task StorageFile_IsWrittenAsBytes_WithETagCacheControlAndLength_H2()
        {
            var bytes = Encoding.UTF8.GetBytes("{\"a\":\"Ä\"}");
            Returns(new UilmFileReadResult(UilmFileReadKind.File, Bytes: bytes, ETag: "\"abc\""));

            await _controller.GetUilmFile(_request);

            _http.Response.StatusCode.Should().Be(200);
            _http.Response.ContentType.Should().Be("application/json");
            _http.Response.Headers.ETag.ToString().Should().Be("\"abc\"");
            _http.Response.Headers.CacheControl.ToString().Should().Be("no-cache");
            _http.Response.ContentLength.Should().Be(bytes.Length);
            ((MemoryStream)_http.Response.Body).ToArray().Should().Equal(bytes);
        }

        [Fact]
        public async Task CloudEndpoint_UsesTheSameRules_AndPassesIfNoneMatch()
        {
            _http.Request.Headers.IfNoneMatch = "W/\"abc\"";
            _reader.Setup(r => r.ReadAsync(_request, "W/\"abc\"")).ReturnsAsync(new UilmFileReadResult(UilmFileReadKind.NotModified, ETag: "\"abc\""));

            await _controller.GetCloudUilmFile(_request);

            _http.Response.StatusCode.Should().Be(304);
            _http.Response.Headers.ETag.ToString().Should().Be("\"abc\"");
            _http.Response.Headers.CacheControl.ToString().Should().Be("no-cache");
            Body().Should().BeEmpty();
        }

        [Fact]
        public async Task Unavailable_Is503_WithRetryAfter_AndAnEmptyBody_C4()
        {
            Returns(UilmFileReadResult.Unavailable);

            await _controller.GetUilmFile(_request);

            _http.Response.StatusCode.Should().Be(503);
            _http.Response.Headers.RetryAfter.ToString().Should().Be("30");
            _http.Response.Headers.ETag.Should().BeEmpty();
            Body().Should().BeEmpty();
        }

        [Fact]
        public async Task ContentFallback_HasNoETag()
        {
            Returns(new UilmFileReadResult(UilmFileReadKind.Content, "{}"));

            await _controller.GetUilmFile(_request);

            _http.Response.StatusCode.Should().Be(200);
            _http.Response.Headers.ETag.Should().BeEmpty();
            Body().Should().Be("{}");
        }

        [Fact]
        public async Task NullRequest_IsBadRequest_WithoutReading()
        {
            await _controller.GetUilmFile(null!);

            _http.Response.StatusCode.Should().Be(400);
            _reader.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task GenerateUilmFile_PassesForceUpload_H6()
        {
            await _controller.GenerateUilmFile(new GenerateUilmRequest { Guid = "g", ModuleId = "m", ForceUpload = true });

            _keyManagementService.Verify(s => s.SendGenerateUilmFilesEvent(It.Is<GenerateUilmFilesRequest>(r =>
                r.Guid == "g" && r.ModuleId == "m" && r.ForceUpload)), Times.Once);
        }

        [Fact]
        public void GenerateUilmRequest_WithoutForceUpload_DefaultsToFalse()
        {
            System.Text.Json.JsonSerializer.Deserialize<GenerateUilmRequest>("{\"guid\":\"g\"}",
                new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web))!.ForceUpload.Should().BeFalse();
        }

        [Fact]
        public async Task RunUilmMaintenance_QueuesARunForTheCallersTenant_AndReturnsSuccess_H14()
        {
            var result = await _controller.RunUilmMaintenance();

            result.Should().BeOfType<OkObjectResult>().Which.Value.Should().BeOfType<BaseMutationResponse>().Which.IsSuccess.Should().BeTrue();
            _maintenance.Verify(m => m.QueueForCurrentTenantAsync(), Times.Once);
        }

        [Fact]
        public void RunUilmMaintenance_IsAProtectedPostWithItsOwnPermission_C17()
        {
            var method = typeof(KeyController).GetMethod(nameof(KeyController.RunUilmMaintenance))!;

            method.GetCustomAttribute<HttpPostAttribute>().Should().NotBeNull();
            method.GetCustomAttribute<ProtectedEndPointAttribute>().Should().NotBeNull();
            method.GetCustomAttributesData().Single(a => a.AttributeType == typeof(ProtectedEndPointAttribute))
                .ConstructorArguments.Single().Value.Should().Be("blocks-localization::key::runuilmmaintenance");
            method.GetParameters().Should().BeEmpty("the endpoint takes no body; the tenant comes from the caller");
        }

        [Fact]
        public void PermissionSeed_ContainsTheMaintenanceEndpoint()
        {
            var directory = new DirectoryInfo(AppContext.BaseDirectory);
            while (directory != null && !File.Exists(Path.Combine(directory.FullName, "seed", "localization-permissions.upsert.json")))
                directory = directory.Parent;
            var path = Path.Combine(directory!.FullName, "seed", "localization-permissions.upsert.json");
            using var document = System.Text.Json.JsonDocument.Parse(File.ReadAllText(path));

            var entry = document.RootElement.EnumerateArray()
                .Single(e => e.GetProperty("Resource").GetString() == "blocks-localization::key::runuilmmaintenance");
            entry.GetProperty("Type").GetString().Should().Be("Endpoint");
            entry.GetProperty("ResourceGroup").GetString().Should().Be("localization");
            entry.GetProperty("PermissionSeverity").GetString().Should().Be("Medium");
            entry.GetProperty("IsBuiltIn").GetBoolean().Should().BeTrue();
        }
    }
}
