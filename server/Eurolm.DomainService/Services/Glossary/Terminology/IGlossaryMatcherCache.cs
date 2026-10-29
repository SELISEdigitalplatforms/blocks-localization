namespace Eurolm.DomainService.Services
{
    /// <summary>
    /// Per-tenant matcher, rebuilt when older than 60 s (no IMemoryCache; see Shared capabilities). Glossary
    /// writes in this process call <see cref="Invalidate"/>; other processes see changes within the TTL (A3).
    /// </summary>
    public interface IGlossaryMatcherCache
    {
        Task<GlossaryMatcher> GetAsync(string tenantId);
        void Invalidate(string tenantId);
    }
}
