using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared.Entities;
using System.Linq.Expressions;

namespace Eurolm.DomainService.Repositories
{
    public interface IKeyRepository
    {
        Task SaveKeyAsync(BlocksLanguageKey key);
        Task<BlocksLanguageKey> GetKeyByNameAsync(string KeyName, string moduleId);
        Task<GetKeysQueryResponse> GetAllKeysAsync(GetKeysRequest request);
        Task<List<Key>> GetAllKeysByModuleAsync(string moduleId);
        Task<bool> SaveNewUilmFiles(List<UilmFile> uilmfiles);
        Task<long> DeleteOldUilmFiles(List<UilmFile> uilmfiles);
        Task<UilmFile> GetUilmFile(GetUilmFileRequest request);
        Task<UilmFile> GetUilmFile(GetUilmFileRequestForClient request);
        Task<Key> GetByIdAsync(string itemId);
        Task DeleteAsync(string itemId);
        Task<IQueryable<BlocksLanguageKey>> GetUilmResourceKeysWithPage(int page, int size);
        Task<long?> UpdateUilmResourceKeysForChangeAll(List<BlocksLanguageKey> uilmResourceKeys);
        Task<T> GetUilmResourceKey<T>(Expression<Func<BlocksLanguageKey, bool>> expression);
        Task<BlocksLanguageKey> GetUilmResourceKey(Expression<Func<BlocksLanguageKey, bool>> expression, string tenantId);
        Task InsertUilmResourceKeys(IEnumerable<BlocksLanguageKey> entities);
        Task InsertUilmResourceKeys(IEnumerable<BlocksLanguageKey> entities, string tenantId);
        Task<(long upsertedCount, long modifiedCount)> UpsertResourceKeysWithMergeAsync(IEnumerable<BlocksLanguageKey> entities, string? tenantId = null);
        Task UpdateBulkUilmApplications(List<BlocksLanguageModule> uilmApplicationsToBeUpdated, string organizationId, bool isExternal, string clientTenantId);
        Task<bool> UpdateKeysCountOfAppAsync(string appId, bool isExternal, string tenantId, string organizationId);    
        Task InsertUilmApplications(List<BlocksLanguageModule> uilmApplicationsToBeInserted, string clientTenantId);
        Task InsertUilmApplications(IEnumerable<BlocksLanguageModule> entities);
        Task<List<T>> GetUilmApplications<T>(Expression<Func<BlocksLanguageModule, bool>> expression);
        Task<List<BlocksLanguageKey>> GetUilmResourceKeys(Expression<Func<BlocksLanguageKey, bool>> expression, string tenantId);
        Task<List<T>> GetUilmResourceKeys<T>(Expression<Func<BlocksLanguageKey, bool>> expression);
        Task<BlocksLanguage> GetLanguageSettingAsync(string clientTenantId);
        Task<List<BlocksLanguage>> GetAllLanguagesAsync(string clientTenantId);
        Task<Dictionary<string, long>> DeleteCollectionsAsync(List<string> collections);
        Task SaveUilmExportedFileAsync(UilmExportedFile exportedFile);
        Task<GetUilmExportedFilesQueryResponse> GetUilmExportedFilesAsync(GetUilmExportedFilesRequest request);
        Task<List<Key>> GetKeysByKeyNamesAsync(string[] keyNames, string? moduleId = null);
    }
}
