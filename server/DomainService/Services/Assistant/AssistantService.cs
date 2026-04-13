using BlocksTemplate.DomainService.Shared.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Polly.CircuitBreaker;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;

namespace BlocksTemplate.DomainService.Services
{
    public class AssistantService : IAssistantService
    {
        private readonly ILogger<AssistantService> _logger;
        private readonly IConfiguration _configuration;
        private readonly string _aiCompletionUrl;
        private readonly string _chatGptTemperature;
        private readonly HttpClient _httpClient;
        private readonly ILocalizationSecret _localizationSecret;
        public AssistantService(
            ILogger<AssistantService> logger,
            IConfiguration configuration,
            HttpClient httpClient,
            ILocalizationSecret localizationSecret
        )
        {
            _localizationSecret = localizationSecret;
            _logger = logger;
            _configuration = configuration;
            _aiCompletionUrl = _configuration["AiCompletionUrl"];
            _chatGptTemperature = _configuration["ChatGptTemperature"];
            _httpClient = httpClient;
        }


        public async Task<string> SuggestTranslation(SuggestLanguageRequest query)
        {
            var context = GenerateSuggestTranslationContext(query);

            var aiCompletionRequest = new AiCompletionRequest(context, query.Temperature);

            var aiText = await AiCompletion(aiCompletionRequest);

            var maxRetryCount = 3;
            var retryCount = 0;

            while (string.IsNullOrEmpty(aiText) && retryCount < maxRetryCount)
            {
                await Task.Delay(5000);

                aiText = await AiCompletion(aiCompletionRequest);
                retryCount++;
            }
            if (retryCount >= maxRetryCount)
            {
                _logger.LogError("SuggestTranslation -> CallAiCompletion: Maximum Retry count reached");
                return null;
            }

            var output = FormatAiTextForSuggestTranslation(aiText);
            return output;
        }

        public string GenerateSuggestTranslationContext(SuggestLanguageRequest request)
        {
            var context = !string.IsNullOrWhiteSpace(request.ElementDetailContext) ? request.ElementDetailContext :
                $"The requirement is to translate a user interface element of a webpage. Output only the translated text (no quotes, no explanation).";
            context += $"Translate the following from {request.CurrentLanguage} to {request.DestinationLanguage}: '{request.SourceText}'";
            return context;
        }

        public string FormatAiTextForSuggestTranslation(string aiText)
        {
            if (string.IsNullOrWhiteSpace(aiText))
            {
                return string.Empty;
            }

            string output = null;

            var trimmedAiText = aiText?.Replace("\"", "").Replace("'", "");
            if (!string.IsNullOrEmpty(trimmedAiText) && trimmedAiText.Contains(":"))
            {
                string[] parts = trimmedAiText.Split(':');
                output = parts.Length > 1 ? parts[1] : trimmedAiText;
            }
            else
            {
                output = trimmedAiText;
            }

            char[] charsToTrim = { ' ', '\t', '\n' };
            string trimmedOutput = output?.Trim(charsToTrim) ?? string.Empty;

            return trimmedOutput;
        }

        public async Task<string> AiCompletion(AiCompletionRequest request)
        {
            try
            {
                double.TryParse(_chatGptTemperature, out var temperature);
                TemperatureValidator(temperature);

                var encryptedSecret = await GetEncryptedSecret();
                if (string.IsNullOrEmpty(encryptedSecret))
                {
                    throw new ArgumentException("Get null value from MicroserviceConfig");
                }

                var secret = GetDecryptedSecret(encryptedSecret);

                var model = new AiCompletionModel();
                var payload = model.ConstructCommand(request.Message, request.Temperature);

                var httpRequest = PrepareHttpRequest(_aiCompletionUrl, HttpMethod.Post, JsonConvert.SerializeObject(payload));
                var httpResponse = await MakeRequestAsync(httpRequest, secret);

                if (httpResponse != null && httpResponse.HttpStatusCode == HttpStatusCode.OK)
                {
                    ChatGptAiCompletionRequestResponse respone = JsonConvert.DeserializeObject<ChatGptAiCompletionRequestResponse>(httpResponse.ResponseData);
                    var responeMessage = respone.choices?.FirstOrDefault()?.message?.content;
                    return responeMessage;
                }

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "AiCompletionCommandHandler: Exception occurred");
            }

            return null;
        }

        private async Task<string> GetEncryptedSecret()
        {
            return _localizationSecret.ChatGptEncryptedSecret;
        }
 
        private string GetDecryptedSecret(string encryptedText)
        {
            var key = _localizationSecret.ChatGptEncryptionKey;
            var salt = GetSalt();
            
            if (salt is null)
            {
                throw new ArgumentException("Salt is null");
            }

            var decryptedValue = Decrypt(encryptedText, key, salt);
            return decryptedValue;
        }

        public byte[] GetSalt() =>
            _configuration.GetSection("Salt").Get<byte[]>();

        private static void TemperatureValidator(double temperature)
        {
            if (temperature < 0 || temperature > 1)
            {
                throw new ArgumentException("Invalid Temperature Value");
            }
        }

        public static string Decrypt(string encryptedText, string key, byte[] salt)
        {
            var cipherText = Convert.FromBase64String(encryptedText);

            using (var aesAlg = Aes.Create())
            {
                var keyDerivationFunction = new Rfc2898DeriveBytes(key, salt);
                aesAlg.Key = keyDerivationFunction.GetBytes(aesAlg.KeySize / 8);
                aesAlg.IV = keyDerivationFunction.GetBytes(aesAlg.BlockSize / 8);

                var decryptor = aesAlg.CreateDecryptor(aesAlg.Key, aesAlg.IV);

                string decryptedText;
                using (var msDecrypt = new System.IO.MemoryStream(cipherText))
                {
                    using (var csDecrypt = new CryptoStream(msDecrypt, decryptor, CryptoStreamMode.Read))
                    {
                        using (var srDecrypt = new System.IO.StreamReader(csDecrypt))
                        {
                            decryptedText = srDecrypt.ReadToEnd();
                        }
                    }
                }

                return decryptedText;
            }
        }

        public static HttpRequestMessage PrepareHttpRequest(string requestUrl, HttpMethod httpRequestType, object content = null)
        {
            var httpRequestMessage = new HttpRequestMessage
            {
                Method = httpRequestType,
                RequestUri = new Uri(requestUrl)
            };

            if (content != null)
            {
                var jsonContent = new StringContent((string)content, Encoding.UTF8, "application/json");

                httpRequestMessage.Content = jsonContent;
            }

            return httpRequestMessage;
        }

        public async Task<RestResponse> MakeRequestAsync(HttpRequestMessage httpRequestMessage, string secret)
        {
            var response = new RestResponse();
            var requestResponse = new HttpResponseMessage();

            try
            {
                _logger.LogInformation("Started processing the API request. MethodType: {MethodType}, BaseUrl: {BaseUrl}, ApiName: {ApiName}",
                    httpRequestMessage.Method, _httpClient.BaseAddress, httpRequestMessage.RequestUri);

                _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", secret);

                requestResponse = await _httpClient.SendAsync(httpRequestMessage);

                response.HttpStatusCode = requestResponse.StatusCode;
                response.ResponseData = await requestResponse.Content.ReadAsStringAsync();

                _logger.LogInformation("Completed processing the API request. MethodType: {MethodType}, BaseUrl: {BaseUrl}, ApiName: {ApiName}, SerializedResponse: {SerializedResponse}",
                    httpRequestMessage.Method, _httpClient.BaseAddress, httpRequestMessage.RequestUri, JsonConvert.SerializeObject(response));
            }
            catch (BrokenCircuitException ex)
            {
                _logger.LogError(ex, "Circuit breaker Exception occurred while processing the API request. MethodType: {MethodType}, BaseUrl: {BaseUrl}, ApiName: {ApiName}, Reason: {Reason}",
                    httpRequestMessage.Method, _httpClient.BaseAddress, httpRequestMessage.RequestUri, ex.Message);
                throw;
            }

            return response;
        }
    }
}
