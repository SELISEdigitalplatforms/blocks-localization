using System.Diagnostics;
using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared.Events;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;
using Xunit.Abstractions;

namespace XUnitTest.Services.Glossary
{
    /// <summary>
    /// SPEC8 §5 / SPEC15 EV16: a whole-project re-check of 20,000 keys against 2,000 glossaries finishes within
    /// 60 s. In-memory fixture (no database), so this measures the matcher and validator work of the job.
    /// </summary>
    public class GlossaryRecheckTimingTests
    {
        private const int KeyCount = 20_000;
        private const int GlossaryCount = 2_000;
        private static readonly TimeSpan Budget = TimeSpan.FromSeconds(60);

        private readonly ITestOutputHelper _output;

        public GlossaryRecheckTimingTests(ITestOutputHelper output)
        {
            _output = output;
        }

        private static BlocksGlossary Glossary(int i) => new()
        {
            ItemId = $"g{i:D4}",
            Name = $"Term{i:D4}",
            NormalizedName = $"term{i:D4}",
            IsGlobal = i % 4 == 0,
            ModuleIds = i % 4 == 0 ? new List<string>() : new List<string> { $"m{i % 10}" },
            SchemaVersion = 2,
            Status = GlossaryStatus.Approved,
            Rule = i % 3 == 0 ? GlossaryRule.Keep : GlossaryRule.Translate,
            Translations = new List<GlossaryTranslation>
            {
                new() { Language = "de-DE", Value = $"Begriff{i:D4}", ForbiddenValues = new List<string> { $"Falsch{i:D4}" } },
                new() { Language = "fr-FR", Value = $"Terme{i:D4}" }
            }
        };

        private static BlocksLanguageKey Key(int i) => new()
        {
            ItemId = $"k{i:D5}",
            KeyName = $"key.{i}",
            ModuleId = $"m{i % 10}",
            LastUpdateDate = DateTime.UtcNow,
            Resources = new[]
            {
                new Resource { Culture = "en-US", Value = $"Open Term{i % GlossaryCount:D4} and Term{(i * 7) % GlossaryCount:D4} for {{user}} now" },
                new Resource { Culture = "de-DE", Value = $"Öffne Falsch{i % GlossaryCount:D4} und Begriff{(i * 7) % GlossaryCount:D4} für {{user}}" },
                new Resource { Culture = "fr-FR", Value = $"Ouvrir Terme{i % GlossaryCount:D4} pour {{user}}" }
            }
        };

        [Fact]
        public async Task A_whole_project_recheck_of_20000_keys_finishes_within_60_seconds()
        {
            XUnitTest.Shared.TestBlocksContext.Set("timing-tenant");
            var glossaries = Enumerable.Range(0, GlossaryCount).Select(Glossary).ToList();
            var keys = Enumerable.Range(0, KeyCount).Select(Key).ToList();

            var jobs = new Mock<IGlossaryRecheckJobRepository>();
            var queued = new Queue<GlossaryRecheckJob>(new[] { new GlossaryRecheckJob { WholeProject = true } });
            jobs.Setup(j => j.ClaimAsync("timing-tenant")).ReturnsAsync(() => queued.Count > 0 ? queued.Dequeue() : null);
            jobs.Setup(j => j.TryAcquireLeaseAsync("timing-tenant", It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<TimeSpan>())).ReturnsAsync(true);

            var keyRepository = new Mock<IKeyRepository>();
            keyRepository.Setup(r => r.GetLanguageSettingAsync("timing-tenant")).ReturnsAsync(new BlocksLanguage { LanguageCode = "en-US", IsDefault = true });
            keyRepository.Setup(r => r.GetKeysForGlossaryRecheckAsync(It.IsAny<GlossaryRecheckKeyScope?>(), It.IsAny<string?>(), It.IsAny<int>()))
                .ReturnsAsync((GlossaryRecheckKeyScope? _, string? after, int size) =>
                    keys.Where(k => after == null || string.CompareOrdinal(k.ItemId, after) > 0).Take(size).ToList());
            var stored = 0L;
            keyRepository.Setup(r => r.SetGlossaryViolationsManyAsync(It.IsAny<IReadOnlyList<GlossaryViolationUpdate>>()))
                .ReturnsAsync((IReadOnlyList<GlossaryViolationUpdate> updates) => { stored += updates.Count; return updates.Count; });

            var service = new GlossaryRecheckService(
                jobs.Object,
                new Mock<IGlossaryRepository>().Object,
                keyRepository.Object,
                new GlossaryMatcherCache(_ => Task.FromResult(glossaries)),
                new Mock<IMessageClient>().Object,
                new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { [GlossaryEnforcement.EnabledKey] = "true" }).Build(),
                NullLogger<GlossaryRecheckService>.Instance);

            var stopwatch = Stopwatch.StartNew();
            var result = await service.RecheckAsync(new RecheckGlossaryViolationsEvent { ProjectKey = "timing-tenant" });
            stopwatch.Stop();

            _output.WriteLine($"Re-check of {KeyCount} keys against {GlossaryCount} glossaries: {stopwatch.ElapsedMilliseconds} ms, {result.Updated} keys updated");
            result.Ran.Should().BeTrue();
            result.Checked.Should().Be(KeyCount);
            result.Failed.Should().Be(0);
            stored.Should().BeGreaterThan(0);
            stopwatch.Elapsed.Should().BeLessThan(Budget);
        }
    }
}
