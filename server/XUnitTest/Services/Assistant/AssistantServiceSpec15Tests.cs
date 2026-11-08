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
    /// <summary>SPEC15 SV01, SV02, SV04, SV05, SV06, SV10 and SV17: placeholder guard, AI call budget, temperature.</summary>
    public class AssistantServiceSpec15Tests
    {
        private const string Heading = TerminologyPromptBuilder.RulesHeading;

        private readonly Mock<ILogger<AssistantService>> _logger = new();
        private readonly Mock<IGlossaryRepository> _repository = new();
        private readonly ManualTimeProvider _clock = new();

        public AssistantServiceSpec15Tests()
        {
            TestBlocksContext.Set("spec15-assistant");
            _repository.Setup(r => r.GetGlobalAsync(It.IsAny<string>())).ReturnsAsync(new List<GlossaryModel>());
        }

        /// <summary>AI fake: each call runs the next step (an answer, or a function of the call); null once the steps run out.</summary>
        private sealed class FakeAiService : AssistantService
        {
            private readonly Queue<Func<AiCompletionRequest, Task<string?>>> _steps;
            private readonly ManualTimeProvider _clock;
            public List<AiCompletionRequest> Calls { get; } = new();
            public List<TimeSpan> Delays { get; } = new();

            public FakeAiService(ILogger<AssistantService> logger, IConfiguration configuration, IGlossaryRepository repository,
                IGlossaryMatcherCache? cache, ManualTimeProvider clock, params Func<AiCompletionRequest, Task<string?>>[] steps)
                : base(logger, configuration, new HttpClient(), new Mock<ILocalizationSecret>().Object, repository, cache, clock)
            {
                _clock = clock;
                _steps = new Queue<Func<AiCompletionRequest, Task<string?>>>(steps);
            }

            public override async Task<string> AiCompletion(AiCompletionRequest request)
            {
                Calls.Add(request);
                return (_steps.Count > 0 ? await _steps.Dequeue()(request) : null)!;
            }

            protected override Task Delay(TimeSpan delay, CancellationToken cancellationToken)
            {
                Delays.Add(delay);
                _clock.Advance(delay);
                cancellationToken.ThrowIfCancellationRequested();
                return Task.CompletedTask;
            }
        }

        private static Func<AiCompletionRequest, Task<string?>> Answer(string? text) => _ => Task.FromResult(text);

        private Func<AiCompletionRequest, Task<string?>> AnswerAfter(TimeSpan took, string? text) => _ =>
        {
            _clock.Advance(took);
            return Task.FromResult(text);
        };

        private static IConfiguration Config(bool enabled, string? temperature = "0.1") => new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [GlossaryEnforcement.EnabledKey] = enabled ? "true" : "false",
                ["ChatGptTemperature"] = temperature
            })
            .Build();

        private static BlocksGlossary Workspace() => new()
        {
            ItemId = "g1",
            Name = "Workspace",
            IsGlobal = true,
            SchemaVersion = 2,
            Status = GlossaryStatus.Approved,
            Rule = GlossaryRule.Translate,
            Translations = new List<GlossaryTranslation>
            {
                new() { Language = "de-DE", Value = "Arbeitsbereich", ForbiddenValues = new List<string> { "Werkbereich" } }
            }
        };

        private static IGlossaryMatcherCache Cache(params BlocksGlossary[] glossaries) =>
            new GlossaryMatcherCache(_ => Task.FromResult(glossaries.ToList()));

        private static SuggestLanguageRequest Request(string source, double? temperature = null, string? context = null) => new()
        {
            SourceText = source,
            CurrentLanguage = "English",
            CurrentLanguageCode = "en-US",
            DestinationLanguage = "German",
            DestinationLanguageCode = "de-DE",
            ElementDetailContext = context,
            Temperature = temperature
        };

        private FakeAiService Service(bool enabled, params Func<AiCompletionRequest, Task<string?>>[] steps) =>
            new(_logger.Object, Config(enabled), _repository.Object, enabled ? Cache(Workspace()) : null, _clock, steps);

        // ---- SV02: placeholder tokens ----

        [Theory]
        [InlineData("Hello {user}", "Hallo {user}")]
        [InlineData("Id ${id}", "Kennung ${id}")]
        [InlineData("{count, number} items", "{count,number} Einträge")]
        [InlineData("{n, plural, one {# item} other {# items}}", "{n, plural, one {# Eintrag} other {# Einträge}}")]
        [InlineData("{n, plural, one {item} other {items}}", "{n, plural, one {Eintrag} other {Einträge}}")]
        [InlineData("<b>Save</b> now", "Jetzt <b>speichern</b>")]
        [InlineData("<a href=\"/help\">Help</a>", "<a href=\"/hilfe\" title=\"Hilfe\">Hilfe</a>")]
        [InlineData("Line<br />break", "Zeile<br/>umbruch")]
        [InlineData("%1$d of %2$s", "%2$s von %1$d")]
        [InlineData("100%% done", "100 % fertig")]
        [InlineData("Hello {{ name }}", "Hallo {{name}}")]
        public void Placeholders_kept_in_any_form_match(string source, string translated)
        {
            AssistantService.PlaceholdersMatch(source, translated).Should().BeTrue();
        }

        [Theory]
        [InlineData("Hello {user}", "Hallo {Benutzer}")]
        [InlineData("You have %d items", "Sie haben %s Elemente")]
        [InlineData("<b>Save</b>", "Speichern")]
        [InlineData("<b>Save</b>", "<i>Speichern</i>")]
        [InlineData("{count, plural, one {# item} other {# items}}", "{anzahl, plural, one {# Eintrag} other {# Einträge}}")]
        [InlineData("{role, select, admin {Admin} other {User}}", "{role, plural, admin {Admin} other {Benutzer}}")]
        [InlineData("Id ${id}", "Id {id}")]
        public void A_changed_placeholder_does_not_match(string source, string translated)
        {
            AssistantService.PlaceholdersMatch(source, translated).Should().BeFalse();
        }

        [Fact]
        public async Task H1_an_answer_that_keeps_every_placeholder_is_returned_after_one_call()
        {
            const string source = "Hi {user}, ${id}, {count, number}, <b>bold</b>, %1$d, {{name}}";
            var service = Service(false, Answer("Hallo {user}, ${id}, {count, number}, <b>fett</b>, %1$d, {{name}}"));

            var result = await service.SuggestTranslation(Request(source));

            service.Calls.Should().ContainSingle();
            result.Content.Should().StartWith("Hallo {user}");
        }

        [Fact]
        public async Task C1_C2_a_renamed_placeholder_gets_one_retry_then_is_dropped_and_logged_with_counts_only()
        {
            const string source = "Hello {user}, you have %d items";
            var service = Service(false, Answer("Hallo {Benutzer}, Sie haben %s Elemente"), Answer("Hallo {Benutzer}, Sie haben %s Elemente"), Answer("never used"));

            var result = await service.SuggestTranslation(Request(source));

            service.Calls.Should().HaveCount(2);
            result.Content.Should().BeNull();
            _logger.VerifyLog(LogLevel.Warning, "SuggestTranslation: placeholders changed in the translation (2 in the source, 2 in the translation); dropped");
            _logger.LoggedMessages().Should().NotContain(m => m.Contains("Hello") || m.Contains("Hallo") || m.Contains("{user}"));
        }

        [Fact]
        public async Task C2_a_retry_that_fixes_the_placeholder_is_used()
        {
            var service = Service(false, Answer("Hallo {Benutzer}"), Answer("Hallo {user}"));

            var result = await service.SuggestTranslation(Request("Hello {user}"));

            result.Content.Should().Be("Hallo {user}");
            service.Calls.Should().HaveCount(2);
        }

        [Theory]
        [InlineData("Save <b>now</b>", "Jetzt speichern")]
        [InlineData("{count, plural, one {# item} other {# items}}", "{anzahl, plural, one {# Eintrag} other {# Einträge}}")]
        public async Task C3_a_dropped_tag_or_changed_ICU_argument_is_retried_then_dropped(string source, string broken)
        {
            var service = Service(false, Answer(broken), Answer(broken));

            var result = await service.SuggestTranslation(Request(source));

            service.Calls.Should().HaveCount(2);
            result.Content.Should().BeNull();
        }

        // ---- SV04 / SV05: call budget and deadline ----

        [Fact]
        public async Task C4_violations_plus_two_placeholder_retries_make_at_most_four_calls()
        {
            const string source = "Open your Workspace {user}";
            var service = Service(true,
                Answer("Öffnen Sie Ihren Werkbereich {x}"),
                Answer("Öffnen Sie Ihren Werkbereich {user}"),
                Answer("Öffnen Sie Ihren Arbeitsbereich {y}"),
                Answer("Öffnen Sie Ihren Arbeitsbereich {z}"),
                Answer("never used"));

            var result = await service.SuggestTranslation(Request(source));

            service.Calls.Should().HaveCount(AssistantService.MaxAiCallsPerSuggestion);
            result.Content.Should().Be("Öffnen Sie Ihren Werkbereich {user}");
            result.GlossaryViolations.Should().ContainSingle(v => v.Kind == GlossaryViolationKinds.ForbiddenUsed);
            result.Validated.Should().BeTrue();
        }

        [Fact]
        public async Task C5_no_call_starts_after_the_deadline_and_the_first_valid_answer_is_returned()
        {
            var service = Service(true,
                AnswerAfter(TimeSpan.FromSeconds(31), "Öffnen Sie Ihren Werkbereich"),
                Answer("never used"));

            var result = await service.SuggestTranslation(Request("Open your Workspace"));

            service.Calls.Should().ContainSingle();
            result.Content.Should().Be("Öffnen Sie Ihren Werkbereich");
            result.GlossaryViolations.Should().NotBeEmpty();
            _logger.VerifyLog(LogLevel.Warning, "SuggestTranslation: stopped after 1 AI calls in 31000 ms (limit 30000 ms)");
        }

        [Fact]
        public async Task C5_a_call_in_flight_at_the_deadline_is_cancelled_and_no_content_is_returned()
        {
            CancellationToken seen = default;
            var service = Service(false, request =>
            {
                seen = request.CancellationToken;
                var pending = new TaskCompletionSource<string?>();
                request.CancellationToken.Register(() => pending.TrySetCanceled());
                _clock.Advance(AssistantService.SuggestionTimeLimit);
                return pending.Task;
            }, Answer("never used"));

            var result = await service.SuggestTranslation(Request("Save"));

            seen.IsCancellationRequested.Should().BeTrue();
            service.Calls.Should().ContainSingle();
            service.Delays.Should().BeEmpty();
            result.Content.Should().BeNull();
            _logger.VerifyLog(LogLevel.Warning, "SuggestTranslation: stopped after 1 AI calls in 30000 ms (limit 30000 ms)");
        }

        // A failed call (null: exception or non-200) is retried; a 200 with empty content is the model's answer
        // (blank source) and is not, so these use null for "the call failed".

        [Fact]
        public async Task Failed_call_retries_stop_at_the_deadline()
        {
            var service = Service(false,
                AnswerAfter(TimeSpan.FromSeconds(12), null),
                AnswerAfter(TimeSpan.FromSeconds(12), null),
                Answer("never used"));

            var result = await service.SuggestTranslation(Request("Save"));

            // 12 s + 5 s delay + 12 s = 29 s; the next 5 s delay ends past the 30 s limit.
            service.Calls.Should().HaveCount(2);
            result.Content.Should().BeNull();
        }

        [Fact]
        public async Task C6_a_failed_placeholder_retry_is_retried_as_a_failed_call()
        {
            var service = Service(false, Answer("Hallo {Benutzer}"), Answer(null), Answer(null), Answer("Hallo {user}"));

            var result = await service.SuggestTranslation(Request("Hello {user}"));

            result.Content.Should().Be("Hallo {user}");
            service.Calls.Should().HaveCount(4);
            service.Delays.Should().Equal(TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(5));
        }

        [Fact]
        public async Task Failed_call_retries_do_not_count_toward_the_four_calls()
        {
            var service = Service(false, Answer(null), Answer(null), Answer("Speichern"));

            var result = await service.SuggestTranslation(Request("Save"));

            result.Content.Should().Be("Speichern");
            service.Calls.Should().HaveCount(3);
        }

        [Fact]
        public async Task An_empty_answer_is_final_and_not_retried()
        {
            var service = Service(false, Answer(""), Answer("never used"));

            var result = await service.SuggestTranslation(Request("Save"));

            result.Content.Should().BeNull();
            service.Calls.Should().ContainSingle();
            service.Delays.Should().BeEmpty();
        }

        // ---- SV06 ----

        [Fact]
        public async Task H3_a_context_without_a_rules_heading_gets_exactly_one()
        {
            var service = Service(true, Answer("Öffnen Sie Ihren Arbeitsbereich"));

            await service.SuggestTranslation(Request("Open your Workspace", context: "Button label on the dashboard"));

            var prompt = service.Calls.Single().Message;
            prompt.Split(Heading).Length.Should().Be(2);
        }

        // ---- SV10: Validated ----

        [Fact]
        public async Task Only_a_validated_answer_is_marked_validated()
        {
            var validated = await Service(true, Answer("Öffnen Sie Ihren Arbeitsbereich")).SuggestTranslation(Request("Open your Workspace"));
            var legacy = await Service(false, Answer("Öffnen Sie Ihren Arbeitsbereich")).SuggestTranslation(Request("Open your Workspace"));
            var empty = await Service(true, Answer("   ")).SuggestTranslation(Request("Open your Workspace"));

            validated.Validated.Should().BeTrue();
            legacy.Validated.Should().BeFalse();
            empty.Validated.Should().BeFalse();
        }

        // ---- SV17: temperature ----

        [Fact]
        public async Task H13_a_request_without_temperature_uses_the_configured_value()
        {
            var service = Service(false, Answer("Speichern"));

            await service.SuggestTranslation(Request("Save", temperature: null));

            service.Calls.Single().Temperature.Should().Be(0.1);
        }

        [Theory]
        [InlineData(0.5)]
        [InlineData(0.0)]
        public async Task H14_an_explicit_temperature_is_sent_as_is(double temperature)
        {
            var service = Service(false, Answer("Speichern"));

            await service.SuggestTranslation(Request("Save", temperature));

            service.Calls.Single().Temperature.Should().Be(temperature);
        }

        [Fact]
        public void A_missing_temperature_binds_to_null()
        {
            var request = Newtonsoft.Json.JsonConvert.DeserializeObject<SuggestLanguageRequest>("{\"sourceText\":\"Save\"}")!;
            var zero = Newtonsoft.Json.JsonConvert.DeserializeObject<SuggestLanguageRequest>("{\"sourceText\":\"Save\",\"temperature\":0}")!;

            request.Temperature.Should().BeNull();
            zero.Temperature.Should().Be(0);
        }

        [Fact]
        public async Task The_configured_temperature_is_parsed_the_same_on_a_German_host()
        {
            var culture = System.Globalization.CultureInfo.CurrentCulture;
            System.Globalization.CultureInfo.CurrentCulture = new System.Globalization.CultureInfo("de-DE");
            try
            {
                var service = Service(false, Answer("Speichern"));

                await service.SuggestTranslation(Request("Save"));

                service.Calls.Single().Temperature.Should().Be(0.1);
            }
            finally
            {
                System.Globalization.CultureInfo.CurrentCulture = culture;
            }
        }

    }
}
