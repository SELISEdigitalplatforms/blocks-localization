using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared.Entities;
using MongoDB.Driver;

namespace Eurolm.DomainService.Repositories
{
    public interface IEnvironmentDataMigrationRepository
    {
        Task<List<BlocksLanguageModule>> GetAllModulesAsync(string tenantId);
        Task<List<BlocksLanguageKey>> GetAllKeysAsync(string tenantId);
        Task<List<BlocksLanguageKey>> GetExistingKeysByItemIdsAsync(List<string> itemIds, string tenantId);
        Task<List<BlocksLanguageKey>> GetExistingKeysByModuleNameAndKeyNameAsync(List<(string ModuleName, string KeyName)> moduleKeyPairs, Dictionary<string, string> moduleNameToIdMap, string tenantId);
        Task<List<BlocksLanguageModule>> GetExistingModulesByNamesAsync(List<string> moduleNames, string tenantId);
        Task BulkUpsertModulesAsync(List<BlocksLanguageModule> modules, string tenantId, bool shouldOverwrite);
        Task BulkUpsertModulesByNameAsync(List<BlocksLanguageModule> modules, string tenantId, bool shouldOverwrite);
        Task<BulkUpsertResult> BulkUpsertKeysAsync(List<BlocksLanguageKey> keys, List<BlocksLanguageKey> existingTargetKeys, string tenantId, bool shouldOverwrite);
        Task<BulkUpsertResult> BulkUpsertKeysByModuleNameAndKeyNameAsync(List<BlocksLanguageKey> keys, List<BlocksLanguageKey> existingTargetKeys, Dictionary<string, string> targetModuleNameToIdMap, string tenantId, bool shouldOverwrite);
        Task UpdateMigrationTrackerAsync(string trackerId, ServiceMigrationStatus LanguageServiceStatus);
    }

    public class BulkUpsertResult
    {
        public List<BlocksLanguageKey> UpsertedKeys { get; set; } = new List<BlocksLanguageKey>();
        public List<BlocksLanguageKey> InsertedKeys { get; set; } = new List<BlocksLanguageKey>();
        public List<BlocksLanguageKey> UpdatedKeys { get; set; } = new List<BlocksLanguageKey>();
    }
}
