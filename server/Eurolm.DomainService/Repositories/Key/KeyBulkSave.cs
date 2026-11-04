namespace Eurolm.DomainService.Repositories
{
    /// <summary>
    /// One key of a bulk save. A <see cref="GlossaryIdsOnly"/> save only sets GlossaryIds, LastUpdateDate and, with
    /// <see cref="SetGlossaryViolations"/>, GlossaryViolations on the stored key; any other save replaces the key.
    /// </summary>
    public record KeyBulkSave(BlocksLanguageKey Key, bool GlossaryIdsOnly, bool SetGlossaryViolations);

    /// <summary>A bulk save entry the database rejected, by its index in the request.</summary>
    public record KeyBulkSaveError(int Index, bool IsDuplicateKey, string Message);
}
