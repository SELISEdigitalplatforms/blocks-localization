using Eurolm.DomainService.Repositories;
using System.Collections.Concurrent;

namespace Eurolm.DomainService.Services
{
    /// <summary>
    /// One matcher per tenant, rebuilt when older than <see cref="Ttl"/>. Concurrent requests for the same
    /// tenant share one build. A failed build is not cached, so the next request tries again.
    /// </summary>
    public sealed class GlossaryMatcherCache : IGlossaryMatcherCache
    {
        public static readonly TimeSpan Ttl = TimeSpan.FromSeconds(60);

        private readonly Func<string, Task<List<BlocksGlossary>>> _loadGlossaries;
        private readonly Func<DateTimeOffset> _now;
        private readonly ConcurrentDictionary<string, Entry> _entries = new();

        private sealed record Entry(Lazy<Task<GlossaryMatcher>> Build, DateTimeOffset BuiltAt);

        public GlossaryMatcherCache(Func<string, Task<List<BlocksGlossary>>> loadGlossaries, Func<DateTimeOffset>? now = null)
        {
            _loadGlossaries = loadGlossaries ?? throw new ArgumentNullException(nameof(loadGlossaries));
            _now = now ?? (() => DateTimeOffset.UtcNow);
        }

        public async Task<GlossaryMatcher> GetAsync(string tenantId)
        {
            var key = tenantId ?? "";
            var now = _now();
            var entry = _entries.GetOrAdd(key, _ => NewEntry(key, now));
            if (now - entry.BuiltAt >= Ttl)
            {
                // Expired: replace it (only if nobody already did) and use whichever entry won.
                var fresh = NewEntry(key, now);
                entry = _entries.TryUpdate(key, fresh, entry) ? fresh : _entries.GetOrAdd(key, _ => fresh);
            }

            try
            {
                return await entry.Build.Value;
            }
            catch
            {
                // Never cache a failure; drop only this entry so the next call rebuilds.
                _entries.TryRemove(new KeyValuePair<string, Entry>(key, entry));
                throw;
            }
        }

        public void Invalidate(string tenantId) => _entries.TryRemove(tenantId ?? "", out _);

        private Entry NewEntry(string tenantId, DateTimeOffset builtAt) =>
            new(new Lazy<Task<GlossaryMatcher>>(() => BuildAsync(tenantId)), builtAt);

        private async Task<GlossaryMatcher> BuildAsync(string tenantId)
        {
            var glossaries = await _loadGlossaries(tenantId);
            return GlossaryMatcher.Build(glossaries.Select(g => (g, GlossaryTerminologyResolver.Resolve(g))));
        }
    }
}
