using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared.Events;
using Eurolm.DomainService.Utilities;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;


namespace Worker.Consumers
{
    public class EuroLMEnvironmentDataMigrationEventConsumer : IConsumer<EnvironmentDataMigrationEvent>
    {
        private readonly IKeyManagementService _keyManagementService;
        private readonly IEnvironmentDataMigrationRepository _migrationRepository;
        private readonly ILogger<EuroLMEnvironmentDataMigrationEventConsumer> _logger;
        private readonly IMessageClient _messageClient;

        public EuroLMEnvironmentDataMigrationEventConsumer(
            IKeyManagementService keyManagementService,
            IEnvironmentDataMigrationRepository migrationRepository,
            ILogger<EuroLMEnvironmentDataMigrationEventConsumer> logger,
            IMessageClient messageClient)
        {
            _keyManagementService = keyManagementService;
            _migrationRepository = migrationRepository;
            _logger = logger;
            _messageClient = messageClient;
        }

        public async Task Consume(EnvironmentDataMigrationEvent @event)
        {
            try
            {
                _logger.LogInformation("Starting environment data migration from {ProjectKey} to {TargetedProjectKey}. OverwriteExisting: {ShouldOverwrite}",
                    @event.ProjectKey, @event.TargetedProjectKey, @event.ShouldOverWriteExistingData);

                // Migrate BlocksLanguageModule first (as Keys depend on Modules)
                await MigrateModulesAsync(@event);

                // Then migrate BlocksLanguageKey
                await MigrateKeysAsync(@event);

                // Update migration tracker for LanguageService completion
                if (!string.IsNullOrEmpty(@event.TrackerId))
                {
                    await NotifyMigrationCompletion(@event.TrackerId, isSuccess: true);
                    _logger.LogInformation("Updated migration tracker {TrackerId} for LanguageService completion", @event.TrackerId);
                }

                _logger.LogInformation("Environment data migration completed successfully from {ProjectKey} to {TargetedProjectKey}",
                    @event.ProjectKey, @event.TargetedProjectKey);
            }
            catch (Exception ex)
            {
                // Update migration tracker with error status if TrackerId is provided
                if (!string.IsNullOrEmpty(@event.TrackerId))
                {
                    try
                    {
                        _logger.LogInformation("Updated migration tracker {TrackerId} with error status", @event.TrackerId);
                    }
                    catch (Exception trackerEx)
                    {
                        _logger.LogError(trackerEx, "Failed to update migration tracker {TrackerId} with error status", @event.TrackerId);
                    }
                }

                // Send notification for failed migration
                await NotifyMigrationCompletion(@event.TrackerId, isSuccess: false, errorMessage: ex.Message);
                await _keyManagementService.PublishEnvironmentDataMigrationNotification(
                    response: false,
                    messageCoRelationId: @event.TrackerId,
                    projectKey: @event.ProjectKey,
                    targetedProjectKey: @event.TargetedProjectKey);

                _logger.LogError(ex, "Environment data migration failed from {ProjectKey} to {TargetedProjectKey}",
                    @event.ProjectKey, @event.TargetedProjectKey);
                throw;
            }
        }

        private async Task MigrateModulesAsync(EnvironmentDataMigrationEvent @event)
        {
            _logger.LogInformation("Starting BlocksLanguageModule migration from {ProjectKey} to {TargetedProjectKey}",
                @event.ProjectKey, @event.TargetedProjectKey);

            // Get source modules from source project database
            var sourceModules = await _migrationRepository.GetAllModulesAsync(@event.ProjectKey);

            if (!sourceModules.Any())
            {
                _logger.LogInformation("No modules found in source project {ProjectKey}", @event.ProjectKey);
                return;
            }

            // Get existing modules from target to preserve their ItemIds
            var sourceModuleNames = sourceModules.Select(m => m.ModuleName).ToList();
            var existingTargetModules = await _migrationRepository.GetExistingModulesByNamesAsync(sourceModuleNames, @event.TargetedProjectKey);

            // Handle potential duplicates by taking the first occurrence
            var existingModuleByName = existingTargetModules
                .GroupBy(m => m.ModuleName)
                .ToDictionary(g => g.Key, g => g.First());

            // Prepare modules for target environment - preserve existing ItemId or generate new one
            var targetModules = sourceModules.Select(sourceModule =>
            {
                // Use existing ItemId if module exists in target, otherwise generate new one
                var itemId = existingModuleByName.TryGetValue(sourceModule.ModuleName, out var existingModule)
                    ? existingModule.ItemId
                    : Guid.NewGuid().ToString();

                return new BlocksLanguageModule
                {
                    ItemId = itemId,
                    ModuleName = sourceModule.ModuleName,
                    Name = sourceModule.Name,
                    CreateDate = existingModule?.CreateDate ?? sourceModule.CreateDate, // Preserve target's create date if exists
                    LastUpdateDate = DateTime.UtcNow,
                    TenantId = @event.TargetedProjectKey,
                    CreatedBy = existingModule?.CreatedBy ?? sourceModule.CreatedBy,
                    LastUpdatedBy = sourceModule.LastUpdatedBy
                };
            }).ToList();

            // Bulk upsert modules using ModuleName as the unique key
            await _migrationRepository.BulkUpsertModulesByNameAsync(targetModules, @event.TargetedProjectKey, @event.ShouldOverWriteExistingData);

            var operationType = @event.ShouldOverWriteExistingData ? "upserted" : "inserted new";
            _logger.LogInformation("Bulk {OperationType} {Count} modules into target project {TargetedProjectKey}",
                operationType, targetModules.Count, @event.TargetedProjectKey);

            _logger.LogInformation("BlocksLanguageModule migration completed from {ProjectKey} to {TargetedProjectKey}",
                @event.ProjectKey, @event.TargetedProjectKey);
        }

        private async Task MigrateKeysAsync(EnvironmentDataMigrationEvent @event)
        {
            _logger.LogInformation("Starting BlocksLanguageKey migration from {ProjectKey} to {TargetedProjectKey}",
                @event.ProjectKey, @event.TargetedProjectKey);

            // Get source keys from source project database
            var sourceKeys = await _migrationRepository.GetAllKeysAsync(@event.ProjectKey);

            if (!sourceKeys.Any())
            {
                _logger.LogInformation("No keys found in source project {ProjectKey}", @event.ProjectKey);
                return;
            }

            // Get all modules from both source and target environments for ModuleName to ModuleId mapping
            var sourceModules = await _migrationRepository.GetAllModulesAsync(@event.ProjectKey);
            var targetModules = await _migrationRepository.GetAllModulesAsync(@event.TargetedProjectKey);

            // Create ModuleId -> ModuleName mapping for source (handle potential duplicates)
            var sourceModuleIdToNameMap = sourceModules
                .GroupBy(m => m.ItemId)
                .ToDictionary(g => g.Key, g => g.First().ModuleName);
            // Create ModuleName -> ModuleId mapping for target (handle potential duplicates)
            var targetModuleNameToIdMap = targetModules
                .GroupBy(m => m.ModuleName)
                .ToDictionary(g => g.Key, g => g.First().ItemId);

            // Build list of unique (ModuleName, KeyName) pairs for finding existing keys in target
            // Deduplicate by (ModuleName, KeyName) since same key may exist under modules with same name but different IDs
            var moduleKeyPairs = sourceKeys
                .Where(k => sourceModuleIdToNameMap.ContainsKey(k.ModuleId))
                .Select(k => (ModuleName: sourceModuleIdToNameMap[k.ModuleId], KeyName: k.KeyName))
                .Distinct()
                .ToList();

            // Get existing keys from target environment using ModuleName + KeyName combo
            var existingTargetKeys = await _migrationRepository.GetExistingKeysByModuleNameAndKeyNameAsync(
                moduleKeyPairs, targetModuleNameToIdMap, @event.TargetedProjectKey);

            // Create lookup for existing keys by ModuleId + KeyName
            var existingKeysByModuleIdAndKeyName = existingTargetKeys
                .GroupBy(k => $"{k.ModuleId}:{k.KeyName}")
                .ToDictionary(g => g.Key, g => g.First());

            // Prepare keys for target environment with mapped ModuleIds
            // Deduplicate source keys by (ModuleName, KeyName) - take the first/latest occurrence
            var targetKeys = sourceKeys
                .Where(sourceKey => sourceModuleIdToNameMap.ContainsKey(sourceKey.ModuleId)
                                 && targetModuleNameToIdMap.ContainsKey(sourceModuleIdToNameMap[sourceKey.ModuleId]))
                .GroupBy(sourceKey => (ModuleName: sourceModuleIdToNameMap[sourceKey.ModuleId], sourceKey.KeyName))
                .Select(group =>
                {
                    // Take the most recently updated key if there are duplicates
                    var sourceKey = group.OrderByDescending(k => k.LastUpdateDate).First();
                    var moduleName = sourceModuleIdToNameMap[sourceKey.ModuleId];
                    var targetModuleId = targetModuleNameToIdMap[moduleName];

                    // Check if key already exists in target - use existing ItemId or generate new one
                    var lookupKey = $"{targetModuleId}:{sourceKey.KeyName}";
                    var existingKey = existingKeysByModuleIdAndKeyName.TryGetValue(lookupKey, out var existing) ? existing : null;

                    return new BlocksLanguageKey
                    {
                        ItemId = existingKey?.ItemId ?? Guid.NewGuid().ToString(), // Preserve existing ItemId or generate new
                        KeyName = sourceKey.KeyName,
                        ModuleId = targetModuleId, // Map to target environment's ModuleId
                        Value = sourceKey.Value,
                        Resources = sourceKey.Resources,
                        Routes = sourceKey.Routes,
                        IsPartiallyTranslated = sourceKey.IsPartiallyTranslated,
                        CreateDate = existingKey?.CreateDate ?? sourceKey.CreateDate, // Preserve target's create date if exists
                        LastUpdateDate = DateTime.UtcNow,
                        TenantId = @event.TargetedProjectKey,
                        CreatedBy = existingKey?.CreatedBy ?? sourceKey.CreatedBy,
                        LastUpdatedBy = sourceKey.LastUpdatedBy
                    };
                }).ToList();

            // Log any keys that couldn't be migrated due to missing module mapping or deduplication
            var processedKeysCount = sourceKeys
                .Where(k => sourceModuleIdToNameMap.ContainsKey(k.ModuleId)
                         && targetModuleNameToIdMap.ContainsKey(sourceModuleIdToNameMap[k.ModuleId]))
                .Count();
            var skippedKeysCount = sourceKeys.Count - processedKeysCount;
            var deduplicatedCount = processedKeysCount - targetKeys.Count;

            if (skippedKeysCount > 0)
            {
                _logger.LogWarning("Skipped {SkippedCount} keys due to missing module mapping in target environment", skippedKeysCount);
            }
            if (deduplicatedCount > 0)
            {
                _logger.LogInformation("Deduplicated {DeduplicatedCount} keys with same ModuleName+KeyName combination", deduplicatedCount);
            }

            // Bulk upsert keys using ModuleName + KeyName as the unique key
            var upsertResult = await _migrationRepository.BulkUpsertKeysByModuleNameAndKeyNameAsync(
                targetKeys, existingTargetKeys, targetModuleNameToIdMap, @event.TargetedProjectKey, @event.ShouldOverWriteExistingData);

            var operationType = @event.ShouldOverWriteExistingData ? "upserted" : "inserted new";
            var affectedKeysCount = @event.ShouldOverWriteExistingData ? targetKeys.Count : upsertResult.InsertedKeys.Count;
            _logger.LogInformation("Bulk {OperationType} {Count} keys into target project {TargetedProjectKey}",
                operationType, affectedKeysCount, @event.TargetedProjectKey);

            // Create timeline entries based on the ShouldOverWriteExistingData flag
            if (@event.ShouldOverWriteExistingData)
            {
                // When overwriting, create timeline entries for all keys with their previous data
                await _keyManagementService.CreateBulkKeyTimelineEntriesAsync(targetKeys, existingTargetKeys, LogFromConstants.EnvironmentDataMigration, @event.TargetedProjectKey);
            }
            else
            {
                // When not overwriting, only create timeline entries for keys that were actually inserted (new keys)
                if (upsertResult.InsertedKeys.Any())
                {
                    await _keyManagementService.CreateBulkKeyTimelineEntriesAsync(upsertResult.InsertedKeys, LogFromConstants.EnvironmentDataMigration, @event.TargetedProjectKey);
                }
            }

            _logger.LogInformation("BlocksLanguageKey migration completed from {ProjectKey} to {TargetedProjectKey}",
                @event.ProjectKey, @event.TargetedProjectKey);
        }

        private async Task NotifyMigrationCompletion(string trackerId, bool isSuccess, string? errorMessage = null)
        {
            var completionEvent = new MigrationCompletionEvent
            {
                TrackerId = trackerId,
                ServiceName = "Language",
                IsSuccess = isSuccess,
                ErrorMessage = errorMessage
            };

            await _messageClient.SendToMassConsumerAsync(new ConsumerMessage<MigrationCompletionEvent>
            {
                ConsumerName = Constants.MigrationCompletionTopic,
                Payload = completionEvent
            });
        }
    }
}
