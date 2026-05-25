using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Shared;
using Eurolm.DomainService.Shared.Events;

namespace Eurolm.DomainService.Services
{
    public interface IKeyManagementService
    {
        Task<ApiResponse> SaveKeyAsync(Key key);
        Task<ApiResponse> SaveKeysAsync(List<Key> keys);
        Task<GetKeysQueryResponse> GetKeysAsync(GetKeysRequest query);
        Task<GetKeysByKeyNamesResponse> GetKeysByKeyNamesAsync(GetKeysByKeyNamesRequest request);
        Task<GetUilmExportedFilesQueryResponse> GetUilmExportedFilesAsync(GetUilmExportedFilesRequest request);
        Task<GetKeyTimelineQueryResponse> GetKeyTimelineAsync(GetKeyTimelineRequest query);
        Task<bool> GenerateAsync(GenerateUilmFilesEvent command);
        Task<string> GetUilmFile(GetUilmFileRequest request);
        Task<Key?> GetAsync(GetKeyRequest request);
        Task<BaseMutationResponse> DeleteAsysnc(DeleteKeyRequest request);
        Task<BaseMutationResponse> DeleteKeysAsync(DeleteKeysRequest request);
        Task<GetSuggestedGlossariesResponse> GetSuggestedGlossariesAsync(GetSuggestedGlossariesRequest request);
        Task SendTranslateAllEvent(TranslateAllRequest request);
        Task SendTranslateBlocksLanguageKeyEvent(TranslateBlocksLanguageKeyRequest request);
        Task SendTranslateBlocksLanguageKeysEvent(TranslateBlocksLanguageKeysRequest request);
        Task SendUilmImportEvent(UilmImportRequest request);
        Task SendUilmExportEvent(UilmExportRequest request);
        Task SendGenerateUilmFilesEvent(GenerateUilmFilesRequest request);
        Task<bool> ChangeAll(TranslateAllEvent request);
        Task<bool> TranslateBlocksLanguageKey(TranslateBlocksLanguageKeyEvent request);
        Task<bool> TranslateBlocksLanguageKeys(TranslateBlocksLanguageKeysEvent request);
        Task<bool> ImportUilmFile(UilmImportEvent request);
        Task<bool> ExportUilmFile(UilmExportEvent request);
        Task PublishUilmExportNotification(bool response, string fileId, string? messageCoRelationId, string tenantId);
        Task PublishTranslateAllNotification(bool response, string? messageCoRelationId);
        Task PublishTranslateBlocksLanguageKeyNotification(bool response, string? messageCoRelationId);
        Task PublishEnvironmentDataMigrationNotification(bool response, string? messageCoRelationId, string projectKey, string targetedProjectKey);
        Task CreateBulkKeyTimelineEntriesAsync(List<BlocksLanguageKey> keys, string logFrom, string targetedProjectKey);
        Task CreateBulkKeyTimelineEntriesAsync(List<BlocksLanguageKey> keys, List<BlocksLanguageKey> previousKeys, string logFrom, string targetedProjectKey);
        Task<BaseMutationResponse> DeleteCollectionsAsync(DeleteCollectionsRequest request);
        Task<BaseMutationResponse> RollbackAsync(RollbackRequest request);
        Task<GetLanguageFileGenerationHistoryResponse> GetLanguageFileGenerationHistoryAsync(GetLanguageFileGenerationHistoryRequest request);
        Task<GetLocalizationTimelineResponse> GetLocalizationTimelineAsync(GetLocalizationTimelineRequest query);
        Task<GetKeyTimelineQueryResponse> GetTimelineByOperationIdAsync(GetTimelineByOperationIdRequest query);
    }
}
