using System.Collections.Concurrent;
using System.Net;
using System.Text;
using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared.Entities;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Moq.Protected;
using Xunit;
using XUnitTest.Shared;
using GlossaryModel = Eurolm.DomainService.Services.Glossary;

namespace XUnitTest.Services.Assistant
{
    /// <summary>Per-call time limit, 429 Retry-After, and the cap on AI suggestions running at once.</summary>
    public class AssistantServiceThroughputTests
    {
        private readonly Mock<ILogger<AssistantService>> _logger = new();
        private readonly Mock<IGlossaryRepository> _repository = new();
        private readonly ManualTimeProvider _clock = new();

        public AssistantServiceThroughputTests()
        {
            TestBlocksContext.Set("throughput-tenant");
            _repository.Setup(r => r.GetGlobalAsync(It.IsAny<string>())).ReturnsAsync(new List<GlossaryModel>());
        }

        private static IConfiguration Config(params (string Key, string? Value)[] values)
        {
            var settings = new Dictionary<string, string?> { ["ChatGptTemperature"] = "0.1" };
            foreach (var (key, value) in values) settings[key] = value;
            return new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        }

        private static SuggestLanguageRequest Request(string source = "Save") => new()
        {
            SourceText = source,
            CurrentLanguage = "English",
            CurrentLanguageCode = "en-US",
            DestinationLanguage = "German",
            DestinationLanguageCode = "de-DE"
        };

        /// <summary>AI fake: each call runs the next step; null once the steps run out.</summary>
        private sealed class StepAiService : AssistantService
        {
            private readonly Queue<Func<AiCompletionRequest, Task<string?>>> _steps;
            private readonly ManualTimeProvider _clock;
            public List<AiCompletionRequest> Calls { get; } = new();
            public List<TimeSpan> Delays { get; } = new();

            public StepAiService(ILogger<AssistantService> logger, IConfiguration configuration, IGlossaryRepository repository,
                ManualTimeProvider clock, params Func<AiCompletionRequest, Task<string?>>[] steps)
                : base(logger, configuration, new HttpClient(), new Mock<ILocalizationSecret>().Object, repository, null, clock)
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

        private StepAiService Service(params Func<AiCompletionRequest, Task<string?>>[] steps) =>
            new(_logger.Object, Config(), _repository.Object, _clock, steps);

        private static Func<AiCompletionRequest, Task<string?>> Answer(string? text) => _ => Task.FromResult(text);

        // ---- per-call time limit ----

        [Fact]
        public async Task A_hung_call_is_cancelled_at_the_per_call_limit_and_retried_within_the_budget()
        {
            CancellationToken seen = default;
            var service = Service(request =>
            {
                seen = request.CancellationToken;
                var pending = new TaskCompletionSource<string?>();
                request.CancellationToken.Register(() => pending.TrySetCanceled());
                _clock.Advance(AssistantService.DefaultAttemptTimeLimit);
                return pending.Task;
            }, Answer("Speichern"));

            var result = await service.SuggestTranslation(Request());

            seen.IsCancellationRequested.Should().BeTrue();
            result.Content.Should().Be("Speichern");
            service.Calls.Should().HaveCount(2);
            service.Delays.Should().Equal(TimeSpan.FromSeconds(5));
            _logger.VerifyLog(LogLevel.Warning, "SuggestTranslation: an AI call got no answer within 10000 ms; cancelled and retried");
            _logger.LoggedMessages().Should().NotContain(m => m.StartsWith("SuggestTranslation: stopped after"));
        }

        [Fact]
        public async Task Each_call_gets_its_own_cancellation_so_a_retry_starts_uncancelled()
        {
            var service = Service(request =>
            {
                var pending = new TaskCompletionSource<string?>();
                request.CancellationToken.Register(() => pending.TrySetCanceled());
                _clock.Advance(AssistantService.DefaultAttemptTimeLimit);
                return pending.Task;
            }, Answer("Speichern"));

            await service.SuggestTranslation(Request());

            service.Calls[1].CancellationToken.IsCancellationRequested.Should().BeFalse();
            service.Calls[0].Should().NotBeSameAs(service.Calls[1]);
            service.Calls[1].Message.Should().Be(service.Calls[0].Message);
        }

        [Theory]
        [InlineData(null, 10)]
        [InlineData("4", 4)]
        [InlineData("0", 1)]
        [InlineData("120", 30)]
        [InlineData("abc", 10)]
        public void The_per_call_limit_comes_from_configuration_within_1_to_30_seconds(string? configured, int expectedSeconds)
        {
            var service = new StepAiService(_logger.Object, Config((AssistantService.AttemptTimeoutKey, configured)), _repository.Object, _clock);

            service.AttemptTimeLimit.Should().Be(TimeSpan.FromSeconds(expectedSeconds));
        }

        // ---- 429 Retry-After ----

        [Theory]
        [InlineData(8, 8)]
        [InlineData(2, 5)]
        [InlineData(60, 20)]
        public async Task A_throttled_call_waits_the_retry_after_at_least_5_s_and_at_most_20_s(int retryAfterSeconds, int expectedDelaySeconds)
        {
            var service = Service(request =>
            {
                request.RetryAfter = TimeSpan.FromSeconds(retryAfterSeconds);
                return Task.FromResult<string?>(null);
            }, Answer("Speichern"));

            var result = await service.SuggestTranslation(Request());

            result.Content.Should().Be("Speichern");
            service.Delays.Should().Equal(TimeSpan.FromSeconds(expectedDelaySeconds));
        }

        [Fact]
        public async Task MakeRequestAsync_reads_azures_retry_after_ms_from_a_429()
        {
            var handler = new Mock<HttpMessageHandler>();
            var throttled = new HttpResponseMessage(HttpStatusCode.TooManyRequests) { Content = new StringContent("{}", Encoding.UTF8, "application/json") };
            throttled.Headers.TryAddWithoutValidation("retry-after-ms", "7500");
            handler.Protected()
                .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(throttled);
            var service = new AssistantService(_logger.Object, Config(), new HttpClient(handler.Object),
                new Mock<ILocalizationSecret>().Object, _repository.Object);

            var response = await service.MakeRequestAsync(
                AssistantService.PrepareHttpRequest("https://example.test/chat", HttpMethod.Post, "{}"), "secret");

            response.HttpStatusCode.Should().Be(HttpStatusCode.TooManyRequests);
            response.RetryAfter.Should().Be(TimeSpan.FromMilliseconds(7500));
        }

        [Fact]
        public void ReadRetryAfter_falls_back_to_the_standard_header_and_is_null_when_absent()
        {
            var now = new DateTimeOffset(2026, 11, 8, 10, 0, 0, TimeSpan.Zero);

            var seconds = new HttpResponseMessage(HttpStatusCode.TooManyRequests);
            seconds.Headers.RetryAfter = new System.Net.Http.Headers.RetryConditionHeaderValue(TimeSpan.FromSeconds(12));
            AssistantService.ReadRetryAfter(seconds, now).Should().Be(TimeSpan.FromSeconds(12));

            var date = new HttpResponseMessage(HttpStatusCode.TooManyRequests);
            date.Headers.RetryAfter = new System.Net.Http.Headers.RetryConditionHeaderValue(now.AddSeconds(9));
            AssistantService.ReadRetryAfter(date, now).Should().Be(TimeSpan.FromSeconds(9));

            AssistantService.ReadRetryAfter(new HttpResponseMessage(HttpStatusCode.TooManyRequests), now).Should().BeNull();
        }

        // ---- the cap on suggestions at once ----

        /// <summary>AI fake that holds every call until released, counting how many are in flight.</summary>
        private sealed class HeldAiService : AssistantService
        {
            private int _inFlight;
            public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
            public int MaxInFlight;
            public int Started;
            public ConcurrentBag<string?> Tenants { get; } = new();

            public HeldAiService(ILogger<AssistantService> logger, IConfiguration configuration, IGlossaryRepository repository, TimeProvider clock)
                : base(logger, configuration, new HttpClient(), new Mock<ILocalizationSecret>().Object, repository, null, clock) { }

            public int InFlight => Volatile.Read(ref _inFlight);

            public override async Task<string> AiCompletion(AiCompletionRequest request)
            {
                Interlocked.Increment(ref Started);
                Tenants.Add(BlocksContext.GetContext()?.TenantId);
                var now = Interlocked.Increment(ref _inFlight);
                int max;
                while (now > (max = Volatile.Read(ref MaxInFlight)) && Interlocked.CompareExchange(ref MaxInFlight, now, max) != max) { }
                await Release.Task;
                Interlocked.Decrement(ref _inFlight);
                return "Speichern";
            }
        }

        [Fact]
        public async Task No_more_than_the_configured_number_of_suggestions_run_at_once_and_the_rest_wait_their_turn()
        {
            var service = new HeldAiService(_logger.Object, Config((AssistantService.MaxConcurrencyKey, "2")), _repository.Object, _clock);

            var suggestions = Enumerable.Range(0, 5).Select(i => service.SuggestTranslation(Request($"Save {i}"))).ToList();
            await WaitUntil(() => service.InFlight == 2);

            service.Started.Should().Be(2);
            service.Release.SetResult();
            var results = await Task.WhenAll(suggestions);

            results.Should().OnlyContain(r => r.Content == "Speichern");
            service.Started.Should().Be(5);
            service.MaxInFlight.Should().Be(2);
            service.Tenants.Should().OnlyContain(t => t == "throughput-tenant");
        }

        [Fact]
        public async Task Waiting_for_a_turn_does_not_use_up_the_time_budget()
        {
            var service = new HeldAiService(_logger.Object, Config((AssistantService.MaxConcurrencyKey, "1")), _repository.Object, _clock);

            var first = service.SuggestTranslation(Request("Save"));
            var queued = service.SuggestTranslation(Request("Open"));
            await WaitUntil(() => service.InFlight == 1);

            // The queued suggestion waits longer than the whole budget, then still gets its answer.
            _clock.Advance(AssistantService.SuggestionTimeLimit + TimeSpan.FromSeconds(5));
            service.Release.SetResult();

            (await first).Content.Should().BeNull("the call in flight passed its deadline");
            (await queued).Content.Should().Be("Speichern");
        }

        [Theory]
        [InlineData(null, 8)]
        [InlineData("16", 16)]
        [InlineData("0", 1)]
        [InlineData("500", 64)]
        public void The_cap_comes_from_configuration_within_1_to_64(string? configured, int expected)
        {
            var service = new StepAiService(_logger.Object, Config((AssistantService.MaxConcurrencyKey, configured)), _repository.Object, _clock);

            service.MaxConcurrency.Should().Be(expected);
        }

        [Fact]
        public void AddAssistantService_registers_one_singleton_with_its_named_client()
        {
            var services = new ServiceCollection();
            services.AddLogging();
            services.AddSingleton(Config());
            services.AddSingleton(new Mock<ILocalizationSecret>().Object);
            services.AddSingleton(_repository.Object);

            services.AddAssistantService();
            using var provider = services.BuildServiceProvider();

            services.Single(d => d.ServiceType == typeof(IAssistantService)).Lifetime.Should().Be(ServiceLifetime.Singleton);
            var first = provider.GetRequiredService<IAssistantService>();
            first.Should().BeOfType<AssistantService>();
            provider.GetRequiredService<IAssistantService>().Should().BeSameAs(first);
        }

        private static async Task WaitUntil(Func<bool> condition)
        {
            var deadline = DateTime.UtcNow.AddSeconds(5);
            while (!condition())
            {
                if (DateTime.UtcNow > deadline) throw new TimeoutException("condition not reached");
                await Task.Delay(10);
            }
        }
    }
}
