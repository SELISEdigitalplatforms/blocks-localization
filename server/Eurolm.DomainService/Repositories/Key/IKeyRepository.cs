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
        Task<bool> HasKeysInModuleAsync(string moduleId);
        Task MoveKeysAsync(IReadOnlyCollection<string> itemIds, string targetModuleId);
        Task DeleteKeysAsync(IReadOnlyCollection<string> itemIds);

        /// <summary>
        /// Pulls the glossary id from GlossaryIds and the glossary's entries from GlossaryViolations of every key
        /// in the tenant, in one update. Returns the modified count.
        /// </summary>
        Task<long> RemoveGlossaryIdFromKeysAsync(string glossaryId);

        /// <summary>Replaces the key's stored glossary violations (all cultures).</summary>
        Task SetGlossaryViolationsAsync(string keyId, List<KeyGlossaryViolation> violations);

        /// <summary>
        /// One page of keys for the glossary re-check, ordered by ItemId after <paramref name="afterItemId"/>, with
        /// only ItemId, ModuleId, GlossaryIds, Resources and GlossaryViolations loaded. A null scope selects every key.
        /// </summary>
        Task<List<BlocksLanguageKey>> GetKeysForGlossaryRecheckAsync(GlossaryRecheckKeyScope? scope, string? afterItemId, int pageSize);

        /// <summary>Sets GlossaryViolations ($set, nothing else) of each key in one unordered bulk write. Returns the modified count.</summary>
        Task<long> SetGlossaryViolationsManyAsync(IReadOnlyList<(string KeyId, List<KeyGlossaryViolation> Violations)> updates);

        /// <summary>Tagged key count, one page of tagged keys, their module ids and the count of keys with violations of the glossary.</summary>
        Task<GlossaryKeyUsage> GetGlossaryKeyUsageAsync(string glossaryId, int pageNumber, int pageSize);

        /// <summary>
        /// Removes GlossaryIds entries that reference no existing glossary, in batches. Returns the number of
        /// entries removed (or that would be removed, with <paramref name="dryRun"/>).
        /// </summary>
        Task<long> RemoveStaleGlossaryIdsAsync(IReadOnlyCollection<string> existingGlossaryIds, bool dryRun, int batchSize = 200);

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

        /// <summary>
        /// Inserts new keys; a key another writer created meanwhile (rejected by the unique key index) is
        /// merged into that row instead. Returns the keys that were merged rather than inserted.
        /// </summary>
        Task<List<BlocksLanguageKey>> InsertOrMergeResourceKeysAsync(List<BlocksLanguageKey> keys);

        /// <summary>
        /// Inserts new modules, skipping any whose name another writer took meanwhile (rejected by the unique
        /// module-name index). Returns the skipped modules.
        /// </summary>
        Task<List<BlocksLanguageModule>> InsertModulesSkippingTakenNamesAsync(List<BlocksLanguageModule> modules);
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
