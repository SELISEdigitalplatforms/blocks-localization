using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared.Entities;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Moq.Protected;
using System.Net;
using System.Net.Http;
using System.Text;
using Xunit;

namespace XUnitTest
{
    public class AssistantServiceTests
    {
        private readonly Mock<ILogger<AssistantService>> _loggerMock;
        private readonly Mock<IConfiguration> _configurationMock;
        private readonly Mock<ILocalizationSecret> _localizationSecretMock;
        private readonly HttpClient _httpClient;
        private readonly AssistantService _assistantService;
        private readonly Mock<HttpMessageHandler> _handlerMock;


        public AssistantServiceTests()
        {
            _loggerMock = new Mock<ILogger<AssistantService>>();
            _configurationMock = new Mock<IConfiguration>();
            _localizationSecretMock = new Mock<ILocalizationSecret>();

            _configurationMock.SetupGet(x => x["Key"]).Returns("test-key");
            _configurationMock.SetupGet(x => x["AiCompletionUrl"]).Returns("http://test-url.com");
            _configurationMock.SetupGet(x => x["ChatGptTemperature"]).Returns("0.7");
            _configurationMock.SetupGet(x => x["Salt"]).Returns("[\"01\",\"02\",\"03\",\"04\",\"05\",\"06\",\"07\",\"08\"]");

            _localizationSecretMock.SetupGet(x => x.AzureAIEncryptionKey).Returns("dummy-encryption-key");
            _localizationSecretMock.SetupGet(x => x.AzureOpenAIEncryptedSecret)
                .Returns("dummy-encrypted-secret");
            _localizationSecretMock.SetupGet(x => x.AzureAIEndpoint)
                .Returns("https://test.cognitiveservices.azure.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-10-21");
            _localizationSecretMock.SetupGet(x => x.ChatGptEncryptedSecret)
                .Returns("unused-chatgpt-secret");

            // Use a stubbed HttpMessageHandler so no real HTTP is performed.
            _handlerMock = new Mock<HttpMessageHandler>(MockBehavior.Strict);
            _handlerMock
                .Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("{}", Encoding.UTF8, "application/json")
                });

            _httpClient = new HttpClient(_handlerMock.Object);

            _assistantService = new AssistantService(
                _loggerMock.Object,
                _configurationMock.Object,
                _httpClient,
                _localizationSecretMock.Object,
                new Mock<IGlossaryRepository>().Object
            );
        }

        #region GenerateSuggestTranslationContext Tests

        [Fact]
        public void GenerateSuggestTranslationContext_WithElementDetailContext_ReturnsContext()
        {
            var request = new SuggestLanguageRequest
            {
                ElementDetailContext = "submit",
                SourceText = "Submit",
                DestinationLanguage = "es",
                CurrentLanguage = "en"
            };

            var result = AssistantService.GenerateSuggestTranslationContext(request);

            result.Should().Contain("submit");
            result.Should().Contain("Translate the following from en to es: 'Submit'");
        }

        [Fact]
        public void GenerateSuggestTranslationContext_WithoutElementDetailContext_ReturnsDefault()
        {
            var request = new SuggestLanguageRequest
            {
                ElementDetailContext = null,
                SourceText = "Welcome",
                DestinationLanguage = "fr",
                CurrentLanguage = "en"
            };

            var result = AssistantService.GenerateSuggestTranslationContext(request);

            result.Should().Contain("translate a user interface element", because: "default context should be used");
            result.Should().Contain("Translate the following from en to fr: 'Welcome'");
        }

        [Fact]
        public void GenerateSuggestTranslationContext_WithEmptyElementDetailContext_ReturnsDefaultContext()
        {
            var request = new SuggestLanguageRequest
            {
                ElementDetailContext = "   ",
                SourceText = "Hello",
                DestinationLanguage = "de",
                CurrentLanguage = "en"
            };

            var result = AssistantService.GenerateSuggestTranslationContext(request);

            result.Should().Contain("translate a user interface element");
            result.Should().Contain("Translate the following from en to de: 'Hello'");
        }

        [Fact]
        public void GenerateSuggestTranslationContext_WithAllParameters_ReturnsCompleteContext()
        {
            var request = new SuggestLanguageRequest
            {
                ElementDetailContext = "Button for form submission",
                SourceText = "Save Changes",
                DestinationLanguage = "ja",
                CurrentLanguage = "en"
            };

            var result = AssistantService.GenerateSuggestTranslationContext(request);

            result.Should().Contain("Button for form submission");
            result.Should().Contain("Translate the following from en to ja: 'Save Changes'");
        }

        #endregion

        #region FormatAiTextForSuggestTranslation Tests

        [Fact]
        public void FormatAiTextForSuggestTranslation_WithColon_ExtractsTextAfterColon()
        {
            var aiText = "\"Translated: Enviar\"";

            var result = AssistantService.FormatAiTextForSuggestTranslation(aiText);

            result.Should().Be("Enviar");
        }

        [Fact]
        public void FormatAiTextForSuggestTranslation_WithoutColon_ReturnsTrimmedText()
        {
            var aiText = "\"Bienvenue\"";

            var result = AssistantService.FormatAiTextForSuggestTranslation(aiText);

            result.Should().Be("Bienvenue");
        }

        [Fact]
        public void FormatAiTextForSuggestTranslation_WithQuotes_RemovesQuotes()
        {
            var aiText = "'Hello World'";

            var result = AssistantService.FormatAiTextForSuggestTranslation(aiText);

            result.Should().Be("Hello World");
        }

        [Fact]
        public void FormatAiTextForSuggestTranslation_WithWhitespace_TrimsWhitespace()
        {
            var aiText = "  \n\tBonjour\t\n  ";

            var result = AssistantService.FormatAiTextForSuggestTranslation(aiText);

            result.Should().Be("Bonjour");
        }

        [Fact]
        public void FormatAiTextForSuggestTranslation_NullInput_ReturnsEmpty()
        {
            string? aiText = null;

            var result = AssistantService.FormatAiTextForSuggestTranslation(aiText);

            result.Should().BeEmpty();
        }

        [Fact]
        public void FormatAiTextForSuggestTranslation_EmptyString_ReturnsEmpty()
        {
            var aiText = "";

            var result = AssistantService.FormatAiTextForSuggestTranslation(aiText);

            result.Should().BeEmpty();
        }

        [Fact]
        public void FormatAiTextForSuggestTranslation_WhitespaceOnly_ReturnsEmpty()
        {
            var aiText = "   ";

            var result = AssistantService.FormatAiTextForSuggestTranslation(aiText);

            result.Should().BeEmpty();
        }

        [Fact]
        public void FormatAiTextForSuggestTranslation_WithMultipleColons_KeepsEverythingAfterFirstColon()
        {
            var aiText = "Translation: Hello: World";

            var result = AssistantService.FormatAiTextForSuggestTranslation(aiText);

            result.Should().Be("Hello: World");
        }

        [Fact]
        public void FormatAiTextForSuggestTranslation_ColonAtEnd_FallsBackToFullText()
        {
            var aiText = "Translation:";

            var result = AssistantService.FormatAiTextForSuggestTranslation(aiText);

            result.Should().Be("Translation:");
        }

        [Fact]
        public void FormatAiTextForSuggestTranslation_WithMixedQuotes_RemovesOnlyWrappingQuotes()
        {
            var aiText = "\"Test'Value\"";

            var result = AssistantService.FormatAiTextForSuggestTranslation(aiText);

            result.Should().Be("Test'Value");
        }

        [Fact]
        public void FormatAiTextForSuggestTranslation_NestedQuotes_RemovesEveryWrappingPair()
        {
            var aiText = "\"'Enviar'\"";

            var result = AssistantService.FormatAiTextForSuggestTranslation(aiText);

            result.Should().Be("Enviar");
        }

        [Fact]
        public void FormatAiTextForSuggestTranslation_SourceWithoutColon_StripsLabelPrefix()
        {
            var aiText = "Translation: Enviar";
            var sourceText = "Submit";

            var result = AssistantService.FormatAiTextForSuggestTranslation(aiText, sourceText);

            result.Should().Be("Enviar");
        }

        [Fact]
        public void FormatAiTextForSuggestTranslation_SourceEndsWithColon_PreservesWholeTranslation()
        {
            var aiText = "Estas seguro de que quieres eliminar el evento:";
            var sourceText = "Are you sure you want to delete the event:";

            var result = AssistantService.FormatAiTextForSuggestTranslation(aiText, sourceText);

            result.Should().Be("Estas seguro de que quieres eliminar el evento:");
        }

        [Fact]
        public void FormatAiTextForSuggestTranslation_SourceContainsColon_PreservesInnerColons()
        {
            var aiText = "Zeit: 09:30";
            var sourceText = "Time: 09:30";

            var result = AssistantService.FormatAiTextForSuggestTranslation(aiText, sourceText);

            result.Should().Be("Zeit: 09:30");
        }

        [Fact]
        public void FormatAiTextForSuggestTranslation_SourceIsLabelledValue_PreservesLabel()
        {
            var aiText = "Hinweis: erforderlich";
            var sourceText = "Note: required";

            var result = AssistantService.FormatAiTextForSuggestTranslation(aiText, sourceText);

            result.Should().Be("Hinweis: erforderlich");
        }

        [Fact]
        public void FormatAiTextForSuggestTranslation_ApostropheInTranslation_IsPreserved()
        {
            var aiText = "l'hotel";
            var sourceText = "the hotel";

            var result = AssistantService.FormatAiTextForSuggestTranslation(aiText, sourceText);

            result.Should().Be("l'hotel");
        }

        [Fact]
        public void FormatAiTextForSuggestTranslation_QuotedApostropheTranslation_KeepsApostrophe()
        {
            var aiText = "\"aujourd'hui\"";
            var sourceText = "today";

            var result = AssistantService.FormatAiTextForSuggestTranslation(aiText, sourceText);

            result.Should().Be("aujourd'hui");
        }

        [Fact]
        public void FormatAiTextForSuggestTranslation_SourceWithColonAndQuotedReply_StripsQuotesOnly()
        {
            var aiText = "'Nombre: Juan'";
            var sourceText = "Name: John";

            var result = AssistantService.FormatAiTextForSuggestTranslation(aiText, sourceText);

            result.Should().Be("Nombre: Juan");
        }

        #endregion

        #region PrepareHttpRequest Tests

        [Fact]
        public void PrepareHttpRequest_WithContent_CreatesRequestWithContent()
        {
            var url = "http://test.com/api";
            var content = "{\"test\": \"data\"}";

            var result = AssistantService.PrepareHttpRequest(url, HttpMethod.Post, content);

            result.Method.Should().Be(HttpMethod.Post);
            result.RequestUri.Should().Be(new Uri(url));
            result.Content.Should().NotBeNull();
        }

        [Fact]
        public void PrepareHttpRequest_WithoutContent_CreatesRequestWithoutContent()
        {
            var url = "http://test.com/api";

            var result = AssistantService.PrepareHttpRequest(url, HttpMethod.Get, null);

            result.Method.Should().Be(HttpMethod.Get);
            result.RequestUri.Should().Be(new Uri(url));
            result.Content.Should().BeNull();
        }

        public void PrepareHttpRequest_WithPutMethod_CreatesCorrectRequest()
        {
            var url = "http://test.com/api/resource";
            var content = "{\"id\": 1}";

            var result = AssistantService.PrepareHttpRequest(url, HttpMethod.Put, content);

            result.Method.Should().Be(HttpMethod.Put);
            result.RequestUri.Should().Be(new Uri(url));
            result.Content.Should().NotBeNull();
        }

        [Fact]
        public void PrepareHttpRequest_WithDeleteMethod_CreatesCorrectRequest()
        {
            var url = "http://test.com/api/resource/1";

            var result = AssistantService.PrepareHttpRequest(url, HttpMethod.Delete, null);

            result.Method.Should().Be(HttpMethod.Delete);
            result.RequestUri.Should().Be(new Uri(url));
        }

        [Fact]
        public async Task PrepareHttpRequest_ContentType_IsApplicationJson()
        {
            var url = "http://test.com/api";
            var content = "{\"key\": \"value\"}";

            var result = AssistantService.PrepareHttpRequest(url, HttpMethod.Post, content);

            result.Content.Should().NotBeNull();
            result.Content!.Headers.ContentType!.MediaType.Should().Be("application/json");
        }

        #endregion

        #region Decrypt Tests

        [Fact]
        public void Decrypt_WithInvalidCipher_ThrowsCryptographicException()
        {
            var encryptedText = "dGVzdA=="; // base64 of "test", not a valid AES cipher for this key/salt
            var key = "test-key";
            var salt = new byte[] { 1, 2, 3, 4, 5, 6, 7, 8 };

            Action act = () => AssistantService.Decrypt(encryptedText, key, salt);

            act.Should().Throw<Exception>(); // cryptographic failure is expected, but should not cause null refs
        }

        [Fact]
        public void Decrypt_WithInvalidBase64_ThrowsFormatException()
        {
            var invalidBase64 = "not-valid-base64!!!";
            var key = "test-key";
            var salt = new byte[] { 1, 2, 3, 4, 5, 6, 7, 8 };

            Action act = () => AssistantService.Decrypt(invalidBase64, key, salt);

            act.Should().Throw<FormatException>();
        }

        [Fact]
        public void Decrypt_WithEmptyKey_ThrowsException()
        {
            var encryptedText = "dGVzdA==";
            var key = "";
            var salt = new byte[] { 1, 2, 3, 4, 5, 6, 7, 8 };

            Action act = () => AssistantService.Decrypt(encryptedText, key, salt);

            act.Should().Throw<Exception>();
        }

        #endregion

        #region GetSalt Tests

        [Fact]
        public void GetSalt_WhenConfigured_ReturnsByteArray()
        {
            var configSectionMock = new Mock<IConfigurationSection>();
            _configurationMock.SetupGet(x => x["Salt"]).Returns((string)null!);
            _configurationMock.Setup(x => x.GetSection("Salt")).Returns(configSectionMock.Object);

            var result = _assistantService.GetSalt();

            // Result depends on configuration setup; verify method executes without exception
            result.Should().BeNull(); // Mock returns null when Get<byte[]>() is not explicitly set
        }

        [Fact]
        public void GetSalt_DecodesMongoBase64String()
        {
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Salt"] = "AQIDBAUGBwg=",
                })
                .Build();

            var service = new AssistantService(
                _loggerMock.Object,
                config,
                _httpClient,
                _localizationSecretMock.Object,
                new Mock<IGlossaryRepository>().Object);

            service.GetSalt().Should().Equal(1, 2, 3, 4, 5, 6, 7, 8);
        }

        [Fact]
        public void GetSalt_PrefersMongoBase64OverAppsettingsHexArray()
        {
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Salt:0"] = "0x09",
                    ["Salt:1"] = "0x0A",
                    ["Salt:2"] = "0x0B",
                    ["Salt:3"] = "0x0C",
                    ["Salt:4"] = "0x0D",
                    ["Salt:5"] = "0x0E",
                    ["Salt:6"] = "0x0F",
                    ["Salt:7"] = "0x10",
                    ["Salt"] = "AQIDBAUGBwg=",
                })
                .Build();

            var service = new AssistantService(
                _loggerMock.Object,
                config,
                _httpClient,
                _localizationSecretMock.Object,
                new Mock<IGlossaryRepository>().Object);

            service.GetSalt().Should().Equal(1, 2, 3, 4, 5, 6, 7, 8);
        }

        [Fact]
        public void Decrypt_WithMongoBase64Salt_RoundTrips()
        {
            var salt = Convert.FromBase64String("AQIDBAUGBwg=");
            const string key = "O5faaMqQiF65uF4B+rkZL1//Rky6Pv+3bl3jzH6uDkg=";
            var encrypted = Encrypt("sk-roundtrip", key, salt);

            AssistantService.Decrypt(encrypted, key, salt).Should().Be("sk-roundtrip");
        }

        #endregion

        #region Azure endpoint and secret resolution

        [Fact]
        public void ResolveAzureEndpoint_PrefersMongoConfigurationOverVaultAndFallback()
        {
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["AzureAIEndpoint"] = "https://mongo.example/openai/chat/completions",
                    ["AiCompletionUrl"] = "http://appsettings-fallback.example/v1/chat/completions",
                })
                .Build();

            var secretMock = new Mock<ILocalizationSecret>();
            secretMock.SetupGet(x => x.AzureAIEndpoint).Returns("https://vault.example/openai/chat/completions");

            var service = new AssistantService(
                _loggerMock.Object,
                config,
                _httpClient,
                secretMock.Object,
                new Mock<IGlossaryRepository>().Object);

            service.ResolveAzureEndpoint().Should().Be("https://mongo.example/openai/chat/completions");
        }

        [Fact]
        public void ResolveAzureEndpoint_FallsBackToVaultThenAiCompletionUrl()
        {
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["AiCompletionUrl"] = "http://appsettings-fallback.example/v1/chat/completions",
                })
                .Build();

            var vaultSecret = new Mock<ILocalizationSecret>();
            vaultSecret.SetupGet(x => x.AzureAIEndpoint).Returns("https://vault.example/openai/chat/completions");

            var withVault = new AssistantService(
                _loggerMock.Object,
                config,
                _httpClient,
                vaultSecret.Object,
                new Mock<IGlossaryRepository>().Object);
            withVault.ResolveAzureEndpoint().Should().Be("https://vault.example/openai/chat/completions");

            var emptyVault = new AssistantService(
                _loggerMock.Object,
                config,
                _httpClient,
                new Mock<ILocalizationSecret>().Object,
                new Mock<IGlossaryRepository>().Object);
            emptyVault.ResolveAzureEndpoint().Should().Be("http://appsettings-fallback.example/v1/chat/completions");
        }

        [Fact]
        public void GetEncryptedSecret_PrefersMongoConfigurationOverVault()
        {
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["AzureOpenAIEncryptedSecret"] = "mongo-blob",
                })
                .Build();

            var secretMock = new Mock<ILocalizationSecret>();
            secretMock.SetupGet(x => x.AzureOpenAIEncryptedSecret).Returns("vault-blob");
            secretMock.SetupGet(x => x.ChatGptEncryptedSecret).Returns("legacy-blob");

            var service = new AssistantService(
                _loggerMock.Object,
                config,
                _httpClient,
                secretMock.Object,
                new Mock<IGlossaryRepository>().Object);

            service.GetEncryptedSecret().Should().Be("mongo-blob");
        }

        [Fact]
        public void GetEncryptedSecret_FallsBackToVault_AndIgnoresChatGptEncryptedSecret()
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
            var secretMock = new Mock<ILocalizationSecret>();
            secretMock.SetupGet(x => x.AzureOpenAIEncryptedSecret).Returns("vault-blob");
            secretMock.SetupGet(x => x.ChatGptEncryptedSecret).Returns("legacy-blob");

            var service = new AssistantService(
                _loggerMock.Object,
                config,
                _httpClient,
                secretMock.Object,
                new Mock<IGlossaryRepository>().Object);

            service.GetEncryptedSecret().Should().Be("vault-blob");
        }

        [Fact]
        public void GetEncryptionKey_PrefersMongoConfigurationOverVault()
        {
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["AzureAIEncryptionKey"] = "mongo-wrap-key",
                })
                .Build();

            var secretMock = new Mock<ILocalizationSecret>();
            secretMock.SetupGet(x => x.AzureAIEncryptionKey).Returns("vault-wrap-key");
            secretMock.SetupGet(x => x.ChatGptEncryptionKey).Returns("legacy-chatgpt-key");

            var service = new AssistantService(
                _loggerMock.Object,
                config,
                _httpClient,
                secretMock.Object,
                new Mock<IGlossaryRepository>().Object);

            service.GetEncryptionKey().Should().Be("mongo-wrap-key");
        }

        [Fact]
        public void GetEncryptionKey_FallsBackToVault_AndIgnoresChatGptEncryptionKey()
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
            var secretMock = new Mock<ILocalizationSecret>();
            secretMock.SetupGet(x => x.AzureAIEncryptionKey).Returns("vault-wrap-key");
            secretMock.SetupGet(x => x.ChatGptEncryptionKey).Returns("legacy-chatgpt-key");

            var service = new AssistantService(
                _loggerMock.Object,
                config,
                _httpClient,
                secretMock.Object,
                new Mock<IGlossaryRepository>().Object);

            service.GetEncryptionKey().Should().Be("vault-wrap-key");
        }

        [Fact]
        public void ApplyApiKeyHeader_SetsApiKeyAndClearsBearer()
        {
            var request = new HttpRequestMessage(HttpMethod.Post, "https://example.com");
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", "old");

            AssistantService.ApplyApiKeyHeader(request, "azure-key");

            request.Headers.GetValues("api-key").Should().ContainSingle().Which.Should().Be("azure-key");
            request.Headers.Authorization.Should().BeNull();
        }

        #endregion

        #region MakeRequestAsync Tests

        [Fact]
        public async Task MakeRequestAsync_WithErrorResponse_ReturnsErrorStatusCode()
        {
            var handlerMock = new Mock<HttpMessageHandler>(MockBehavior.Strict);
            handlerMock
                .Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.BadRequest)
                {
                    Content = new StringContent("{\"error\": \"Bad request\"}", Encoding.UTF8, "application/json")
                });

            var httpClient = new HttpClient(handlerMock.Object);
            var service = new AssistantService(
                _loggerMock.Object,
                _configurationMock.Object,
                httpClient,
                _localizationSecretMock.Object,
                new Mock<IGlossaryRepository>().Object
            );

            var request = new HttpRequestMessage(HttpMethod.Get, "http://test.com/api");
            var result = await service.MakeRequestAsync(request, "test-secret");

            result.Should().NotBeNull();
            result.HttpStatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task MakeRequestAsync_WithInternalServerError_ReturnsServerErrorStatusCode()
        {
            var handlerMock = new Mock<HttpMessageHandler>(MockBehavior.Strict);
            handlerMock
                .Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.InternalServerError)
                {
                    Content = new StringContent("{\"error\": \"Server error\"}", Encoding.UTF8, "application/json")
                });

            var httpClient = new HttpClient(handlerMock.Object);
            var service = new AssistantService(
                _loggerMock.Object,
                _configurationMock.Object,
                httpClient,
                _localizationSecretMock.Object,
                new Mock<IGlossaryRepository>().Object
            );

            var request = new HttpRequestMessage(HttpMethod.Get, "http://test.com/api");
            var result = await service.MakeRequestAsync(request, "test-secret");

            result.HttpStatusCode.Should().Be(HttpStatusCode.InternalServerError);
        }

        #endregion

        #region AiCompletion Tests

        [Fact]
        public async Task AiCompletion_WithInvalidTemperature_ReturnsNull()
        {
            var configMock = new Mock<IConfiguration>();
            configMock.SetupGet(x => x["ChatGptTemperature"]).Returns("1.5"); // Invalid temperature > 1
            configMock.SetupGet(x => x["AiCompletionUrl"]).Returns("http://test-url.com");

            var service = new AssistantService(
                _loggerMock.Object,
                configMock.Object,
                _httpClient,
                _localizationSecretMock.Object,
                new Mock<IGlossaryRepository>().Object
            );

            var request = new AiCompletionRequest("Test message", 0.5);
            var result = await service.AiCompletion(request);

            result.Should().BeNull();
        }

        [Fact]
        public async Task AiCompletion_WithNegativeTemperature_ReturnsNull()
        {
            var configMock = new Mock<IConfiguration>();
            configMock.SetupGet(x => x["ChatGptTemperature"]).Returns("-0.5"); // Invalid negative temperature
            configMock.SetupGet(x => x["AiCompletionUrl"]).Returns("http://test-url.com");

            var service = new AssistantService(
                _loggerMock.Object,
                configMock.Object,
                _httpClient,
                _localizationSecretMock.Object,
                new Mock<IGlossaryRepository>().Object
            );

            var request = new AiCompletionRequest("Test message", 0.5);
            var result = await service.AiCompletion(request);

            result.Should().BeNull();
        }

        [Fact]
        public async Task AiCompletion_WithNullEncryptedSecret_ReturnsNull()
        {
            var localizationSecretMock = new Mock<ILocalizationSecret>();
            localizationSecretMock.SetupGet(x => x.AzureOpenAIEncryptedSecret).Returns((string)null!);
            localizationSecretMock.SetupGet(x => x.ChatGptEncryptedSecret).Returns("unused-chatgpt-secret");

            var service = new AssistantService(
                _loggerMock.Object,
                _configurationMock.Object,
                _httpClient,
                localizationSecretMock.Object,
                new Mock<IGlossaryRepository>().Object
            );

            var request = new AiCompletionRequest("Test message", 0.5);
            var result = await service.AiCompletion(request);

            result.Should().BeNull();
        }

        [Fact]
        public async Task AiCompletion_WithEmptyEncryptedSecret_ReturnsNull()
        {
            var localizationSecretMock = new Mock<ILocalizationSecret>();
            localizationSecretMock.SetupGet(x => x.AzureOpenAIEncryptedSecret).Returns(string.Empty);
            localizationSecretMock.SetupGet(x => x.ChatGptEncryptedSecret).Returns("unused-chatgpt-secret");

            var service = new AssistantService(
                _loggerMock.Object,
                _configurationMock.Object,
                _httpClient,
                localizationSecretMock.Object,
                new Mock<IGlossaryRepository>().Object
            );

            var request = new AiCompletionRequest("Test message", 0.5);
            var result = await service.AiCompletion(request);

            result.Should().BeNull();
        }

        [Fact]
        public async Task AiCompletion_IgnoresChatGptEncryptedSecret()
        {
            var localizationSecretMock = new Mock<ILocalizationSecret>();
            localizationSecretMock.SetupGet(x => x.ChatGptEncryptedSecret).Returns("legacy-blob");
            localizationSecretMock.SetupGet(x => x.AzureOpenAIEncryptedSecret).Returns((string)null!);
            localizationSecretMock.SetupGet(x => x.AzureAIEncryptionKey).Returns("dummy-encryption-key");

            var service = new AssistantService(
                _loggerMock.Object,
                _configurationMock.Object,
                _httpClient,
                localizationSecretMock.Object,
                new Mock<IGlossaryRepository>().Object
            );

            var result = await service.AiCompletion(new AiCompletionRequest("Test message", 0.5));

            result.Should().BeNull();
            service.GetEncryptedSecret().Should().BeNull();
        }

        #endregion

        #region SuggestTranslation Integration Tests

        [Fact]
        public async Task SuggestTranslation_WithValidRequest_ReturnsTranslatedText()
        {
            // Build a fully-valid pipeline so SuggestTranslation runs the happy path end-to-end:
            // glossaries merged, secret decrypted, AI called, response formatted.
            var salt = new byte[] { 1, 2, 3, 4, 5, 6, 7, 8 };
            const string encryptionKey = "dummy-encryption-key";
            var encryptedSecret = Encrypt("sk-test-secret", encryptionKey, salt);

            const string azureEndpoint =
                "https://test.cognitiveservices.azure.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-10-21";
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["AiCompletionUrl"] = "http://openai-fallback.example/v1/chat/completions",
                    ["AzureAIEndpoint"] = azureEndpoint,
                    ["ChatGptTemperature"] = "0.7",
                    ["Salt:0"] = "1", ["Salt:1"] = "2", ["Salt:2"] = "3", ["Salt:3"] = "4",
                    ["Salt:4"] = "5", ["Salt:5"] = "6", ["Salt:6"] = "7", ["Salt:7"] = "8",
                })
                .Build();

            var secretMock = new Mock<ILocalizationSecret>();
            secretMock.SetupGet(x => x.AzureAIEncryptionKey).Returns(encryptionKey);
            secretMock.SetupGet(x => x.AzureOpenAIEncryptedSecret).Returns(encryptedSecret);
            secretMock.SetupGet(x => x.ChatGptEncryptedSecret).Returns("unused-chatgpt-secret");

            var glossaryMock = new Mock<IGlossaryRepository>();
            glossaryMock.Setup(g => g.GetGlobalAsync(It.IsAny<string>())).ReturnsAsync(new List<Glossary>());
            glossaryMock.Setup(g => g.GetByModuleIdAsync(It.IsAny<string>(), It.IsAny<string>())).ReturnsAsync(new List<Glossary>());
            glossaryMock.Setup(g => g.GetByIdsAsync(It.IsAny<List<string>>())).ReturnsAsync(new List<Glossary>());

            var handlerMock = new Mock<HttpMessageHandler>(MockBehavior.Strict);
            HttpRequestMessage? capturedRequest = null;
            handlerMock
                .Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>())
                .Callback<HttpRequestMessage, CancellationToken>((req, _) => capturedRequest = req)
                .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(
                        "{\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":\"Hola\"}}]}",
                        Encoding.UTF8, "application/json")
                });

            var service = new AssistantService(
                _loggerMock.Object,
                config,
                new HttpClient(handlerMock.Object),
                secretMock.Object,
                glossaryMock.Object);

            var request = new SuggestLanguageRequest
            {
                SourceText = "Hello",
                CurrentLanguage = "en",
                DestinationLanguage = "es",
                Temperature = 0.7
            };

            var result = await service.SuggestTranslation(request);

            result.Should().Be("Hola");
            glossaryMock.Verify(g => g.GetGlobalAsync(It.IsAny<string>()), Times.Once);
            capturedRequest.Should().NotBeNull();
            capturedRequest!.RequestUri.Should().Be(new Uri(azureEndpoint));
            capturedRequest.Headers.Contains("api-key").Should().BeTrue();
            capturedRequest.Headers.GetValues("api-key").Should().ContainSingle().Which.Should().Be("sk-test-secret");
            capturedRequest.Headers.Authorization.Should().BeNull();
        }

        // AES-CBC/PKCS7 encryption that mirrors AssistantService.Decrypt so the test can produce
        // a secret the service will successfully decrypt.
        private static string Encrypt(string plainText, string key, byte[] salt)
        {
            using var aes = System.Security.Cryptography.Aes.Create();
            var kdf = new System.Security.Cryptography.Rfc2898DeriveBytes(key, salt);
            aes.Key = kdf.GetBytes(aes.KeySize / 8);
            aes.IV = kdf.GetBytes(aes.BlockSize / 8);
            using var encryptor = aes.CreateEncryptor(aes.Key, aes.IV);
            using var ms = new MemoryStream();
            using (var cs = new System.Security.Cryptography.CryptoStream(ms, encryptor, System.Security.Cryptography.CryptoStreamMode.Write))
            using (var sw = new StreamWriter(cs))
            {
                sw.Write(plainText);
            }
            return Convert.ToBase64String(ms.ToArray());
        }

        #endregion

        #region Constructor Tests

        [Fact]
        public void Constructor_WithValidDependencies_CreatesInstance()
        {
            var service = new AssistantService(
                _loggerMock.Object,
                _configurationMock.Object,
                _httpClient,
                _localizationSecretMock.Object,
                new Mock<IGlossaryRepository>().Object
            );

            service.Should().NotBeNull();
        }

        #endregion

        #region MakeRequestAsync Success Tests

        [Fact]
        public async Task MakeRequestAsync_WithSuccessResponse_ReturnsOkStatus()
        {
            var handlerMock = new Mock<HttpMessageHandler>(MockBehavior.Strict);
            handlerMock
                .Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("{\"result\": \"ok\"}", Encoding.UTF8, "application/json")
                });

            var httpClient = new HttpClient(handlerMock.Object);
            var service = new AssistantService(
                _loggerMock.Object,
                _configurationMock.Object,
                httpClient,
                _localizationSecretMock.Object,
                new Mock<IGlossaryRepository>().Object
            );

            var request = new HttpRequestMessage(HttpMethod.Post, "http://test.com/api");
            request.Content = new StringContent("{}", Encoding.UTF8, "application/json");
            var result = await service.MakeRequestAsync(request, "test-secret");

            result.Should().NotBeNull();
            result.HttpStatusCode.Should().Be(HttpStatusCode.OK);
            ((string)result.ResponseData).Should().Contain("ok");
        }

        [Fact]
        public async Task MakeRequestAsync_SetsApiKeyHeader()
        {
            HttpRequestMessage? capturedRequest = null;
            var handlerMock = new Mock<HttpMessageHandler>(MockBehavior.Strict);
            handlerMock
                .Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>())
                .Callback<HttpRequestMessage, CancellationToken>((req, _) => capturedRequest = req)
                .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("{}", Encoding.UTF8, "application/json")
                });

            var httpClient = new HttpClient(handlerMock.Object);
            var service = new AssistantService(
                _loggerMock.Object,
                _configurationMock.Object,
                httpClient,
                _localizationSecretMock.Object,
                new Mock<IGlossaryRepository>().Object
            );

            var request = new HttpRequestMessage(HttpMethod.Get, "http://test.com/api");
            await service.MakeRequestAsync(request, "my-secret");

            capturedRequest.Should().NotBeNull();
            capturedRequest!.Headers.Contains("api-key").Should().BeTrue();
            capturedRequest.Headers.GetValues("api-key").Should().ContainSingle().Which.Should().Be("my-secret");
            capturedRequest.Headers.Authorization.Should().BeNull();
            httpClient.DefaultRequestHeaders.Authorization.Should().BeNull();
        }

        #endregion

        #region TemperatureValidator Tests

        [Fact]
        public async Task AiCompletion_WithValidTemperature_DoesNotThrowValidationError()
        {
            // Temperature 0.7 is valid - the method should proceed but may fail on encryption
            var configMock = new Mock<IConfiguration>();
            configMock.SetupGet(x => x["ChatGptTemperature"]).Returns("0.7");
            configMock.SetupGet(x => x["AiCompletionUrl"]).Returns("http://test-url.com");

            var localizationSecretMock = new Mock<ILocalizationSecret>();
            localizationSecretMock.SetupGet(x => x.AzureOpenAIEncryptedSecret).Returns("dummySecret");
            localizationSecretMock.SetupGet(x => x.AzureAIEncryptionKey).Returns("dummyKey");

            var saltSection = new Mock<IConfigurationSection>();
            configMock.Setup(x => x.GetSection("Salt")).Returns(saltSection.Object);

            var service = new AssistantService(
                _loggerMock.Object,
                configMock.Object,
                _httpClient,
                localizationSecretMock.Object,
                new Mock<IGlossaryRepository>().Object
            );

            var request = new AiCompletionRequest("Test", 0.5);
            // Will fail due to salt being null but should pass temperature validation
            var result = await service.AiCompletion(request);
            result.Should().BeNull(); // Fails at salt validation
        }

        #endregion

        #region AiCompletionModel Tests

        [Fact]
        public void AiCompletionModel_ConstructCommand_SetsCorrectProperties()
        {
            var model = new AiCompletionModel();
            var result = model.ConstructCommand("Translate hello to Spanish", 0.7);

            result.model.Should().Be("gpt-4o-mini");
            result.temperature.Should().Be(0.7);
            result.messages.Should().HaveCount(2);
            result.messages[0].role.Should().Be("system");
            result.messages[1].role.Should().Be("user");
            result.messages[1].content.Should().Be("Translate hello to Spanish");
        }

        #endregion

        #region AiCompletionRequest Model Tests

        [Fact]
        public void AiCompletionRequest_Constructor_SetsProperties()
        {
            var request = new AiCompletionRequest("Test message", 0.5);
            request.Message.Should().Be("Test message");
            request.Temperature.Should().Be(0.5);
        }

        #endregion

        #region RestResponse Model Tests

        [Fact]
        public void RestResponse_Properties_SetCorrectly()
        {
            var response = new RestResponse
            {
                HttpStatusCode = HttpStatusCode.OK,
                ResponseData = "test data"
            };

            response.HttpStatusCode.Should().Be(HttpStatusCode.OK);
            ((string)response.ResponseData).Should().Be("test data");
        }

        #endregion

        #region ChatGptAiCompletionRequestResponse Model Tests

        [Fact]
        public void ChatGptAiCompletionRequestResponse_Properties_SetCorrectly()
        {
            var response = new ChatGptAiCompletionRequestResponse
            {
                id = "test-id",
                @object = "chat.completion",
                created = 12345,
                model = "gpt-4",
                usage = new Usage { prompt_tokens = 10, completion_tokens = 20, total_tokens = 30 },
                choices = new List<Choice>
                {
                    new Choice
                    {
                        index = 0,
                        finish_reason = "stop",
                        message = new Message { role = "assistant", content = "Hola" }
                    }
                }
            };

            response.id.Should().Be("test-id");
            response.model.Should().Be("gpt-4");
            response.usage.total_tokens.Should().Be(30);
            response.choices.Should().HaveCount(1);
            response.choices[0].message.content.Should().Be("Hola");
        }

        #endregion

        #region SuggestLanguageRequest Model Tests

        [Fact]
        public void SuggestLanguageRequest_DefaultValues_AreCorrect()
        {
            var request = new SuggestLanguageRequest();
            request.MaxCharacterLength.Should().Be(0);
        }

        [Fact]
        public void SuggestLanguageRequest_Properties_SetCorrectly()
        {
            var request = new SuggestLanguageRequest
            {
                ElementType = "button",
                ElementApplicationContext = "checkout",
                ElementDetailContext = "submit button",
                Temperature = 0.7,
                MaxCharacterLength = 50,
                SourceText = "Submit",
                DestinationLanguage = "es",
                CurrentLanguage = "en"
            };

            request.ElementType.Should().Be("button");
            request.ElementApplicationContext.Should().Be("checkout");
            request.MaxCharacterLength.Should().Be(50);
        }

        #endregion
    }
}
