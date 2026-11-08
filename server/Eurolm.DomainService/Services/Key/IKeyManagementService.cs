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
        Task<GetDuplicateSummaryResponse> GetDuplicateSummaryAsync();
        Task<EnforceUniquenessResponse> EnforceUniquenessAsync();
        Task<GetKeysByKeyNamesResponse> GetKeysByKeyNamesAsync(GetKeysByKeyNamesRequest request);
        Task<GetUilmExportedFilesQueryResponse> GetUilmExportedFilesAsync(GetUilmExportedFilesRequest request);
        Task<GetKeyTimelineQueryResponse> GetKeyTimelineAsync(GetKeyTimelineRequest query);
        Task<bool> GenerateAsync(GenerateUilmFilesEvent command);
        Task<string> GetUilmFile(GetUilmFileRequest request);
        Task<string> GetUilmFile(GetUilmFileRequestForClient request);
        Task<Key?> GetAsync(GetKeyRequest request);
        Task<BaseMutationResponse> DeleteAsync(DeleteKeyRequest request);
        /// <exception cref="BulkKeyTargetException">The filter-form target is over the cap or no longer has ExpectedCount keys.</exception>
        /// <exception cref="Repositories.KeyListException">Resolving the filter timed out.</exception>
        Task<BulkKeyActionResponse> DeleteKeysAsync(DeleteKeysRequest request);
        Task<GetSuggestedGlossariesResponse> GetSuggestedGlossariesAsync(GetSuggestedGlossariesRequest request);
        Task SendTranslateAllEvent(TranslateAllRequest request);
        Task SendTranslateBlocksLanguageKeyEvent(TranslateBlocksLanguageKeyRequest request);
        /// <exception cref="BulkKeyTargetException">The filter-form target is over the cap or no longer has ExpectedCount keys.</exception>
        /// <exception cref="Repositories.KeyListException">Resolving the filter timed out.</exception>
        Task<BulkKeyActionResponse> SendTranslateBlocksLanguageKeysEvent(TranslateBlocksLanguageKeysRequest request);
        Task SendUilmImportEvent(UilmImportRequest request);
        Task SendUilmExportEvent(UilmExportRequest request);
        Task SendGenerateUilmFilesEvent(GenerateUilmFilesRequest request);
        Task<bool> ChangeAll(TranslateAllEvent request);
        Task<bool> TranslateBlocksLanguageKey(TranslateBlocksLanguageKeyEvent request);
        Task<bool> TranslateBlocksLanguageKeys(TranslateBlocksLanguageKeysEvent request);

        /// <summary>
        /// Records one finished batch of a split bulk translate. Returns null while other batches are still
        /// running, otherwise whether every batch succeeded.
        /// </summary>
        Task<bool?> CompleteTranslateBlocksLanguageKeysBatchAsync(TranslateBlocksLanguageKeysEvent request, bool succeeded);
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
