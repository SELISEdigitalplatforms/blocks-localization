using Blocks.Genesis;
using BlocksTemplate.DomainService.Shared.Entities;
using Microsoft.Extensions.Logging;
using Polly.CircuitBreaker;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace BlocksTemplate.DomainService.Services.HelperService
{
    public class HttpHelperServices : IHttpHelperServices
    {
        private readonly IHttpService _httpService;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<HttpHelperServices> _logger;
        private readonly HttpClient _httpClient;

        public HttpHelperServices(IHttpService httpService, IHttpClientFactory httpClientFactory, ILogger<HttpHelperServices> logger, HttpClient httpClient)
        {
            _httpService = httpService;
            _httpClientFactory = httpClientFactory;
            _httpClient = httpClient;
            _logger = logger;
        }

        public async Task<(T?, string)> MakeHttpGetRequest<T>(string url, string token = null, Dictionary<string, string> headers = null) where T : class
        {
            try
            {
                Console.WriteLine($"Making GET request to: {url}");
                var (data, rawResponse) = await _httpService.Get<T>(url, headers);
                return (data, rawResponse);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error making GET request to: {url}, Exception: {ex.Message}");
                return (null, "Operation Failed.");
            }
        }

        public async Task<(T?, string)> MakeHttpPostRequest<T>(object payload, string url, Dictionary<string, string> headers = null, string token = null, string contentType = "application/json") where T : class
        {
            try
            {
                var (data, rawResponse) = await _httpService.Post<T>(payload, url, contentType, headers);

                return (data, rawResponse);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error making POST request to: {url}");
                return (null, "Operation Failed.");
            }
        }

        public async Task<(T?, string)> MakeHttpRequest<T>(string clientName, string url, HttpMethod method, object? payload = null, Dictionary<string, string>? headers = null, string? token = null) where T : class
        {
            try
            {
                Console.WriteLine($"Making {method.Method} request to: {url}");

                var client = _httpClientFactory.CreateClient(clientName);

                // Add Authorization header if token is provided
                if (!string.IsNullOrEmpty(token))
                {
                    client.DefaultRequestHeaders.Authorization =
                        new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
                }

                // Add any additional headers
                if (headers != null)
                {
                    foreach (var header in headers)
                    {
                        client.DefaultRequestHeaders.TryAddWithoutValidation(header.Key, header.Value);
                    }
                }

                HttpRequestMessage request = new HttpRequestMessage(method, url);

                // Add payload if method is POST or PUT
                if ((method == HttpMethod.Post || method == HttpMethod.Put) && payload != null)
                {
                    string jsonPayload = JsonSerializer.Serialize(payload);
                    request.Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
                }

                var response = await client.SendAsync(request);

                var contentString = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"Request failed with status code: {response.StatusCode}, Body: {contentString}");
                    return (null, "Operation Failed.");
                }

                var deserialized = JsonSerializer.Deserialize<T>(contentString);
                return (deserialized, "Success");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error making {method.Method} request to: {url}, Exception: {ex.Message}");
                return (null, "Operation Failed.");
            }
        }

        public async Task<bool> MakeHttpRequestForWebhook(object payload, BlocksWebhook webhook)
        {
            using (var request = new HttpRequestMessage(HttpMethod.Post, webhook.Url))
            {
                using (request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, webhook.ContentType))
                {
                    if (webhook.BlocksWebhookSecret != null)
                    {
                        request.Headers.Add(webhook.BlocksWebhookSecret.HeaderKey, webhook.BlocksWebhookSecret.Secret);
                    }

                    try
                    {
                        var response = await MakeRequestAsync(request);
                        if (response.IsSuccessStatusCode)
                        {
                            var result = response.Content.ReadAsStringAsync().Result;
                            _logger.LogInformation("Result:  {Result}", JsonSerializer.Serialize(result));
                            return true;
                        }
                        else
                        {
                            _logger.LogError("Error: {Response}", JsonSerializer.Serialize(response));
                            return false;
                        }
                    }
                    catch (Exception e)
                    {
                        _logger.LogError("Error: {Error}", JsonSerializer.Serialize(e));
                        return false;
                    }
                }
            }
        }

        public async Task<HttpResponseMessage> MakeRequestAsync(HttpRequestMessage httpRequestMessage)
        {
            var requestResponse = new HttpResponseMessage();

            try
            {
                _logger.LogInformation("Started processing the API request. MethodType: {MethodType}, BaseUrl: {BaseUrl}, ApiName: {ApiName}",
                    httpRequestMessage.Method, _httpClient.BaseAddress, httpRequestMessage.RequestUri);

                requestResponse = await _httpClient.SendAsync(httpRequestMessage);

                _logger.LogInformation("Completed processing the API request. MethodType: {MethodType}, BaseUrl: {BaseUrl}, ApiName: {ApiName}, SerializedResponse: {SerializedResponse}",
                    httpRequestMessage.Method, _httpClient.BaseAddress, httpRequestMessage.RequestUri, JsonSerializer.Serialize(requestResponse));
            }
            catch (BrokenCircuitException ex)
            {
                _logger.LogError(ex, "Circuit breaker Exception occurred while processing the API request. MethodType: {MethodType}, BaseUrl: {BaseUrl}, ApiName: {ApiName}, Reason: {Reason}",
                    httpRequestMessage.Method, _httpClient.BaseAddress, httpRequestMessage.RequestUri, ex.Message);
                throw;
            }

            return requestResponse;
        }
    }
}
