using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.UilmStorage;
using Eurolm.DomainService.Shared.Entities;
using System.Linq.Expressions;

namespace Eurolm.DomainService.Repositories
{
    /// <param name="Ids">The matching ItemIds.</param>
    /// <param name="DuplicatesTruncated">With the duplicates filter: the duplicate list hit its cap, so the IDs are incomplete.</param>
    public record MatchingKeyIds(List<string> Ids, bool DuplicatesTruncated);

    /// <param name="Done">Batches finished so far.</param>
    /// <param name="Failed">Of those, batches that failed.</param>
    public record BulkTranslateProgress(int Done, int Failed);

    /// <summary>Snapshots returned by atomic deletes, and per-ID failures.</summary>
    public record BulkKeyDeleteResult(List<BlocksLanguageKey> Deleted, Dictionary<string, string> Errors);

    public interface IKeyRepository
    {
        Task SaveKeyAsync(BlocksLanguageKey key);
        Task<BlocksLanguageKey> GetKeyByNameAsync(string KeyName, string moduleId);
        /// <summary>The stored keys among the requested KeyName + ModuleId pairs, in one query.</summary>
        Task<List<BlocksLanguageKey>> GetKeysByNameAndModuleAsync(IReadOnlyCollection<(string KeyName, string ModuleId)> keys);
        /// <summary>
        /// Sets only GlossaryIds, LastUpdateDate and (with <paramref name="setGlossaryViolations"/>) GlossaryViolations
        /// on the stored key with the same KeyName + ModuleId. False when no key matched.
        /// </summary>
        Task<bool> SetGlossaryIdsAsync(BlocksLanguageKey key, bool setGlossaryViolations);
        /// <summary>One unordered bulk write; returns the entries the database rejected (the others are stored).</summary>
        Task<IReadOnlyList<KeyBulkSaveError>> BulkSaveKeysAsync(IReadOnlyList<KeyBulkSave> saves);
        Task<GetKeysQueryResponse> GetAllKeysAsync(GetKeysRequest request);
        Task<List<Key>> GetAllKeysByModuleAsync(string moduleId);
        Task<bool> SaveNewUilmFiles(List<UilmFile> uilmfiles);
        Task<long> DeleteOldUilmFiles(List<UilmFile> uilmfiles);
        /// <summary>The module/language row to serve: the highest <c>Version</c> wins, legacy rows (no version) last.</summary>
        Task<UilmFile> GetUilmFile(GetUilmFileRequest request);
        /// <summary>
        /// For each module/language matching the optional exact filters, the row <see cref="GetUilmFile(GetUilmFileRequest)"/>
        /// would serve, without its content, with its file's state in the <c>UilmStoredFiles</c> ledger. Unsorted.
        /// </summary>
        Task<List<UilmManifestRow>> GetUilmManifestRowsAsync(string? moduleName, string? language);
        /// <summary>Every row of the module, legacy rows included.</summary>
        Task<List<UilmFile>> GetUilmFilesOfModuleAsync(string moduleName);
        /// <summary>
        /// Replaces (or inserts) the row with the pointer's deterministic id, only when the stored row has no
        /// version or a lower one.
        /// </summary>
        Task<UilmFilePointerWrite> ReplaceUilmFilePointerAsync(UilmFile pointer);
        /// <summary>Deletes the module/language rows other than <paramref name="keepId"/> (legacy duplicates).</summary>
        Task DeleteUilmFileDuplicatesAsync(string moduleName, string language, string keepId);
        /// <summary>Deletes the module's rows whose language is not in <paramref name="languages"/> and returns them.</summary>
        Task<List<UilmFile>> DeleteUilmFilesOfOtherLanguagesAsync(string moduleName, IReadOnlyCollection<string> languages);
        /// <summary>The subset of <paramref name="fileIds"/> that some <c>UilmFiles</c> row still points at.</summary>
        Task<HashSet<string>> GetReferencedUilmFileIdsAsync(IReadOnlyCollection<string> fileIds);
        Task<UilmFile> GetUilmFile(GetUilmFileRequestForClient request);
        Task<Key> GetByIdAsync(string itemId);
        Task DeleteAsync(string itemId);
        Task<bool> HasKeysInModuleAsync(string moduleId);
        Task MoveKeysAsync(IReadOnlyCollection<string> itemIds, string targetModuleId);
        Task DeleteKeysAsync(IReadOnlyCollection<string> itemIds);

        /// <summary>Atomically removes each ID and returns only keys actually deleted, with per-ID failures.</summary>
        Task<BulkKeyDeleteResult> DeleteKeysWithSnapshotsAsync(IReadOnlyCollection<string> itemIds);

        /// <summary>
        /// The ItemIds of at most <paramref name="limit"/> keys matching the Key/Gets filter, reading ItemId only.
        /// Paging fields of the filter are ignored. Throws <see cref="KeyListException"/> QUERY_TIMEOUT (503) past
        /// the key list time limit.
        /// </summary>
        Task<MatchingKeyIds> GetMatchingKeyIdsAsync(GetKeysRequest filter, int limit);

        /// <summary>
        /// Counts one finished batch of a split bulk translate under its operation id, atomically, and returns the
        /// totals so far.
        /// </summary>
        Task<BulkTranslateProgress> RecordBulkTranslateBatchAsync(string operationId, bool succeeded);

        /// <summary>Removes the batch counter of a finished bulk translate.</summary>
        Task DeleteBulkTranslateProgressAsync(string operationId);

        /// <summary>The keys with these ItemIds, in one query; missing IDs are left out.</summary>
        Task<List<BlocksLanguageKey>> GetKeysByIdsAsync(IReadOnlyCollection<string> itemIds);

        /// <summary>
        /// Pulls the glossary id from GlossaryIds and the glossary's entries from GlossaryViolations of every key
        /// in the tenant, in one update. Returns the modified count.
        /// </summary>
        Task<long> RemoveGlossaryIdFromKeysAsync(string glossaryId);

        Task SetGlossaryViolationsAsync(string keyId, List<KeyGlossaryViolation> violations);

        /// <summary>
        /// One page of keys for the glossary re-check, ordered by ItemId after <paramref name="afterItemId"/>, with
        /// only ItemId, ModuleId, GlossaryIds, Resources, GlossaryViolations and LastUpdateDate loaded. A null scope selects every key.
        /// </summary>
        Task<List<BlocksLanguageKey>> GetKeysForGlossaryRecheckAsync(GlossaryRecheckKeyScope? scope, string? afterItemId, int pageSize);

        /// <summary>
        /// Sets GlossaryViolations ($set, nothing else) of each key in one unordered bulk write, skipping keys whose
        /// LastUpdateDate changed since they were read. Returns the modified count.
        /// </summary>
        Task<long> SetGlossaryViolationsManyAsync(IReadOnlyList<GlossaryViolationUpdate> updates);

        /// <summary>Tagged key count, one page of tagged keys, their module ids and the count of keys with violations of the glossary.</summary>
        Task<GlossaryKeyUsage> GetGlossaryKeyUsageAsync(string glossaryId, int pageNumber, int pageSize);

        /// <summary>
        /// Keys the glossary applies to: every key for a global glossary; otherwise keys tagged with it, keys in its
        /// modules and keys with stored violations of it.
        /// </summary>
        Task<long> CountKeysAffectedByGlossaryAsync(string glossaryId, bool isGlobal, IReadOnlyCollection<string> moduleIds);

        /// <summary>
        /// Removes GlossaryIds entries that reference no existing glossary, in batches. Returns the number of
        /// entries removed (or that would be removed, with <paramref name="dryRun"/>).
        /// </summary>
        Task<long> RemoveStaleGlossaryIdsAsync(IReadOnlyCollection<string> existingGlossaryIds, bool dryRun, int batchSize = 200);

        /// <summary>
        /// Removes GlossaryViolations entries whose glossary no longer exists, in batches. Returns the number of
        /// entries removed (or that would be removed, with <paramref name="dryRun"/>).
        /// </summary>
        Task<long> RemoveStaleGlossaryViolationsAsync(IReadOnlyCollection<string> existingGlossaryIds, bool dryRun, int batchSize = 200);

        Task<IQueryable<BlocksLanguageKey>> GetUilmResourceKeysWithPage(int page, int size, string? moduleId);
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
