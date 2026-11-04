using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using XUnitTest.Shared;
using Xunit;

namespace XUnitTest
{
    /// <summary>SPEC6 C16: one build per tenant per 60 s, shared by concurrent callers, invalidated by local writes.</summary>
    public class GlossaryMatcherCacheTests
    {
        private DateTimeOffset _now = new(2026, 10, 28, 12, 0, 0, TimeSpan.Zero);
        private readonly Dictionary<string, int> _loads = new();

        private GlossaryMatcherCache NewCache(Func<string, Task<List<BlocksGlossary>>>? load = null) =>
            new(load ?? (tenant =>
            {
                lock (_loads) _loads[tenant] = _loads.GetValueOrDefault(tenant) + 1;
                return Task.FromResult(new List<BlocksGlossary> { new() { ItemId = "g1", Name = "Workspace", IsGlobal = true } });
            }), () => _now);

        [Fact]
        public async Task Repeated_calls_within_the_TTL_reuse_one_build()
        {
            var cache = NewCache();

            var first = await cache.GetAsync("t1");
            _now += TimeSpan.FromSeconds(59);
            var second = await cache.GetAsync("t1");

            second.Should().BeSameAs(first);
            _loads["t1"].Should().Be(1);
        }

        [Fact]
        public async Task Concurrent_callers_share_one_build()
        {
            var release = new TaskCompletionSource<List<BlocksGlossary>>();
            var loads = 0;
            var cache = NewCache(_ => { Interlocked.Increment(ref loads); return release.Task; });

            var calls = Enumerable.Range(0, 10).Select(_ => cache.GetAsync("t1")).ToList();
            release.SetResult(new List<BlocksGlossary>());
            var matchers = await Task.WhenAll(calls);

            loads.Should().Be(1);
            matchers.Distinct().Should().ContainSingle();
        }

        [Fact]
        public async Task An_entry_older_than_the_TTL_is_rebuilt()
        {
            var cache = NewCache();

            var first = await cache.GetAsync("t1");
            _now += GlossaryMatcherCache.Ttl;
            var second = await cache.GetAsync("t1");

            second.Should().NotBeSameAs(first);
            _loads["t1"].Should().Be(2);
        }

        [Fact]
        public async Task Invalidate_forces_a_rebuild_for_that_tenant_only()
        {
            var cache = NewCache();
            var t1 = await cache.GetAsync("t1");
            var t2 = await cache.GetAsync("t2");

            cache.Invalidate("t1");

            (await cache.GetAsync("t1")).Should().NotBeSameAs(t1);
            (await cache.GetAsync("t2")).Should().BeSameAs(t2);
            _loads["t1"].Should().Be(2);
            _loads["t2"].Should().Be(1);
        }

        [Fact]
        public async Task A_failed_build_is_not_cached()
        {
            var attempts = 0;
            var cache = NewCache(_ =>
            {
                attempts++;
                return attempts == 1
                    ? throw new InvalidOperationException("db down")
                    : Task.FromResult(new List<BlocksGlossary>());
            });

            var failed = () => cache.GetAsync("t1");
            await failed.Should().ThrowAsync<InvalidOperationException>();
            var matcher = await cache.GetAsync("t1");

            matcher.Should().NotBeNull();
            attempts.Should().Be(2);
        }

        [Fact]
        public async Task Each_tenant_loads_only_its_own_glossaries()
        {
            var requested = new List<string>();
            var cache = NewCache(tenant => { lock (requested) requested.Add(tenant); return Task.FromResult(new List<BlocksGlossary>()); });

            await cache.GetAsync("tenant-a");
            await cache.GetAsync("tenant-b");

            requested.Should().Equal("tenant-a", "tenant-b");
        }

        [Fact]
        public async Task A_changed_revision_from_another_process_rebuilds_before_the_TTL()
        {
            var revision = "1:100";
            var loads = 0;
            var cache = new GlossaryMatcherCache(
                _ => { loads++; return Task.FromResult(new List<BlocksGlossary>()); },
                () => _now,
                _ => Task.FromResult(revision));

            await cache.GetAsync("t1");
            _now += TimeSpan.FromSeconds(1);
            await cache.GetAsync("t1");
            loads.Should().Be(1, "the revision is only checked every few seconds");

            _now += GlossaryMatcherCache.RevisionCheckInterval;
            await cache.GetAsync("t1");
            loads.Should().Be(1, "the revision is unchanged");

            revision = "2:200";
            _now += GlossaryMatcherCache.RevisionCheckInterval;
            await cache.GetAsync("t1");
            loads.Should().Be(2);
        }

        [Fact]
        public async Task A_failing_revision_check_keeps_the_cached_matcher()
        {
            var loads = 0;
            var calls = 0;
            var cache = new GlossaryMatcherCache(
                _ => { loads++; return Task.FromResult(new List<BlocksGlossary>()); },
                () => _now,
                _ => ++calls == 1 ? Task.FromResult("1:1") : throw new InvalidOperationException("db down"));

            var first = await cache.GetAsync("t1");
            _now += GlossaryMatcherCache.RevisionCheckInterval;
            var second = await cache.GetAsync("t1");

            second.Should().BeSameAs(first);
            loads.Should().Be(1);
        }

        [Fact]
        public async Task A_build_whose_revision_read_fails_still_returns_a_matcher_and_rebuilds_on_the_next_check()
        {
            var loads = 0;
            var calls = 0;
            var cache = new GlossaryMatcherCache(
                _ => { loads++; return Task.FromResult(new List<BlocksGlossary>()); },
                () => _now,
                _ => ++calls == 1 ? throw new InvalidOperationException("db down") : Task.FromResult("1:1"));

            var first = await cache.GetAsync("t1");
            _now += GlossaryMatcherCache.RevisionCheckInterval;
            var second = await cache.GetAsync("t1");

            first.Should().NotBeNull();
            second.Should().NotBeSameAs(first, "an unknown revision never equals the stored one");
            loads.Should().Be(2);
        }

        [Fact]
        public async Task A_failed_rebuild_after_a_revision_change_is_not_cached()
        {
            var revision = "1:1";
            var loads = 0;
            var cache = new GlossaryMatcherCache(
                _ => ++loads == 2 ? throw new InvalidOperationException("db down") : Task.FromResult(new List<BlocksGlossary>()),
                () => _now,
                _ => Task.FromResult(revision));

            await cache.GetAsync("t1");
            revision = "2:2";
            _now += GlossaryMatcherCache.RevisionCheckInterval;
            var failed = () => cache.GetAsync("t1");

            await failed.Should().ThrowAsync<InvalidOperationException>();
            await cache.GetAsync("t1");
            loads.Should().Be(3);
        }

        private GlossaryMatcherCache NewLoggedCache(Mock<ILogger<GlossaryMatcherCache>> logger) =>
            new(tenant =>
            {
                lock (_loads) _loads[tenant] = _loads.GetValueOrDefault(tenant) + 1;
                return Task.FromResult(new List<BlocksGlossary>());
            }, () => _now, logger: logger.Object);

        [Fact]
        public async Task H6_the_sweep_evicts_other_tenants_older_than_the_TTL_and_the_evicted_tenant_rebuilds_once()
        {
            var logger = new Mock<ILogger<GlossaryMatcherCache>>();
            var cache = NewLoggedCache(logger);
            await cache.GetAsync("t1");
            await cache.GetAsync("t2");
            _now += TimeSpan.FromSeconds(30);
            var fresh = await cache.GetAsync("t3");

            _now += TimeSpan.FromSeconds(31);
            var requesting = await cache.GetAsync("t1");

            logger.VerifyLog(LogLevel.Debug, "Glossary matcher cache evicted 1 tenants");
            (await cache.GetAsync("t2")).Should().NotBeNull();
            (await cache.GetAsync("t2")).Should().BeSameAs(await cache.GetAsync("t2"));
            _loads["t2"].Should().Be(2, "the evicted tenant builds once on its next request");
            (await cache.GetAsync("t1")).Should().BeSameAs(requesting);
            (await cache.GetAsync("t3")).Should().BeSameAs(fresh, "an entry younger than the TTL is kept");
            _loads["t3"].Should().Be(1);
        }

        [Fact]
        public async Task The_sweep_runs_at_most_once_per_interval()
        {
            var logger = new Mock<ILogger<GlossaryMatcherCache>>();
            var cache = NewLoggedCache(logger);
            await cache.GetAsync("t1");
            await cache.GetAsync("t2");
            _now += GlossaryMatcherCache.SweepInterval;
            await cache.GetAsync("t3");
            await cache.GetAsync("t3");
            await cache.GetAsync("t4");

            logger.VerifyLog(LogLevel.Debug, "Glossary matcher cache evicted 2 tenants");
            logger.LoggedMessages().Should().ContainSingle(m => m.StartsWith("Glossary matcher cache evicted"));
        }

        [Fact]
        public async Task C9_the_requesting_tenant_is_never_dropped_by_its_own_sweep()
        {
            var release = new TaskCompletionSource<List<BlocksGlossary>>();
            var loads = 0;
            var cache = new GlossaryMatcherCache(_ => { Interlocked.Increment(ref loads); return loads == 1 ? Task.FromResult(new List<BlocksGlossary>()) : release.Task; }, () => _now);
            await cache.GetAsync("t1");
            _now += GlossaryMatcherCache.Ttl + TimeSpan.FromSeconds(1);

            var rebuilding = cache.GetAsync("t1");
            var concurrent = cache.GetAsync("t1");
            release.SetResult(new List<BlocksGlossary>());

            (await rebuilding).Should().BeSameAs(await concurrent);
            loads.Should().Be(2);
            (await cache.GetAsync("t1")).Should().BeSameAs(await rebuilding);
        }

    }
}
