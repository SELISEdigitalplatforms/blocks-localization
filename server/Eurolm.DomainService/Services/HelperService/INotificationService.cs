namespace Eurolm.DomainService.Services.HelperService
{
    public interface INotificationService
    {
        Task<bool> NotifyExportEvent(bool response, string fileId, string? messageCoRelationId, string tenantId);
        Task<bool> NotifyTranslateAllEvent(bool response, string? messageCoRelationId);
        Task<bool> NotifyTranslateBlocksLanguageKeyEvent(bool response, string? messageCoRelationId);
        Task<bool> NotifyEnvironmentDataMigrationEvent(bool response, string? messageCoRelationId, string projectKey, string targetedProjectKey);
        Task<bool> NotifyExtensionEvent(bool response, string projectKey);
    }
}
