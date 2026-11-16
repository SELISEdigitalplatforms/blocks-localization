namespace Eurolm.DomainService.Services.UilmStorage
{
    /// <summary>What the UILM Storage services share besides data access: the limits, HTTP clients and the clock.</summary>
    public sealed class UilmStorageInfrastructure
    {
        public UilmStorageInfrastructure(UilmStorageOptions options, IHttpClientFactory httpClientFactory, TimeProvider timeProvider)
        {
            Options = options;
            HttpClientFactory = httpClientFactory;
            TimeProvider = timeProvider;
        }

        public UilmStorageOptions Options { get; }
        public IHttpClientFactory HttpClientFactory { get; }
        public TimeProvider TimeProvider { get; }

        public HttpClient CreateHttpClient() => HttpClientFactory.CreateClient(UilmStorageHttp.ClientName);

        public DateTime UtcNow() => TimeProvider.GetUtcNow().UtcDateTime;
    }
}
