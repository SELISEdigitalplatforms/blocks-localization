namespace Eurolm.DomainService.Services.UilmStorage
{
    /// <summary>
    /// One publish run: its version, whether the tenant publishes to Storage, and whether pointer rows with a file
    /// keep their <c>Content</c> (#349 §6.4).
    /// </summary>
    public readonly record struct UilmPublishSession(int Version, bool PublishToStorage, bool ForceUpload, bool KeepContent = true);

    /// <summary>
    /// Outcome of one module. <see cref="Failed"/> means its existing pointers were kept (an upload failed).
    /// </summary>
    public readonly record struct UilmModulePublishResult(int UploadedFiles, int SkippedFiles, bool Failed);
}
