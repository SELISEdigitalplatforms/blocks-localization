namespace Eurolm.DomainService.Repositories
{
    /// <summary>
    /// A re-check result for one key. <see cref="ReadLastUpdateDate"/> is the key's LastUpdateDate when the job read
    /// it; the write is skipped when a save has changed the key since, so a newer save's violations are kept.
    /// </summary>
    public record GlossaryViolationUpdate(string KeyId, List<KeyGlossaryViolation> Violations, DateTime ReadLastUpdateDate);
}
