namespace Eurolm.DomainService.Services
{
    public interface IGlossaryMigrationService
    {
        /// <summary>Moves the context tenant's Track A terminology into the structured fields (idempotent).</summary>
        Task<MigrateGlossariesResponse> MigrateAsync(bool dryRun);
    }
}
