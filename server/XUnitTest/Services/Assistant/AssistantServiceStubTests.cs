using System.Diagnostics.Metrics;
using System.Security.Cryptography;
using System.Text;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared.Entities;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using XUnitTest.Shared;
using GlossaryModel = Eurolm.DomainService.Services.Glossary;

namespace XUnitTest.Services.Assistant
{
    /// <summary>
    /// I02-WP6: the assistant calls the model through Genesis's <c>IChatCompletionClient</c>. These tests use the real
    /// <see cref="AssistantService"/> against the scripted OpenAI / Azure-format stub (a local HTTP listener): no real model is called (rule 13).
    /// </summary>
    public class AssistantServiceStubTests
    {
        private const string EncryptionKey = "unit-test-encryption-key";
        private const string PlainApiKey = "fake-api-key-not-a-secret";
        private static readonly byte[] Salt = { 1, 2, 3, 4, 5, 6, 7, 8 };

        private static string Encrypt(string plainText)
        {
            using var aes = Aes.Create();
            var kdf = new Rfc2898DeriveBytes(EncryptionKey, Salt);
            aes.Key = kdf.GetBytes(aes.KeySize / 8);
            aes.IV = kdf.GetBytes(aes.BlockSize / 8);
            using var enc = aes.CreateEncryptor(aes.Key, aes.IV);
            var bytes = Encoding.UTF8.GetBytes(plainText);
            return Convert.ToBase64String(enc.TransformFinalBlock(bytes, 0, bytes.Length));
        }

        private static AssistantService Build(
            Dictionary<string, string?> settings,
            bool legacyKey = true,
            string? vaultEndpoint = null,
            IGlossaryRepository? repository = null,
            IGlossaryMatcherCache? cache = null)
        {
            settings["Salt"] = Convert.ToBase64String(Salt);
            var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();

            var secret = new Mock<ILocalizationSecret>();
            secret.SetupGet(s => s.AzureOpenAIEncryptedSecret).Returns(legacyKey ? Encrypt(PlainApiKey) : null);
            secret.SetupGet(s => s.AzureAIEncryptionKey).Returns(EncryptionKey);
            secret.SetupGet(s => s.AzureAIEndpoint).Returns(vaultEndpoint);

            return new AssistantService(new Mock<ILogger<AssistantService>>().Object, configuration, new HttpClient(), secret.Object,
                repository ?? EmptyRepository(), cache);
        }

        private static IGlossaryRepository EmptyRepository()
        {
            var repository = new Mock<IGlossaryRepository>();
            repository.Setup(r => r.GetGlobalAsync(It.IsAny<string>())).ReturnsAsync(new List<GlossaryModel>());
            return repository.Object;
        }

        private static Dictionary<string, string?> AzureSettings(ScriptedChatStub stub) => new()
        {
            ["AzureAIEndpoint"] = stub.BaseUrl + "/openai/deployments/d/chat/completions?api-version=2024-10-21",
            ["ChatGptTemperature"] = "0.2"
        };

        [Fact]
        public async Task Legacy_settings_send_an_api_key_header_no_bearer_no_model_and_the_system_prompt()
        {
            using var stub = new ScriptedChatStub(ScriptedChatStub.Completion("Hola"));

            var result = await Build(AzureSettings(stub)).AiCompletion(new AiCompletionRequest("Translate hello", 0.4));

            result.Should().Be("Hola");
            var request = stub.Requests.Should().ContainSingle().Subject;
            request.Path.Should().Be("/openai/deployments/d/chat/completions");
            request.Query.Should().Be("?api-version=2024-10-21");
            request.Headers["api-key"].Should().Be(PlainApiKey);
            request.Headers.Should().NotContainKey("authorization");
            request.Json.TryGetProperty("model", out _).Should().BeFalse("no model is configured and none is hard-coded");
            request.Json.GetProperty("temperature").GetDouble().Should().Be(0.4);
            var messages = request.Json.GetProperty("messages");
            messages[0].GetProperty("content").GetString().Should().Contain("translator for UI text");
            messages[1].GetProperty("content").GetString().Should().Be("Translate hello");
        }

        [Fact]
        public async Task The_vault_endpoint_is_used_when_configuration_has_none()
        {
            using var stub = new ScriptedChatStub(ScriptedChatStub.Completion("ok"));
            var settings = new Dictionary<string, string?> { ["ChatGptTemperature"] = "0.2" };

            await Build(settings, vaultEndpoint: stub.BaseUrl + "/vault/chat/completions").AiCompletion(new AiCompletionRequest("m", 0.2));

            stub.Requests.Single().Path.Should().Be("/vault/chat/completions");
        }

        [Fact]
        public async Task The_model_comes_from_the_Ai_section()
        {
            using var stub = new ScriptedChatStub(ScriptedChatStub.Completion("ok"));
            var settings = AzureSettings(stub);
            settings["Ai:Model"] = "configured-model";

            await Build(settings).AiCompletion(new AiCompletionRequest("m", 0.2));

            var body = stub.Requests.Single().Body;
            stub.Requests.Single().Json.GetProperty("model").GetString().Should().Be("configured-model");
            body.Should().NotContain("gpt-4o-mini");
        }

        [Fact]
        public async Task The_Ai_section_selects_openai_compatible_style_and_a_referenced_key()
        {
            using var stub = new ScriptedChatStub(ScriptedChatStub.Completion("Bonjour"));
            var settings = new Dictionary<string, string?>
            {
                ["Ai:Provider"] = "OpenAiCompatible",
                ["Ai:Endpoint"] = stub.BaseUrl + "/v1",
                ["Ai:Model"] = "local-model",
                ["Ai:ApiKeyReference"] = "Vault:AiKey",
                ["Vault:AiKey"] = PlainApiKey,
                ["Ai:Temperature"] = "0.1"
            };

            var result = await Build(settings, legacyKey: false).AiCompletion(new AiCompletionRequest("m", 0.1));

            result.Should().Be("Bonjour");
            var request = stub.Requests.Single();
            request.Path.Should().Be("/v1/chat/completions");
            request.Headers["authorization"].Should().Be("Bearer " + PlainApiKey);
            request.Headers.Should().NotContainKey("api-key");
            request.Json.GetProperty("model").GetString().Should().Be("local-model");
        }

        [Theory]
        [InlineData(401)]
        [InlineData(500)]
        public async Task An_error_response_gives_null(int status)
        {
            using var stub = new ScriptedChatStub(ScriptedChatStub.Error(status));

            (await Build(AzureSettings(stub)).AiCompletion(new AiCompletionRequest("m", 0.2))).Should().BeNull();
        }

        [Fact]
        public async Task A_429_sets_RetryAfter_on_the_request_from_azures_header()
        {
            using var stub = new ScriptedChatStub(ScriptedChatStub.Error(429, headers: new Dictionary<string, string> { ["retry-after-ms"] = "2500" }));
            var request = new AiCompletionRequest("m", 0.2);

            var result = await Build(AzureSettings(stub)).AiCompletion(request);

            result.Should().BeNull();
            request.RetryAfter.Should().Be(TimeSpan.FromMilliseconds(2500));
        }

        [Fact]
        public async Task A_missing_key_gives_null_without_a_request()
        {
            using var stub = new ScriptedChatStub(ScriptedChatStub.Completion("never"));

            (await Build(AzureSettings(stub), legacyKey: false).AiCompletion(new AiCompletionRequest("m", 0.2))).Should().BeNull();

            stub.Requests.Should().BeEmpty();
        }

        [Fact]
        public async Task SuggestTranslation_without_glossary_enforcement_runs_through_the_client()
        {
            TestBlocksContext.Set("stub-tenant");
            using var stub = new ScriptedChatStub(ScriptedChatStub.Completion("\"Hallo Welt\""));
            var service = Build(AzureSettings(stub));

            var result = await service.SuggestTranslation(new SuggestLanguageRequest
            {
                SourceText = "Hello world",
                CurrentLanguage = "English",
                DestinationLanguage = "German",
                Temperature = 0.1
            });

            result.Content.Should().Be("Hallo Welt");
            var prompt = stub.Requests.Single().Json.GetProperty("messages")[1].GetProperty("content").GetString();
            prompt.Should().Contain("Translate the following from English to German: 'Hello world'");
        }

        [Fact]
        public async Task SuggestTranslation_with_glossary_enforcement_corrects_through_the_client()
        {
            TestBlocksContext.Set("stub-tenant");
            using var stub = new ScriptedChatStub(
                ScriptedChatStub.Completion("Öffnen Sie Ihren Werkbereich", 50, 8),
                ScriptedChatStub.Completion("Öffnen Sie Ihren Arbeitsbereich", 70, 8));
            var settings = AzureSettings(stub);
            settings[GlossaryEnforcement.EnabledKey] = "true";
            var glossary = new BlocksGlossary
            {
                ItemId = "g1",
                Name = "Workspace",
                Context = "A shared area",
                IsGlobal = true,
                SchemaVersion = 2,
                Status = GlossaryStatus.Approved,
                Rule = GlossaryRule.Translate,
                Translations = new List<GlossaryTranslation>
                {
                    new() { Language = "de-DE", Value = "Arbeitsbereich", ForbiddenValues = new List<string> { "Werkbereich" } }
                }
            };
            var service = Build(settings, cache: new GlossaryMatcherCache(_ => Task.FromResult(new List<BlocksGlossary> { glossary })));

            var result = await service.SuggestTranslation(new SuggestLanguageRequest
            {
                SourceText = "Open your Workspace",
                CurrentLanguage = "English",
                CurrentLanguageCode = "en-US",
                DestinationLanguage = "German",
                DestinationLanguageCode = "de-DE",
                Temperature = 0.1
            });

            result.Content.Should().Be("Öffnen Sie Ihren Arbeitsbereich");
            stub.Requests.Should().HaveCount(2);
            stub.Requests[1].Json.GetProperty("messages")[1].GetProperty("content").GetString().Should().Contain("Werkbereich");
        }

        [Fact]
        public async Task Token_usage_of_each_response_is_recorded_as_a_metric()
        {
            var model = "assistant-metric-model-" + Guid.NewGuid().ToString("N");
            long prompt = 0, completion = 0;
            using var listener = new MeterListener();
            listener.InstrumentPublished = (instrument, l) =>
            {
                if (instrument.Meter.Name == "blocks.genesis.ai")
                    l.EnableMeasurementEvents(instrument);
            };
            listener.SetMeasurementEventCallback<long>((instrument, value, tags, _) =>
            {
                if (instrument.Name != "blocks.genesis.ai.tokens")
                    return;
                var t = tags.ToArray().ToDictionary(x => x.Key, x => x.Value?.ToString());
                if (t["model"] != model)
                    return;
                if (t["token_type"] == "prompt") Interlocked.Add(ref prompt, value);
                else if (t["token_type"] == "completion") Interlocked.Add(ref completion, value);
            });
            listener.Start();
            using var stub = new ScriptedChatStub(ScriptedChatStub.Completion("ok", 33, 6, model));

            await Build(AzureSettings(stub)).AiCompletion(new AiCompletionRequest("m", 0.2));

            prompt.Should().Be(33);
            completion.Should().Be(6);
        }
    }
}
