using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Shared.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Polly.CircuitBreaker;
using System.Net;
using System.Security.Cryptography;
using System.Text;

namespace Eurolm.DomainService.Services
{
    public class AssistantService : IAssistantService
    {
        private readonly ILogger<AssistantService> _logger;
        private readonly IConfiguration _configuration;
        private readonly string _chatGptTemperature;
        private readonly HttpClient _httpClient;
        private readonly ILocalizationSecret _localizationSecret;
        private readonly IGlossaryRepository _glossaryRepository;
        public AssistantService(
            ILogger<AssistantService> logger,
            IConfiguration configuration,
            HttpClient httpClient,
            ILocalizationSecret localizationSecret,
            IGlossaryRepository glossaryRepository
        )
        {
            _localizationSecret = localizationSecret;
            _logger = logger;
            _configuration = configuration;
            _chatGptTemperature = _configuration["ChatGptTemperature"];
            _httpClient = httpClient;
            _glossaryRepository = glossaryRepository;
        }


        public async Task<string> SuggestTranslation(SuggestLanguageRequest query)
        {
            var projectKey =  BlocksContext.GetContext()?.TenantId ?? "";

            // Tier 1: global glossaries
            var globalGlossaries = await _glossaryRepository.GetGlobalAsync(projectKey);

            // Tier 2: module-specific glossaries
            var moduleGlossaries = !string.IsNullOrWhiteSpace(query.ModuleId)
                ? await _glossaryRepository.GetByModuleIdAsync(projectKey, query.ModuleId)
                : new List<Glossary>();

            // Tier 3: key-specific glossaries
            var keyGlossaries = query.GlossaryIds != null && query.GlossaryIds.Any()
                ? await _glossaryRepository.GetByIdsAsync(query.GlossaryIds)
                : new List<Glossary>();

            // Merge and deduplicate by ItemId
            var allGlossaries = globalGlossaries
                .Concat(moduleGlossaries)
                .Concat(keyGlossaries)
                .GroupBy(g => g.ItemId)
                .Select(g => g.First())
                .ToList();

            string glossaryContext = allGlossaries.Any()
                ? BuildGlossaryContext(allGlossaries, query.DestinationLanguage)
                : null;

            var context = GenerateSuggestTranslationContext(query, glossaryContext);

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
            if (string.IsNullOrEmpty(aiText))
            {
                _logger.LogError("SuggestTranslation -> CallAiCompletion: Maximum Retry count reached");
                return null;
            }

            var output = FormatAiTextForSuggestTranslation(aiText, query.SourceText);
            if (string.IsNullOrWhiteSpace(output))
            {
                _logger.LogWarning("SuggestTranslation: formatting produced empty output for AI text '{AiText}'", aiText);
                return null;
            }

            return output;
        }

        public static string GenerateSuggestTranslationContext(SuggestLanguageRequest request, string? glossaryContext = null)
        {
            var context = !string.IsNullOrWhiteSpace(request.ElementDetailContext) ? request.ElementDetailContext :
                $"The requirement is to translate a user interface element of a webpage. Output only the translated text (no quotes, no explanation).";
            if (!string.IsNullOrWhiteSpace(glossaryContext))
            {
                context += $"\n{glossaryContext}\n";
            }
            context += $"Translate the following from {request.CurrentLanguage} to {request.DestinationLanguage}: '{request.SourceText}'";
            return context;
        }

        public static string BuildGlossaryContext(List<Glossary> glossaries, string targetLanguage)
        {
            if (glossaries == null || !glossaries.Any())
                return string.Empty;

            var glossaryLines = new List<string>();
            foreach (var glossary in glossaries)
            {
                var line = $"Glossary: {glossary.Name}";
                if (!string.IsNullOrWhiteSpace(glossary.Type))
                    line += $", Type: {glossary.Type}";
                if (!string.IsNullOrWhiteSpace(glossary.Context))
                    line += $", Context: {glossary.Context}";
                glossaryLines.Add(line);
            }

            return string.Join("\n", glossaryLines);
        }

        /// <summary>
        /// Normalises a raw AI completion into a bare translation: removes a wrapping
        /// quote pair and a label the model may have echoed from the prompt
        /// ("Translation: Enviar"). A colon belonging to the text itself
        /// ("Zeit: 09:30", "Delete the event:") is preserved by treating a colon as a
        /// label separator only when <paramref name="sourceText"/> contained none.
        /// </summary>
        public static string FormatAiTextForSuggestTranslation(string? aiText, string? sourceText = null)
        {
            if (string.IsNullOrWhiteSpace(aiText))
            {
                return string.Empty;
            }

            var text = StripWrappingQuotes(aiText.Trim());

            var sourceHasColon = sourceText?.Contains(':') ?? false;
            if (!sourceHasColon && text.Contains(':'))
            {
                var parts = text.Split(':', 2);
                var body = StripWrappingQuotes(parts[1].Trim());

                if (!string.IsNullOrWhiteSpace(body))
                {
                    text = body;
                }
            }

            return text.Trim();
        }

        /// <summary>
        /// Strips matching outer quote pairs only, so apostrophes belonging to the
        /// translation survive (l'hotel, aujourd'hui, dell'utente).
        /// </summary>
        private static string StripWrappingQuotes(string text)
        {
            while (text.Length > 1 &&
                   ((text[0] == '"' && text[^1] == '"') || (text[0] == '\'' && text[^1] == '\'')))
            {
                text = text[1..^1].Trim();
            }

            return text;
        }

        public async Task<string> AiCompletion(AiCompletionRequest request)
        {
            try
            {
                double.TryParse(_chatGptTemperature, out var temperature);
                TemperatureValidator(temperature);

                var encryptedSecret = GetEncryptedSecret();
                if (string.IsNullOrEmpty(encryptedSecret))
                {
                    throw new ArgumentException(
                        "AzureOpenAIEncryptedSecret is not set. " +
                        "Add it to Azure vault or to the blocks-secret-localization Mongo Secrets document.");
                }

                var secret = GetDecryptedSecret(encryptedSecret);
                var endpoint = ResolveAzureEndpoint();
                if (string.IsNullOrWhiteSpace(endpoint))
                {
                    throw new ArgumentException(
                        "AzureAIEndpoint is not configured. " +
                        "Add AzureAIEndpoint to the blocks-secret-localization Mongo Secrets document, " +
                        "or set AiCompletionUrl for local override.");
                }

                var model = new AiCompletionModel();
                var payload = model.ConstructCommand(request.Message, request.Temperature);

                var httpRequest = PrepareHttpRequest(endpoint, HttpMethod.Post, JsonConvert.SerializeObject(payload));
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

        /// <summary>
        /// Azure Chat Completions URL from Mongo <c>blocks-secret-localization</c>
        /// / vault, with optional <c>AiCompletionUrl</c> local fallback.
        /// </summary>
        public string? ResolveAzureEndpoint() =>
            FirstNonEmpty(
                _configuration["AzureAIEndpoint"],
                _localizationSecret.AzureAIEndpoint,
                _configuration["AiCompletionUrl"]);

        /// <summary>
        /// Encrypted Azure API key from Mongo / configuration first, then vault.
        /// Does not read <c>ChatGptEncryptedSecret</c>.
        /// </summary>
        public string? GetEncryptedSecret() =>
            FirstNonEmpty(
                _configuration["AzureOpenAIEncryptedSecret"],
                _localizationSecret.AzureOpenAIEncryptedSecret);
 
        /// <summary>
        /// AES unwrap key from Mongo / configuration first, then vault.
        /// Does not read <c>ChatGptEncryptionKey</c>.
        /// </summary>
        public string? GetEncryptionKey() =>
            FirstNonEmpty(
                _configuration["AzureAIEncryptionKey"],
                _localizationSecret.AzureAIEncryptionKey);

        private string GetDecryptedSecret(string encryptedText)
        {
            var key = GetEncryptionKey();
            if (string.IsNullOrWhiteSpace(key))
            {
                throw new ArgumentException(
                    "AzureAIEncryptionKey is not set. " +
                    "Add it to Azure vault or to the blocks-secret-localization Mongo Secrets document.");
            }

            var salt = GetSalt();
            
            if (salt is null)
            {
                throw new ArgumentException("Salt is null");
            }

            var decryptedValue = Decrypt(encryptedText, key, salt);
            return decryptedValue;
        }

        /// <summary>
        /// Localization <c>Salt</c> from Mongo KeyPairs (base64 string, e.g.
        /// <c>AQIDBAUGBwg=</c>) or from an appsettings byte array. Mongo's
        /// scalar value wins over leftover <c>Salt:0</c> children from
        /// appsettings — ConfigurationBinder would otherwise bind the hex-string
        /// array and ignore the base64.
        /// </summary>
        public byte[] GetSalt()
        {
            var saltText = _configuration["Salt"];
            if (!string.IsNullOrWhiteSpace(saltText))
            {
                var decoded = TryDecodeBase64Salt(saltText);
                if (decoded is { Length: > 0 })
                {
                    return decoded;
                }
            }

            return _configuration.GetSection("Salt").Get<byte[]>();
        }

        internal static byte[]? TryDecodeBase64Salt(string saltText)
        {
            try
            {
                return Convert.FromBase64String(saltText.Trim());
            }
            catch (FormatException)
            {
                return null;
            }
        }

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
                var endpointHost = httpRequestMessage.RequestUri?.Host;
                _logger.LogInformation("Started processing the API request. MethodType: {MethodType}, EndpointHost: {EndpointHost}",
                    httpRequestMessage.Method, endpointHost);

                ApplyApiKeyHeader(httpRequestMessage, secret);

                requestResponse = await _httpClient.SendAsync(httpRequestMessage);

                response.HttpStatusCode = requestResponse.StatusCode;
                response.ResponseData = await requestResponse.Content.ReadAsStringAsync();

                _logger.LogInformation("Completed processing the API request. MethodType: {MethodType}, EndpointHost: {EndpointHost}, HttpStatusCode: {HttpStatusCode}",
                    httpRequestMessage.Method, endpointHost, response.HttpStatusCode);
            }
            catch (BrokenCircuitException ex)
            {
                throw new InvalidOperationException(
                    $"Circuit breaker is open for Azure OpenAI request. Method={httpRequestMessage.Method}, EndpointHost={httpRequestMessage.RequestUri?.Host}",
                    ex);
            }

            return response;
        }

        public static void ApplyApiKeyHeader(HttpRequestMessage httpRequestMessage, string secret)
        {
            httpRequestMessage.Headers.Remove("Authorization");
            httpRequestMessage.Headers.Remove("api-key");
            httpRequestMessage.Headers.TryAddWithoutValidation("api-key", secret);
        }

        private static string? FirstNonEmpty(params string?[] values) =>
            values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
    }
}
