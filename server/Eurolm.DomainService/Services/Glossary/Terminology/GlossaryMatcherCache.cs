using Eurolm.DomainService.Repositories;
using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;

namespace Eurolm.DomainService.Services
{
    /// <summary>
    /// One matcher per tenant, rebuilt when older than <see cref="Ttl"/>, or sooner when the tenant's glossary
    /// revision (checked at most every <see cref="RevisionCheckInterval"/>) changed in another process.
    /// Concurrent requests for the same tenant share one build. A failed build is not cached, so the next
    /// request tries again.
    /// </summary>
    public sealed class GlossaryMatcherCache : IGlossaryMatcherCache
    {
        public static readonly TimeSpan Ttl = TimeSpan.FromSeconds(60);
        public static readonly TimeSpan RevisionCheckInterval = TimeSpan.FromSeconds(5);
        public static readonly TimeSpan SweepInterval = TimeSpan.FromSeconds(60);

        private readonly Func<string, Task<List<BlocksGlossary>>> _loadGlossaries;
        private readonly Func<string, Task<string>>? _loadRevision;
        private readonly Func<DateTimeOffset> _now;
        private readonly ILogger<GlossaryMatcherCache>? _logger;
        private readonly ConcurrentDictionary<string, Entry> _entries = new();
        private long _lastSweepTicks;

        private sealed record Built(GlossaryMatcher Matcher, string? Revision);

        private sealed record Entry(Lazy<Task<Built>> Build, DateTimeOffset BuiltAt, DateTimeOffset CheckedAt);

        public GlossaryMatcherCache(Func<string, Task<List<BlocksGlossary>>> loadGlossaries, Func<DateTimeOffset>? now = null,
                                   Func<string, Task<string>>? loadRevision = null, ILogger<GlossaryMatcherCache>? logger = null)
        {
            _loadGlossaries = loadGlossaries ?? throw new ArgumentNullException(nameof(loadGlossaries));
            _loadRevision = loadRevision;
            _now = now ?? (() => DateTimeOffset.UtcNow);
            _logger = logger;
            _lastSweepTicks = _now().UtcTicks;
        }

        public async Task<GlossaryMatcher> GetAsync(string tenantId)
        {
            var key = tenantId ?? "";
            var now = _now();
            Sweep(key, now);
            var entry = _entries.GetOrAdd(key, k => NewEntry(k, now));
            if (now - entry.BuiltAt >= Ttl) entry = Replace(key, entry, NewEntry(key, now));

            Built built;
            try
            {
                built = await entry.Build.Value;
            }
            catch
            {
                // Never cache a failure; drop only this entry so the next call rebuilds.
                _entries.TryRemove(new KeyValuePair<string, Entry>(key, entry));
                throw;
            }

            if (_loadRevision == null || now - entry.CheckedAt < RevisionCheckInterval) return built.Matcher;
            return await CheckRevisionAsync(key, entry, built, now);
        }

        private async Task<GlossaryMatcher> CheckRevisionAsync(string key, Entry entry, Built built, DateTimeOffset now)
        {
            string revision;
            try
            {
                revision = await _loadRevision!(key);
            }
            catch
            {
                // The TTL still bounds how stale the matcher gets.
                return built.Matcher;
            }

            if (revision == built.Revision)
            {
                _entries.TryUpdate(key, entry with { CheckedAt = now }, entry);
                return built.Matcher;
            }

            var fresh = Replace(key, entry, NewEntry(key, now));
            try
            {
                return (await fresh.Build.Value).Matcher;
            }
            catch
            {
                _entries.TryRemove(new KeyValuePair<string, Entry>(key, fresh));
                throw;
            }
        }

        /// <summary>Replaces the entry (only if nobody already did) and returns whichever entry won.</summary>
        private Entry Replace(string key, Entry current, Entry fresh) =>
            _entries.TryUpdate(key, fresh, current) ? fresh : _entries.GetOrAdd(key, _ => fresh);

        private void Sweep(string requestingTenant, DateTimeOffset now)
        {
            var last = Interlocked.Read(ref _lastSweepTicks);
            if (now.UtcTicks - last < SweepInterval.Ticks) return;
            if (Interlocked.CompareExchange(ref _lastSweepTicks, now.UtcTicks, last) != last) return;

            var evicted = 0;
            foreach (var pair in _entries)
            {
                if (pair.Key == requestingTenant || now - pair.Value.BuiltAt < Ttl) continue;
                if (_entries.TryRemove(pair)) evicted++;
            }
            if (evicted > 0) _logger?.LogDebug("Glossary matcher cache evicted {EvictedCount} tenants", evicted);
        }

        public void Invalidate(string tenantId) => _entries.TryRemove(tenantId ?? "", out _);

        private Entry NewEntry(string tenantId, DateTimeOffset builtAt) =>
            new(new Lazy<Task<Built>>(() => BuildAsync(tenantId)), builtAt, builtAt);

        private async Task<Built> BuildAsync(string tenantId)
        {
            // Read the revision first: a change during the load then shows as a new revision on the next check.
            string? revision = null;
            if (_loadRevision != null)
            {
                try
                {
                    revision = await _loadRevision(tenantId);
                }
                catch
                {
                    // Unknown revision: the next check rebuilds, the TTL bounds it otherwise.
                }
            }
            var glossaries = await _loadGlossaries(tenantId);
            return new Built(GlossaryMatcher.Build(glossaries.Select(g => (g, GlossaryTerminologyResolver.Resolve(g)))), revision);
        }
    }
}
