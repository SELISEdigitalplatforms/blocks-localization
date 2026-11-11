namespace Eurolm.DomainService.Services.UilmStorage
{
    /// <summary>One publish run: its version and whether the tenant publishes to Storage.</summary>
    public readonly record struct UilmPublishSession(int Version, bool PublishToStorage, bool ForceUpload);

    /// <summary>
    /// Outcome of one module. <see cref="Failed"/> means its existing pointers were kept (an upload failed).
    /// </summary>
    public readonly record struct UilmModulePublishResult(int UploadedFiles, int SkippedFiles, bool Failed);
}
