using Eurolm.DomainService.Repositories;

namespace Eurolm.DomainService.Services
{
    public interface IGlossaryTerminologyService
    {
        /// <summary><c>GlossaryEnforcement:Enabled</c>.</summary>
        bool IsEnforcementEnabled { get; }

        /// <summary>/Glossary/Match over the context tenant's glossaries. Not gated by the flag.</summary>
        Task<MatchGlossaryResponse> MatchAsync(MatchGlossaryRequest request);

        /// <summary>
        /// The key's glossary violations for every non-default culture with a value, computed with the matcher
        /// and validator only (no AI). Null when the flag is off, so callers leave stored violations untouched.
        /// </summary>
        Task<List<KeyGlossaryViolation>?> ComputeKeyViolationsAsync(BlocksLanguageKey key);

        /// <summary>
        /// <see cref="ComputeKeyViolationsAsync(BlocksLanguageKey)"/> for many keys with one language-setting read and
        /// one matcher. Null when the flag is off; an entry is null when that key's check failed.
        /// </summary>
        Task<List<List<KeyGlossaryViolation>?>?> ComputeKeyViolationsAsync(IReadOnlyList<BlocksLanguageKey> keys);

        /// <summary>
        /// Ids of glossaries found in the key's default-language text that the key could be tagged with: not
        /// tagged, not global, not linked to its module, not Deprecated. In text order, at most
        /// <paramref name="maxResults"/>. Not gated by the flag.
        /// </summary>
        Task<List<string>> SuggestGlossaryIdsAsync(Key key, int maxResults);
    }
}
