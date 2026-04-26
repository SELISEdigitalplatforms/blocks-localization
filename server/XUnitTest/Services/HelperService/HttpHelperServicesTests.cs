using Blocks.Genesis;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared.Entities;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using Xunit;

namespace XUnitTest
{
    public class HttpHelperServicesTests
    {
        private readonly Mock<IHttpService> _httpServiceMock;
        private readonly Mock<IHttpClientFactory> _httpClientFactoryMock;
        private readonly Mock<ILogger<HttpHelperServices>> _loggerMock;

        public HttpHelperServicesTests()
        {
            _httpServiceMock = new Mock<IHttpService>();
            _httpClientFactoryMock = new Mock<IHttpClientFactory>();
            _loggerMock = new Mock<ILogger<HttpHelperServices>>();
        }
        

        [Fact]
        public async Task MakeHttpGetRequest_ReturnsData()
        {
            var response = new SampleDto { Value = "ok" };

            // Use Returns with delegate to avoid expression tree limitations with optional parameters
            _httpServiceMock
                .Setup(x => x.Get<SampleDto>(It.IsAny<string>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<CancellationToken>()))
                .Returns(Task.FromResult((response, "raw")));

            var service = new HttpHelperServices(_httpServiceMock.Object, _httpClientFactoryMock.Object, _loggerMock.Object, new HttpClient(new PassThroughHandler()));

            var (data, raw) = await service.MakeHttpGetRequest<SampleDto>("http://test");

            data.Should().NotBeNull();
            data!.Value.Should().Be("ok");
            raw.Should().Be("raw");
        }

        [Fact]
        public async Task MakeHttpPostRequest_ReturnsData()
        {
            var response = new SampleDto { Value = "posted" };

            _httpServiceMock
                .Setup(x => x.Post<SampleDto>(It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>(), It.IsAny<CancellationToken>()))
                .Returns(Task.FromResult((response, "raw")));

            var service = new HttpHelperServices(_httpServiceMock.Object, _httpClientFactoryMock.Object, _loggerMock.Object, new HttpClient(new PassThroughHandler()));

            var (data, raw) = await service.MakeHttpPostRequest<SampleDto>(new { }, "http://post");

            data.Should().NotBeNull();
            data!.Value.Should().Be("posted");
            raw.Should().Be("raw");
        }

        [Fact]
        public async Task MakeHttpRequest_Success_ReturnsDeserializedObject()
        {
            var handler = new StubHttpMessageHandler(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.OK,
                Content = new StringContent(JsonSerializer.Serialize(new SampleDto { Value = "success" }))
            });
            var client = new HttpClient(handler);
            _httpClientFactoryMock.Setup(x => x.CreateClient("default")).Returns(client);

            var service = new HttpHelperServices(_httpServiceMock.Object, _httpClientFactoryMock.Object, _loggerMock.Object, new HttpClient(new PassThroughHandler()));

            var (data, status) = await service.MakeHttpRequest<SampleDto>("default", "http://example.com", HttpMethod.Get);

            data.Should().NotBeNull();
            data!.Value.Should().Be("success");
            status.Should().Be("Success");
        }

        [Fact]
        public async Task MakeHttpRequest_Failure_ReturnsOperationFailed()
        {
            var handler = new StubHttpMessageHandler(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.InternalServerError,
                Content = new StringContent("error")
            });
            var client = new HttpClient(handler);
            _httpClientFactoryMock.Setup(x => x.CreateClient("default")).Returns(client);

            var service = new HttpHelperServices(_httpServiceMock.Object, _httpClientFactoryMock.Object, _loggerMock.Object, new HttpClient(new PassThroughHandler()));

            var (data, status) = await service.MakeHttpRequest<SampleDto>("default", "http://example.com", HttpMethod.Get);

            data.Should().BeNull();
            status.Should().Be("Operation Failed.");
        }

        [Fact]
        public async Task MakeHttpRequest_AddsHeadersAndToken()
        {
            var handler = new CapturingHandler();
            var client = new HttpClient(handler);
            _httpClientFactoryMock.Setup(x => x.CreateClient("secure")).Returns(client);

            var service = new HttpHelperServices(_httpServiceMock.Object, _httpClientFactoryMock.Object, _loggerMock.Object, new HttpClient(new PassThroughHandler()));

            var headers = new Dictionary<string, string> { { "X-Test", "123" } };
            await service.MakeHttpRequest<SampleDto>("secure", "http://example.com", HttpMethod.Get, null, headers, "token");

            handler.Request.Should().NotBeNull();
            handler.Request!.Headers.Authorization.Should().NotBeNull();
            handler.Request!.Headers.GetValues("X-Test").First().Should().Be("123");
        }

        [Fact]
        public async Task MakeHttpRequestForWebhook_ReturnsFalseOnFailure()
        {
            var handler = new StubHttpMessageHandler(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.BadRequest
            });
            var httpClient = new HttpClient(handler);

            var service = new HttpHelperServices(_httpServiceMock.Object, _httpClientFactoryMock.Object, _loggerMock.Object, httpClient);

            var webhook = new BlocksWebhook
            {
                Url = "http://example.com/webhook",
                ContentType = "application/json",
                BlocksWebhookSecret = new BlocksWebhookSecret { HeaderKey = "X-Sig", Secret = "abc" },
                ProjectKey = "test-project"
            };

            var result = await service.MakeHttpRequestForWebhook(new { ok = true }, webhook);

            result.Should().BeFalse();
        }

        [Fact]
        public async Task MakeHttpRequestForWebhook_ReturnsTrueOnSuccess()
        {
            var handler = new StubHttpMessageHandler(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.OK,
                Content = new StringContent("{}")
            });
            var httpClient = new HttpClient(handler);

            var service = new HttpHelperServices(_httpServiceMock.Object, _httpClientFactoryMock.Object, _loggerMock.Object, httpClient);

            var webhook = new BlocksWebhook
            {
                Url = "http://example.com/webhook",
                ContentType = "application/json",
                BlocksWebhookSecret = new BlocksWebhookSecret { HeaderKey = "key", Secret = "secret" },
                ProjectKey = "test-project"
            };

            var result = await service.MakeHttpRequestForWebhook(new { ok = true }, webhook);

            result.Should().BeTrue();
        }

        [Fact]
        public async Task MakeRequestAsync_UsesInjectedHttpClient()
        {
            var handler = new StubHttpMessageHandler(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.OK,
                Content = new StringContent("ok")
            });

            var httpClient = new HttpClient(handler)
            {
                BaseAddress = new Uri("http://base")
            };

            var service = new HttpHelperServices(_httpServiceMock.Object, _httpClientFactoryMock.Object, _loggerMock.Object, httpClient);

            using var request = new HttpRequestMessage(HttpMethod.Get, "http://base/test");
            var response = await service.MakeRequestAsync(request);

            response.Should().NotBeNull();
            response.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        private class SampleDto
        {
            public string? Value { get; set; }
        }

        private class StubHttpMessageHandler : HttpMessageHandler
        {
            private readonly HttpResponseMessage _response;

            public StubHttpMessageHandler(HttpResponseMessage response)
            {
                _response = response;
            }

            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                return Task.FromResult(_response);
            }
        }

        private class PassThroughHandler : HttpMessageHandler
        {
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
            }
        }

        private class CapturingHandler : HttpMessageHandler
        {
            public HttpRequestMessage? Request { get; private set; }

            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                Request = request;
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("{}")
                });
            }
        }
    }
}

