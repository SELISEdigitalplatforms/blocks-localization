using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
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
    }
}
