namespace Eurolm.DomainService.Services.UilmStorage
{
    /// <summary>Writes a publish's module/language files: to Storage behind a pointer, or as content only.</summary>
    public interface IUilmFilePublisher
    {
        /// <summary>
        /// Starts a publish: reads the tenant's Storage switches (<see cref="UilmStorageMode"/>) and takes the next version from the atomic counter,
        /// seeded with the project's highest history version.
        /// </summary>
        Task<UilmPublishSession> BeginAsync(string projectKey, bool forceUpload);

        /// <summary>
        /// Publishes one module's files (one per language, plus the key file). With the switch on, unchanged files
        /// are skipped (not uploaded) and the module's pointers switch only when every upload of the module
        /// succeeded; a failed module keeps its existing pointers (<see cref="UilmModulePublishResult.Failed"/>).
        /// Database errors are thrown.
        /// </summary>
        Task<UilmModulePublishResult> PublishModuleAsync(UilmPublishSession session, string moduleName, IReadOnlyList<UilmFile> files);
    }
}
