using System.Collections.Concurrent;
using System.Net;
using Eurolm.DomainService.Services.UilmStorage;
using Moq;

namespace XUnitTest.Services.UilmStorage
{
    /// <summary>Answers every HTTP request through <see cref="Respond"/> and records what was sent.</summary>
    internal sealed class StubStorageHttp : HttpMessageHandler
    {
        public Func<HttpRequestMessage, Task<HttpResponseMessage>> Respond { get; set; } =
            _ => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));

        /// <summary>Waited before answering, observing the request's cancellation (for timeouts).</summary>
        public TimeSpan Delay { get; set; }

        public ConcurrentQueue<(HttpMethod Method, string Url, byte[]? Body, Dictionary<string, string> Headers)> Requests { get; } = new();

        public IEnumerable<string> Urls(HttpMethod method) => Requests.Where(r => r.Method == method).Select(r => r.Url);

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var body = request.Content == null ? null : await request.Content.ReadAsByteArrayAsync(cancellationToken);
            var headers = request.Headers.Concat(request.Content?.Headers ?? Enumerable.Empty<KeyValuePair<string, IEnumerable<string>>>())
                .ToDictionary(h => h.Key, h => string.Join(",", h.Value), StringComparer.OrdinalIgnoreCase);
            Requests.Enqueue((request.Method, request.RequestUri!.ToString(), body, headers));
            if (Delay > TimeSpan.Zero) await Task.Delay(Delay, cancellationToken);
            return await Respond(request);
        }

        public Mock<IHttpClientFactory> Factory()
        {
            var factory = new Mock<IHttpClientFactory>();
            factory.Setup(f => f.CreateClient(UilmStorageHttp.ClientName)).Returns(() => new HttpClient(this, disposeHandler: false));
            return factory;
        }

        public static HttpResponseMessage Ok(byte[]? body = null) =>
            new(HttpStatusCode.OK) { Content = body == null ? null : new ByteArrayContent(body) };
    }
}
