using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Shared.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Polly.CircuitBreaker;
using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Eurolm.DomainService.Services
{
    public class AssistantService : IAssistantService
    {
        public const int MaxAiCallsPerSuggestion = 4;
        public static readonly TimeSpan SuggestionTimeLimit = TimeSpan.FromSeconds(30);
        private static readonly TimeSpan FailureRetryDelay = TimeSpan.FromSeconds(5);
        private const int MaxFailureRetries = 3;

        /// <summary>Named HttpClient for Azure OpenAI; see <see cref="AssistantServiceRegistration"/>.</summary>
        public const string HttpClientName = "AzureOpenAI";

        /// <summary>Configuration key: AI suggestions this process runs at once (default 8, 1 to 64).</summary>
        public const string MaxConcurrencyKey = "TranslationMaxConcurrency";
        public const int DefaultMaxConcurrency = 8;

        /// <summary>Configuration key: seconds one AI call may take before it is cancelled and retried (default 10, 1 to 30).</summary>
        public const string AttemptTimeoutKey = "TranslationAttemptTimeoutSeconds";
        public static readonly TimeSpan DefaultAttemptTimeLimit = TimeSpan.FromSeconds(10);

        /// <summary>Longest wait taken from a 429 Retry-After, for the retry and for the pause of new suggestions.</summary>
        public static readonly TimeSpan MaxThrottleWait = TimeSpan.FromSeconds(20);

        private readonly ILogger<AssistantService> _logger;
        private readonly IConfiguration _configuration;
        private readonly string _chatGptTemperature;
        private readonly HttpClient _httpClient;
        private readonly ILocalizationSecret _localizationSecret;
        private readonly IGlossaryRepository _glossaryRepository;
        private readonly IGlossaryMatcherCache? _matcherCache;
        private readonly TimeProvider _timeProvider;
        private readonly SemaphoreSlim _gate;
        private readonly TimeSpan _attemptTimeLimit;
        private long _throttledUntilUtcTicks;

        public int MaxConcurrency { get; }
        public TimeSpan AttemptTimeLimit => _attemptTimeLimit;
        public AssistantService(
            ILogger<AssistantService> logger,
            IConfiguration configuration,
            HttpClient httpClient,
            ILocalizationSecret localizationSecret,
            IGlossaryRepository glossaryRepository,
            IGlossaryMatcherCache? matcherCache = null,
            TimeProvider? timeProvider = null
        )
        {
            _localizationSecret = localizationSecret;
            _logger = logger;
            _configuration = configuration;
            _chatGptTemperature = _configuration["ChatGptTemperature"];
            _httpClient = httpClient;
            _glossaryRepository = glossaryRepository;
            _matcherCache = matcherCache;
            _timeProvider = timeProvider ?? TimeProvider.System;
            MaxConcurrency = ReadInt(_configuration?[MaxConcurrencyKey], DefaultMaxConcurrency, 1, 64);
            _attemptTimeLimit = TimeSpan.FromSeconds(ReadInt(_configuration?[AttemptTimeoutKey], (int)DefaultAttemptTimeLimit.TotalSeconds, 1, 30));
            _gate = new SemaphoreSlim(MaxConcurrency, MaxConcurrency);
        }

        public async Task<SuggestionResult> SuggestTranslation(SuggestLanguageRequest query)
        {
            // Blank source: the system prompt makes the model answer "", so skip the paid call.
            if (string.IsNullOrWhiteSpace(query.SourceText))
            {
                return new SuggestionResult();
            }

            // Callers may start many suggestions at once (Translate All); the gate caps the calls in flight
            // across them. The time budget starts only once a slot is held, so queueing never uses it up.
            await _gate.WaitAsync();
            try
            {
                await WaitWhileThrottledAsync();

                using var budget = new SuggestionBudget(_timeProvider);
                try
                {
                    return await SuggestTranslation(query, budget);
                }
                finally
                {
                    if (budget.Stopped)
                        _logger.LogWarning("SuggestTranslation: stopped after {CallCount} AI calls in {ElapsedMs} ms (limit {LimitMs} ms)",
                            budget.CallCount, (long)budget.Elapsed.TotalMilliseconds, (long)SuggestionTimeLimit.TotalMilliseconds);
                }
            }
            finally
            {
                _gate.Release();
            }
        }

        private static int ReadInt(string? value, int fallback, int min, int max) =>
            int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed)
                ? Math.Clamp(parsed, min, max)
                : fallback;

        /// <summary>After a 429, new suggestions wait out the Retry-After instead of adding to the throttling.</summary>
        private async Task WaitWhileThrottledAsync()
        {
            var until = Interlocked.Read(ref _throttledUntilUtcTicks);
            if (until == 0) return;
            var wait = new DateTimeOffset(until, TimeSpan.Zero) - _timeProvider.GetUtcNow();
            if (wait > TimeSpan.Zero)
                await Delay(wait, CancellationToken.None);
        }

        private void NoteThrottled(TimeSpan retryAfter)
        {
            var wait = retryAfter > MaxThrottleWait ? MaxThrottleWait : retryAfter;
            var until = (_timeProvider.GetUtcNow() + wait).UtcTicks;
            long current;
            do
            {
                current = Interlocked.Read(ref _throttledUntilUtcTicks);
                if (current >= until) return;
            } while (Interlocked.CompareExchange(ref _throttledUntilUtcTicks, until, current) != current);
        }

        private async Task<SuggestionResult> SuggestTranslation(SuggestLanguageRequest query, SuggestionBudget budget)
        {
            if (!GlossaryEnforcement.IsEnabled(_configuration) || _matcherCache == null)
            {
                return new SuggestionResult { Content = await SuggestLegacyAsync(query, budget) };
            }

            TerminologyPrompt prompt;
            try
            {
                var matcher = await _matcherCache.GetAsync(BlocksContext.GetContext()?.TenantId ?? "");
                var matches = matcher.Match(query.SourceText ?? "", new MatchOptions
                {
                    SourceCulture = query.CurrentLanguageCode,
                    KeyGlossaryIds = query.GlossaryIds,
                    ModuleId = query.ModuleId,
                    Mode = GlossaryScopeMode.Applicable,
                    ApprovedOnly = true
                });
                prompt = TerminologyPromptBuilder.Build(query, matches);
            }
            catch (Exception ex)
            {
                // Degrade to today's prompt; the log carries no source text or glossary content.
                _logger.LogWarning(ex, "SuggestTranslation: glossary matching failed, using the legacy prompt path");
                return new SuggestionResult { Content = await SuggestLegacyAsync(query, budget) };
            }

            if (prompt.MissingTranslations.Count > 0)
            {
                // Translate All runs here too: this is the only trace of glossaries it could not apply.
                _logger.LogInformation("SuggestTranslation: {MissingCount} matched glossaries have no {Culture} translation",
                    prompt.MissingTranslations.Count, query.DestinationLanguageCode);
            }

            var first = await CompleteAsync(prompt.Prompt, query, budget);
            if (first == null)
                return new SuggestionResult { AppliedTerms = prompt.AppliedTerms, MissingGlossaryTranslations = prompt.MissingTranslations };

            var violations = TranslationValidator.Validate(first, query.DestinationLanguageCode, prompt.RuleMatches);
            if (violations.Count == 0)
                return new SuggestionResult { Content = first, Validated = true, AppliedTerms = prompt.AppliedTerms, MissingGlossaryTranslations = prompt.MissingTranslations };

            // One correction attempt at most; if it fails or comes back empty, keep the first answer.
            var corrected = await CompleteAsync(TerminologyPromptBuilder.BuildCorrection(prompt, violations), query, budget);
            _logger.LogInformation("SuggestTranslation: correction attempt made for {ViolationCount} glossary violations, succeeded: {Succeeded}",
                violations.Count, corrected != null);
            if (corrected == null)
                return new SuggestionResult
                {
                    Content = first,
                    Validated = true,
                    AppliedTerms = prompt.AppliedTerms,
                    GlossaryViolations = violations,
                    MissingGlossaryTranslations = prompt.MissingTranslations
                };

            return new SuggestionResult
            {
                Content = corrected,
                Validated = true,
                AppliedTerms = prompt.AppliedTerms,
                MissingGlossaryTranslations = prompt.MissingTranslations,
                GlossaryViolations = TranslationValidator.Validate(corrected, query.DestinationLanguageCode, prompt.RuleMatches)
            };
        }

        private async Task<string?> SuggestLegacyAsync(SuggestLanguageRequest query, SuggestionBudget budget)
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

            return await CompleteAsync(context, query, budget);
        }

        /// <summary>
        /// One logical AI attempt: the completion with failure retries (up to 3, 5 s apart), formatted.
        /// Returns null when every try failed, the model answered empty, or formatting left nothing.
        /// </summary>
        private async Task<string?> CompleteAsync(string context, SuggestLanguageRequest query, SuggestionBudget budget)
        {
            var aiCompletionRequest = new AiCompletionRequest(context, ResolveTemperature(query)) { CancellationToken = budget.Token };

            var output = await CompleteWithFailureRetriesAsync(aiCompletionRequest, query, budget);
            if (output == null || PlaceholdersMatch(query.SourceText, output))
                return output;

            var retried = await CompleteWithFailureRetriesAsync(aiCompletionRequest, query, budget);
            if (retried == null)
                return null;
            if (!PlaceholdersMatch(query.SourceText, retried))
            {
                _logger.LogWarning("SuggestTranslation: placeholders changed in the translation ({SourcePlaceholderCount} in the source, {TranslationPlaceholderCount} in the translation); dropped",
                    PlaceholderMask.GetTokens(query.SourceText).Count, PlaceholderMask.GetTokens(retried).Count);
                return null;
            }

            return retried;
        }

        private async Task<string?> CompleteWithFailureRetriesAsync(AiCompletionRequest aiCompletionRequest, SuggestLanguageRequest query, SuggestionBudget budget)
        {
            if (!budget.TryStartCall())
                return null;

            var call = await CallAiAsync(aiCompletionRequest, budget);
            var aiText = call.Text;

            // AiCompletion returns null on failure (exception, non-200 or the per-call time limit). A 200 with
            // empty content is the model's answer, and asking again gets the same answer, so only null is retried.
            var retryCount = 0;
            while (aiText == null && retryCount < MaxFailureRetries)
            {
                if (!await DelayAsync(RetryDelay(call.RetryAfter), budget))
                    return null;

                call = await CallAiAsync(aiCompletionRequest, budget);
                aiText = call.Text;
                retryCount++;
            }
            if (aiText == null)
            {
                if (!budget.Stopped)
                    _logger.LogError("SuggestTranslation -> CallAiCompletion: Maximum Retry count reached");
                return null;
            }
            if (aiText.Length == 0)
            {
                _logger.LogWarning("SuggestTranslation: the AI returned an empty translation; not retried");
                return null;
            }

            var output = FormatAiTextForSuggestTranslation(aiText, query.SourceText);
            if (string.IsNullOrWhiteSpace(output))
            {
                // The AI text stays out of the log: logs carry counts and ids only, never translations.
                _logger.LogWarning("SuggestTranslation: formatting produced empty output for an AI text of {AiTextLength} characters", aiText.Length);
                return null;
            }

            return output;
        }

        /// <summary>The failure retry waits 5 s, or the 429 Retry-After when longer (at most <see cref="MaxThrottleWait"/>).</summary>
        private static TimeSpan RetryDelay(TimeSpan? retryAfter)
        {
            if (retryAfter is not { } wait || wait <= FailureRetryDelay)
                return FailureRetryDelay;

            return wait > MaxThrottleWait ? MaxThrottleWait : wait;
        }

        private readonly record struct AiCallResult(string? Text, TimeSpan? RetryAfter);

        /// <summary>
        /// One AI call, cancelled at the per-call limit (a hung connection then fails fast and is retried
        /// instead of using up the whole suggestion budget) or at the suggestion deadline.
        /// </summary>
        private async Task<AiCallResult> CallAiAsync(AiCompletionRequest template, SuggestionBudget budget)
        {
            if (budget.Expired)
                return default;

            using var attemptLimit = new CancellationTokenSource(_attemptTimeLimit, _timeProvider);
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(budget.Token, attemptLimit.Token);
            var request = new AiCompletionRequest(template.Message, template.Temperature) { CancellationToken = linked.Token };
            try
            {
                var text = await AiCompletion(request).WaitAsync(linked.Token);
                return new AiCallResult(text, request.RetryAfter);
            }
            catch (OperationCanceledException) when (budget.Token.IsCancellationRequested)
            {
                budget.Stop();
                return default;
            }
            catch (OperationCanceledException ex) when (attemptLimit.Token.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "SuggestTranslation: an AI call got no answer within {AttemptLimitMs} ms; cancelled and retried",
                    (long)_attemptTimeLimit.TotalMilliseconds);
                return default;
            }
        }

        private async Task<bool> DelayAsync(TimeSpan delay, SuggestionBudget budget)
        {
            if (budget.Expired)
                return false;
            try
            {
                await Delay(delay, budget.Token);
                return !budget.Expired;
            }
            catch (OperationCanceledException) when (budget.Token.IsCancellationRequested)
            {
                budget.Stop();
                return false;
            }
        }

        protected virtual Task Delay(TimeSpan delay, CancellationToken cancellationToken) =>
            Task.Delay(delay, _timeProvider, cancellationToken);

        private double ResolveTemperature(SuggestLanguageRequest query)
        {
            if (query.Temperature.HasValue)
                return query.Temperature.Value;
            return double.TryParse(_chatGptTemperature, NumberStyles.Float, CultureInfo.InvariantCulture, out var temperature) ? temperature : 0;
        }

        private sealed class SuggestionBudget : IDisposable
        {
            private readonly TimeProvider _timeProvider;
            private readonly CancellationTokenSource _deadline;
            private long? _startedAt;

            public SuggestionBudget(TimeProvider timeProvider)
            {
                _timeProvider = timeProvider;
                _deadline = new CancellationTokenSource(Timeout.InfiniteTimeSpan, timeProvider);
            }

            public int CallCount { get; private set; }
            public bool Stopped { get; private set; }
            public CancellationToken Token => _deadline.Token;
            public TimeSpan Elapsed => _startedAt.HasValue ? _timeProvider.GetElapsedTime(_startedAt.Value) : TimeSpan.Zero;

            public bool Expired
            {
                get
                {
                    if (!_deadline.IsCancellationRequested && (!_startedAt.HasValue || Elapsed < SuggestionTimeLimit))
                        return false;
                    Stop();
                    return true;
                }
            }

            public bool TryStartCall()
            {
                if (Expired || CallCount >= MaxAiCallsPerSuggestion)
                {
                    Stop();
                    return false;
                }
                if (!_startedAt.HasValue)
                {
                    _startedAt = _timeProvider.GetTimestamp();
                    _deadline.CancelAfter(SuggestionTimeLimit);
                }
                CallCount++;
                return true;
            }

            public void Stop() => Stopped = true;

            public void Dispose() => _deadline.Dispose();
        }

        private static readonly Regex PlaceholderPattern = new(@"\{\{\s*(\w+)\s*\}\}", RegexOptions.Compiled, TimeSpan.FromSeconds(1));

        /// <summary>The <c>{{name}}</c> placeholders of a text, sorted (a name used twice appears twice).</summary>
        public static List<string> GetPlaceholders(string? text) =>
            string.IsNullOrEmpty(text)
                ? new List<string>()
                : PlaceholderPattern.Matches(text).Select(m => m.Groups[1].Value).OrderBy(n => n, StringComparer.Ordinal).ToList();

        /// <summary>True when the translation keeps exactly the source's placeholders (order may change).</summary>
        public static bool PlaceholdersMatch(string? sourceText, string? translatedText) =>
            !string.IsNullOrWhiteSpace(translatedText) &&
            PlaceholderMask.GetTokens(sourceText).SequenceEqual(PlaceholderMask.GetTokens(translatedText));

        public static string GenerateSuggestTranslationContext(SuggestLanguageRequest request, string? glossaryContext = null)
        {
            var context = !string.IsNullOrWhiteSpace(request.ElementDetailContext) ? request.ElementDetailContext :
                $"The requirement is to translate a user interface element of a webpage. Output only the translated text (no quotes, no explanation).";
            if (!string.IsNullOrWhiteSpace(glossaryContext))
            {
                context += $"\n{glossaryContext}\n";
            }
            var placeholders = GetPlaceholders(request.SourceText).Distinct().Select(n => $"{{{{{n}}}}}").ToList();
            if (placeholders.Count > 0)
            {
                context += $"Keep these placeholders exactly as written, untranslated: {string.Join(", ", placeholders)}.\n";
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

        public virtual async Task<string> AiCompletion(AiCompletionRequest request)
        {
            try
            {
                double.TryParse(_chatGptTemperature, NumberStyles.Float, CultureInfo.InvariantCulture, out var temperature);
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
                var httpResponse = await MakeRequestAsync(httpRequest, secret, request.CancellationToken);

                if (httpResponse != null && httpResponse.HttpStatusCode == HttpStatusCode.OK)
                {
                    ChatGptAiCompletionRequestResponse respone = JsonConvert.DeserializeObject<ChatGptAiCompletionRequestResponse>(httpResponse.ResponseData);
                    var responeMessage = respone.choices?.FirstOrDefault()?.message?.content;
                    return responeMessage;
                }

                if (httpResponse?.HttpStatusCode == HttpStatusCode.TooManyRequests)
                {
                    request.RetryAfter = httpResponse.RetryAfter;
                    NoteThrottled(httpResponse.RetryAfter ?? FailureRetryDelay);
                    _logger.LogWarning("AiCompletion: Azure OpenAI throttled the request (429); Retry-After {RetryAfterMs} ms",
                        (long?)httpResponse.RetryAfter?.TotalMilliseconds);
                }

            }
            catch (OperationCanceledException) when (request.CancellationToken.IsCancellationRequested)
            {
                // Cancelled by the per-call or per-suggestion time limit: CallAiAsync logs that once, with no stack trace.
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

        public async Task<RestResponse> MakeRequestAsync(HttpRequestMessage httpRequestMessage, string secret, CancellationToken cancellationToken = default)
        {
            var response = new RestResponse();
            var requestResponse = new HttpResponseMessage();

            try
            {
                var endpointHost = httpRequestMessage.RequestUri?.Host;
                _logger.LogInformation("Started processing the API request. MethodType: {MethodType}, EndpointHost: {EndpointHost}",
                    httpRequestMessage.Method, endpointHost);

                ApplyApiKeyHeader(httpRequestMessage, secret);

                requestResponse = await _httpClient.SendAsync(httpRequestMessage, cancellationToken);

                response.HttpStatusCode = requestResponse.StatusCode;
                response.RetryAfter = ReadRetryAfter(requestResponse, _timeProvider.GetUtcNow());
                response.ResponseData = await requestResponse.Content.ReadAsStringAsync(cancellationToken);

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

        /// <summary>Azure's <c>retry-after-ms</c>, else the standard Retry-After (seconds or a date); null when absent.</summary>
        public static TimeSpan? ReadRetryAfter(HttpResponseMessage response, DateTimeOffset now)
        {
            if (response.Headers.TryGetValues("retry-after-ms", out var values) &&
                double.TryParse(values.FirstOrDefault(), NumberStyles.Float, CultureInfo.InvariantCulture, out var ms) && ms > 0)
            {
                return TimeSpan.FromMilliseconds(ms);
            }

            var retryAfter = response.Headers.RetryAfter;
            if (retryAfter?.Delta is { } delta && delta > TimeSpan.Zero)
                return delta;
            if (retryAfter?.Date is { } date && date > now)
                return date - now;
            return null;
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
