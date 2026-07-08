using Blocks.Genesis;
using ClosedXML.Excel;
using CsvHelper;
using CsvHelper.Configuration;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared;
using Eurolm.DomainService.Shared.Entities;
using Eurolm.DomainService.Shared.Events;
using Eurolm.DomainService.Shared.Utilities;
using Eurolm.DomainService.Services.HelperService;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using Newtonsoft.Json;
using StorageDriver;
using System.Globalization;
using System.Text;
using System.Xml.Linq;
using DomainService.Storage;

namespace Eurolm.DomainService.Services
{
    public class KeyManagementService : IKeyManagementService
    {
        private readonly IKeyRepository _keyRepository;
        private readonly IKeyTimelineRepository _keyTimelineRepository;
        private readonly ILanguageFileGenerationHistoryRepository _languageFileGenerationHistoryRepository;
        private readonly IValidator<Key> _validator;
        private readonly ILogger<KeyManagementService> _logger;
        private readonly ILanguageManagementService _languageManagementService;
        private readonly IModuleManagementService _moduleManagementService;
        private readonly IMessageClient _messageClient;
        private readonly IAssistantService _assistantService;
        private readonly IStorageDriverService _storageDriverService;
        private readonly IServiceProvider _serviceProvider;
        private readonly StorageHelper _storageHelperService;
        private readonly INotificationService _notificationService;
        private readonly IGlossaryRepository _glossaryRepository;

        private BaseBlocksCommand _blocksBaseCommand;
        private readonly string _tenantId = BlocksContext.GetContext()?.TenantId ?? "";
        private const string DateTimeFormat = "yyyyMMddHHmmss";

        public KeyManagementService(
            IKeyRepository keyRepository,
            IKeyTimelineRepository keyTimelineRepository,
            ILanguageFileGenerationHistoryRepository languageFileGenerationHistoryRepository,
            IValidator<Key> validator,
            ILogger<KeyManagementService> logger,
            ILanguageManagementService languageManagementService,
            IModuleManagementService moduleManagementService,
            IMessageClient messageClient,
            IAssistantService assistantService,
            IStorageDriverService storageDriverService,
            StorageHelper storageHelperService,
            IServiceProvider serviceProvider,
            INotificationService notificationService,
            IGlossaryRepository glossaryRepository
            )
        {
            _keyRepository = keyRepository;
            _keyTimelineRepository = keyTimelineRepository;
            _languageFileGenerationHistoryRepository = languageFileGenerationHistoryRepository;
            _validator = validator;
            _logger = logger;
            _languageManagementService = languageManagementService;
            _moduleManagementService = moduleManagementService;
            _messageClient = messageClient;
            _assistantService = assistantService;
            _storageDriverService = storageDriverService;
            _storageHelperService = storageHelperService;
            _serviceProvider = serviceProvider;
            _notificationService = notificationService;
            _glossaryRepository = glossaryRepository;
        }

        public async Task<ApiResponse> SaveKeyAsync(Key key)
        {
            var validationResult = await _validator.ValidateAsync(key);

            if (!validationResult.IsValid)
                return new ApiResponse(string.Empty, validationResult.Errors);

            try
            {
                // Get existing key for timeline tracking
                var existingRepoKey = await _keyRepository.GetKeyByNameAsync(key.KeyName, key.ModuleId);
                BlocksLanguageKey? previousKey = null;
                bool isNewKey = existingRepoKey == null;

                if (!isNewKey && existingRepoKey != null)
                {
                    previousKey = existingRepoKey;
                }

                var repoKey = await MappedIntoRepoKeyAsync(key);
                await _keyRepository.SaveKeyAsync(repoKey);
                if (key != null && key.ShouldPublish == true)
                {
                    var request = new GenerateUilmFilesRequest
                    {
                        Guid = key.ItemId,
                        ModuleId = key.ModuleId,
                        ProjectKey = BlocksContext.GetContext().TenantId??""
                    };
                    await SendGenerateUilmFilesEvent(request);
                }

                // Create timeline entry
                if (repoKey != null)
                {
                    if (isNewKey)
                    {
                        await CreateKeyTimelineEntryAsync(null, repoKey, LogFromConstants.KeyCreate);
                    }
                    else
                    {
                        await CreateKeyTimelineEntryAsync(previousKey, repoKey, LogFromConstants.KeySave);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError("Error while saving BlocksLanguage {ErrorMessage} : {StackTrace}", ex.Message, ex.StackTrace);
                return new ApiResponse(ex.Message);
            }

            return new ApiResponse();
        }

        public async Task<ApiResponse> SaveKeysAsync(List<Key> keys)
        {
            if (keys == null || !keys.Any())
            {
                return new ApiResponse("Keys list cannot be null or empty.");
            }

            var errors = new List<string>();
            var successCount = 0;
            var bulkOperationId = Guid.NewGuid().ToString();

            foreach (var key in keys)
            {
                try
                {
                    var validationResult = await _validator.ValidateAsync(key);

                    if (!validationResult.IsValid)
                    {
                        var validationErrors = string.Join("; ", validationResult.Errors.Select(e => $"{e.PropertyName}: {e.ErrorMessage}"));
                        errors.Add($"Key '{key.KeyName}' in Module '{key.ModuleId}': {validationErrors}");
                        continue;
                    }

                    // Get existing key for timeline tracking
                    var existingRepoKey = await _keyRepository.GetKeyByNameAsync(key.KeyName, key.ModuleId);
                    BlocksLanguageKey? previousKey = null;
                    bool isNewKey = existingRepoKey == null;

                    if (!isNewKey && existingRepoKey != null)
                    {
                        previousKey = existingRepoKey;
                    }

                    var repoKey = await MappedIntoRepoKeyAsync(key);
                    await _keyRepository.SaveKeyAsync(repoKey);

                    if (key.ShouldPublish == true)
                    {
                        var request = new GenerateUilmFilesRequest
                        {
                            Guid = key.ItemId,
                            ModuleId = key.ModuleId,
                            ProjectKey = BlocksContext.GetContext().TenantId??""
                        };
                        await SendGenerateUilmFilesEvent(request);
                    }

                    // Create timeline entry
                    if (repoKey != null)
                    {
                        if (isNewKey)
                        {
                            await CreateKeyTimelineEntryAsync(null, repoKey, LogFromConstants.KeyBulkCreate, bulkOperationId);
                        }
                        else
                        {
                            await CreateKeyTimelineEntryAsync(previousKey, repoKey, LogFromConstants.KeyBulkSave, bulkOperationId);
                        }
                    }

                    successCount++;
                }
                catch (Exception ex)
                {
                    _logger.LogError("Error while saving Key '{KeyName}' in Module '{ModuleId}': {ErrorMessage}", key.KeyName, key.ModuleId, ex.Message);
                    errors.Add($"Key '{key.KeyName}' in Module '{key.ModuleId}': {ex.Message}");
                }
            }

            _logger.LogInformation("Bulk save completed. Success: {SuccessCount}, Errors: {ErrorCount}", successCount, errors.Count);

            if (errors.Any())
            {
                var errorMessage = string.Format("Bulk save completed with {0} errors out of {1} keys:\n{2}", errors.Count, keys.Count, string.Join("\n", errors));
                return new ApiResponse(errorMessage);
            }

            return new ApiResponse();
        }

        private async Task<BlocksLanguageKey> MappedIntoRepoKeyAsync(Key key)
        {
            var repoKey = await _keyRepository.GetKeyByNameAsync(key.KeyName, key.ModuleId);

            if (repoKey == null)
                repoKey = new BlocksLanguageKey { ItemId = Guid.NewGuid().ToString(), CreateDate = DateTime.UtcNow, TenantId = _tenantId };

            repoKey.LastUpdateDate = DateTime.UtcNow;
            repoKey.KeyName = key.KeyName;
            repoKey.ModuleId = key.ModuleId;
            repoKey.Resources = key.Resources;
            repoKey.IsPartiallyTranslated = key.IsPartiallyTranslated;
            repoKey.Routes = key.Routes;
            repoKey.GlossaryIds = key.GlossaryIds;
            repoKey.Context = key.Context;

            return repoKey;
        }

        public async Task<GetKeysQueryResponse> GetKeysAsync(GetKeysRequest query)
        {
            return await _keyRepository.GetAllKeysAsync(query);
        }

        public async Task<GetKeysByKeyNamesResponse> GetKeysByKeyNamesAsync(GetKeysByKeyNamesRequest request)
        {
            if (request.KeyNames == null || request.KeyNames.Length == 0)
            {
                return new GetKeysByKeyNamesResponse { ErrorMessage = "KeyNames must not be empty." };
            }

            try
            {
                var keys = await _keyRepository.GetKeysByKeyNamesAsync(request.KeyNames, request.ModuleId);
                return new GetKeysByKeyNamesResponse { Keys = keys };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving keys by key names.");
                return new GetKeysByKeyNamesResponse { ErrorMessage = "An error occurred while retrieving keys." };
            }
        }

        public async Task<GetUilmExportedFilesQueryResponse> GetUilmExportedFilesAsync(GetUilmExportedFilesRequest request)
        {
            return await _keyRepository.GetUilmExportedFilesAsync(request);
        }

        public async Task<GetKeyTimelineQueryResponse> GetKeyTimelineAsync(GetKeyTimelineRequest query)
        {
            return await _keyTimelineRepository.GetKeyTimelineAsync(query);
        }

        public async Task<GetLocalizationTimelineResponse> GetLocalizationTimelineAsync(GetLocalizationTimelineRequest query)
        {
            return await _keyTimelineRepository.GetLocalizationTimelineAsync(query);
        }

        public async Task<GetKeyTimelineQueryResponse> GetTimelineByOperationIdAsync(GetTimelineByOperationIdRequest query)
        {
            return await _keyTimelineRepository.GetTimelineByOperationIdAsync(query);
        }

        public async Task<Key?> GetAsync(GetKeyRequest request)
        {
            var key = await _keyRepository.GetByIdAsync(request.ItemId);
            return key;
        }

        public async Task<GetSuggestedGlossariesResponse> GetSuggestedGlossariesAsync(GetSuggestedGlossariesRequest request)
        {
            var response = new GetSuggestedGlossariesResponse();

            var key = await _keyRepository.GetByIdAsync(request.ItemId);
            if (key?.Resources == null || key.Resources.Length == 0)
                return response;

            var resourceValues = key.Resources
                .Where(r => !string.IsNullOrWhiteSpace(r.Value))
                .Select(r => r.Value)
                .ToList();

            if (resourceValues.Count == 0)
                return response;

            var glossariesRequest = new GetGlossariesRequest
            {
                PageNumber = 0,
                PageSize = 100
            };
            var glossariesResult = await _glossaryRepository.GetAllAsync(glossariesRequest);

            if (glossariesResult?.Items == null || glossariesResult.Items.Count == 0)
                return response;

            var matched = new List<Glossary>();

            foreach (var glossary in glossariesResult.Items)
            {
                if (matched.Count >= request.MaxResults)
                    break;

                var isMatch = false;

                foreach (var resourceValue in resourceValues)
                {
                    if (!string.IsNullOrWhiteSpace(glossary.Name) &&
                        System.Text.RegularExpressions.Regex.IsMatch(
                            resourceValue, System.Text.RegularExpressions.Regex.Escape(glossary.Name),
                            System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                    {
                        isMatch = true;
                        break;
                    }

                    if (!string.IsNullOrWhiteSpace(glossary.Context) &&
                        System.Text.RegularExpressions.Regex.IsMatch(
                            resourceValue, System.Text.RegularExpressions.Regex.Escape(glossary.Context),
                            System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                    {
                        isMatch = true;
                        break;
                    }
                }

                if (isMatch)
                    matched.Add(glossary);
            }

            response.SuggestedGlossaries = matched;
            return response;
        }

        public async Task<BaseMutationResponse> DeleteAsysnc(DeleteKeyRequest request)
        {
            _logger.LogInformation("Deleting Key start");

            var key = await _keyRepository.GetByIdAsync(request.ItemId);
            if (key == null)
            {
                _logger.LogInformation("Deleting Key end -- Key not found");

                return new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "ItemId", "Key not found" }
                    }
                };
            }

            // Create timeline entry before deletion
            BlocksLanguageKey? repoKey = null;
            try
            {
                // Get the repository key for timeline before deletion
                repoKey = await _keyRepository.GetKeyByNameAsync(key.KeyName, key.ModuleId);
            }
            catch (Exception ex)
            {
                _logger.LogError("Failed to get key data for timeline before deletion {KeyId}: {Error}", key.ItemId, ex.Message);
            }

            await _keyRepository.DeleteAsync(request.ItemId);

            // Create timeline entry after successful deletion � CurrentData is null since the key is deleted
            if (repoKey != null)
            {
                try
                {
                    await CreateKeyTimelineEntryAsync(repoKey, null, LogFromConstants.KeyDelete, entityId: repoKey.ItemId);
                }
                catch (Exception ex)
                {
                    _logger.LogError("Failed to create timeline entry for deleted Key {KeyId}: {Error}", key.ItemId, ex.Message);
                }
            }

            _logger.LogInformation("Deleting Key end -- Success");
            return new BaseMutationResponse { IsSuccess = true };
        }

        public async Task<BaseMutationResponse> DeleteKeysAsync(DeleteKeysRequest request)
        {
            _logger.LogInformation("Bulk deleting Keys start. Count: {Count}", request.ItemIds.Count);

            var errors = new Dictionary<string, string>();
            var bulkOperationId = Guid.NewGuid().ToString();

            foreach (var itemId in request.ItemIds)
            {
                try
                {
                    var key = await _keyRepository.GetByIdAsync(itemId);
                    if (key == null)
                    {
                        errors[itemId] = "Key not found";
                        continue;
                    }

                    BlocksLanguageKey? repoKey = null;
                    try
                    {
                        repoKey = await _keyRepository.GetKeyByNameAsync(key.KeyName, key.ModuleId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError("Failed to get key data for timeline before bulk deletion {KeyId}: {Error}", itemId, ex.Message);
                    }

                    await _keyRepository.DeleteAsync(itemId);

                    if (repoKey != null)
                    {
                        try
                        {
                            await CreateKeyTimelineEntryAsync(repoKey, null, LogFromConstants.KeyBulkDelete, bulkOperationId, entityId: repoKey.ItemId);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError("Failed to create timeline entry for bulk deleted Key {KeyId}: {Error}", itemId, ex.Message);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError("Error while bulk deleting Key '{KeyId}': {Error}", itemId, ex.Message);
                    errors[itemId] = ex.Message;
                }
            }

            _logger.LogInformation("Bulk deleting Keys end. Errors: {ErrorCount}", errors.Count);

            if (errors.Any())
            {
                return new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = errors
                };
            }

            return new BaseMutationResponse { IsSuccess = true };
        }

        public async Task<bool> ChangeAll(TranslateAllEvent request)
        {
            List<Language> languageSetting = await _languageManagementService.GetLanguagesAsync();

            var page = 0;
            var pageSize = 1000;
            var changeAllOperationId = Guid.NewGuid().ToString();

            while (true)
            {

                IQueryable<BlocksLanguageKey> dbResourceKeys = await _keyRepository.GetUilmResourceKeysWithPage(page, pageSize);

                if (!dbResourceKeys.Any())
                {
                    break;
                }

                // Create deep copies of original keys for timeline tracking
                var originalResourceKeys = new Dictionary<string, BlocksLanguageKey>();
                foreach (var key in dbResourceKeys)
                {
                    var originalKey = JsonConvert.DeserializeObject<BlocksLanguageKey>(JsonConvert.SerializeObject(key));
                    if (originalKey != null)
                    {
                        originalResourceKeys[key.ItemId] = originalKey;
                    }
                }

                var resourceKeys = await ProcessChangeAll(request, dbResourceKeys, languageSetting);

                if (resourceKeys.Any())
                {
                    await UpdateResourceKey(resourceKeys, request, originalResourceKeys, changeAllOperationId);
                }

                page++;
            }

            return true;
        }

        public async Task<bool> TranslateBlocksLanguageKey(TranslateBlocksLanguageKeyEvent request)
        {
            try
            {
                List<Language> languageSetting = await _languageManagementService.GetLanguagesAsync();

                // Get the specific key by ID
                var resourceKey = await _keyRepository.GetUilmResourceKey(
                    x => x.ItemId == request.KeyId,
                    BlocksContext.GetContext()?.TenantId ?? ""
                );

                if (resourceKey == null)
                {
                    _logger.LogWarning("TranslateBlocksLanguageKey: Key with ID {KeyId} not found", request.KeyId);
                    return false;
                }

                // Create deep copy for timeline tracking
                var originalKey = JsonConvert.DeserializeObject<BlocksLanguageKey>(JsonConvert.SerializeObject(resourceKey));

                var uilmResourceKeyList = new List<BlocksLanguageKey>();

                // Convert event to TranslateAllEvent format for reusing existing logic
                var translateAllEvent = new TranslateAllEvent
                {
                    MessageCoRelationId = request.MessageCoRelationId,
                    ProjectKey = request.ProjectKey,
                    DefaultLanguage = request.DefaultLanguage,
                    ModuleId = resourceKey.ModuleId // Use the ModuleId from the retrieved key
                };

                await ProcessResourceKey(translateAllEvent, resourceKey, languageSetting, uilmResourceKeyList);

                if (uilmResourceKeyList.Any())
                {
                    var originalResourceKeys = new Dictionary<string, BlocksLanguageKey>();
                    if (originalKey != null)
                    {
                        originalResourceKeys[resourceKey.ItemId] = originalKey;
                    }

                    await UpdateResourceKey(uilmResourceKeyList, translateAllEvent, originalResourceKeys, null, LogFromConstants.TranslateKey);
                }

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while translating BlocksLanguageKey with ID {KeyId}", request.KeyId);
                return false;
            }
        }

        public async Task<bool> TranslateBlocksLanguageKeys(TranslateBlocksLanguageKeysEvent request)
        {
            try
            {
                List<Language> languageSetting = await _languageManagementService.GetLanguagesAsync();

                var uilmResourceKeyList = new List<BlocksLanguageKey>();
                var originalResourceKeys = new Dictionary<string, BlocksLanguageKey>();

                foreach (var keyId in request.KeyIds)
                {
                    var resourceKey = await _keyRepository.GetUilmResourceKey(
                        x => x.ItemId == keyId,
                        BlocksContext.GetContext()?.TenantId ?? ""
                    );

                    if (resourceKey == null)
                    {
                        _logger.LogWarning("TranslateBlocksLanguageKeys: Key with ID {KeyId} not found", keyId);
                        continue;
                    }

                    var originalKey = JsonConvert.DeserializeObject<BlocksLanguageKey>(JsonConvert.SerializeObject(resourceKey));
                    if (originalKey != null)
                    {
                        originalResourceKeys[resourceKey.ItemId] = originalKey;
                    }

                    var translateAllEvent = new TranslateAllEvent
                    {
                        MessageCoRelationId = request.MessageCoRelationId,
                        ProjectKey = request.ProjectKey,
                        DefaultLanguage = request.DefaultLanguage,
                        ModuleId = resourceKey.ModuleId
                    };

                    await ProcessResourceKey(translateAllEvent, resourceKey, languageSetting, uilmResourceKeyList);
                }

                if (uilmResourceKeyList.Any())
                {
                    var translateAllEvent = new TranslateAllEvent
                    {
                        MessageCoRelationId = request.MessageCoRelationId,
                        ProjectKey = request.ProjectKey,
                        DefaultLanguage = request.DefaultLanguage
                    };

                    await UpdateResourceKey(uilmResourceKeyList, translateAllEvent, originalResourceKeys, request.OperationId, LogFromConstants.BulkTranslateKey);
                }

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while bulk translating BlocksLanguageKeys");
                return false;
            }
        }

        public async Task<List<BlocksLanguageKey>> ProcessChangeAll(TranslateAllEvent request, IQueryable<BlocksLanguageKey> dbResourceKeys, List<Language> languageSetting)
        {
            var uilmResourceKeyList = new List<BlocksLanguageKey>();
            foreach (var resourceKey in dbResourceKeys)
            {
                await ProcessResourceKey(request, resourceKey, languageSetting, uilmResourceKeyList);
            }
            return uilmResourceKeyList;
        }

        public async Task ProcessResourceKey(TranslateAllEvent request, BlocksLanguageKey resourceKey, List<Language> languageSetting, List<BlocksLanguageKey> uilmResourceKeyList)
        {
            var keyName = resourceKey.KeyName;
            var resources = resourceKey.Resources?.ToList();

            EmptyResourcesThatHasReservedKeywords(uilmResourceKeyList, resourceKey, resources, request.DefaultLanguage);

            var defaultResource = resources?.FirstOrDefault(x => x.Culture == request.DefaultLanguage);
            List<Resource> missingResources = GetMissingResources(keyName, resources, defaultResource, request.DefaultLanguage);

            CompareAndAddResources(missingResources, resources, languageSetting);

            if (missingResources.Any())
            {
                foreach (var missingResource in missingResources)
                {
                    await ProcessMissingResource(request, resourceKey, defaultResource, missingResource, resources, languageSetting);
                }

                resourceKey.Resources = resources.ToArray();
                resourceKey.LastUpdateDate = DateTime.Now;
                resourceKey.ItemId = string.IsNullOrWhiteSpace(resourceKey.ItemId) ? Guid.NewGuid().ToString() : resourceKey.ItemId;

                uilmResourceKeyList.Add(resourceKey);
            }
        }

        public static bool ShouldSkipResource(Resource defaultResource, string keyName, TranslateAllEvent request)
        {
            return string.IsNullOrEmpty(defaultResource?.Value) || (defaultResource?.Value == keyName);
        }

        public static List<Resource> GetMissingResources(string keyName, List<Resource> resources, Resource defaultResource, string defaultLanguage)
        {
            return resources.Where(x => x.Culture != defaultLanguage && (x.Value == "" || x.Value == null)).ToList();
        }

        public void CompareAndAddResources(List<Resource> missingResources, IEnumerable<Resource> resources,
            List<Language> languageSetting)
        {
            var languageCodes = languageSetting.Select(x => x.LanguageCode).ToList();
            var resourceCultures = resources.Select(x => x.Culture).ToList();

            var missingCultures = languageCodes.Except(resourceCultures).ToList();

            if (missingCultures.Any())
            {
                foreach (var missingCulture in missingCultures)
                {
                    missingResources.Add(new Resource
                    {
                        Culture = missingCulture
                    });
                }
            }
        }

        public async Task ProcessMissingResource(TranslateAllEvent request, BlocksLanguageKey resourceKey, Resource defaultResource, Resource missingResource, List<Resource> resources, List<Language> languageSetting)
        {
            var languageName = languageSetting?.FirstOrDefault(x => x.LanguageCode == missingResource.Culture)?.LanguageName;

            if (string.IsNullOrEmpty(languageName))
            {
                _logger.LogError("ChangeAll: No language name found for languageCode {MisssingResourceCulture}", missingResource.Culture);
                return;
            }

            missingResource.Value = await _assistantService.SuggestTranslation(ConstructQuery(request, resourceKey, defaultResource, missingResource, languageName, languageSetting));

            var matchedResource = resources.FirstOrDefault(x => x.Culture == missingResource.Culture);
            if (matchedResource != null)
            {
                resources.Remove(matchedResource);
            }
            resources.Add(missingResource);
        }

        public static SuggestLanguageRequest ConstructQuery(TranslateAllEvent request, BlocksLanguageKey resourceKey,
            Resource defaultResource, Resource missingResource, string languageName, List<Language> languageSetting)
        {
            return new()
            {
                Temperature = 0.1,
                ElementDetailContext = resourceKey.Context,
                SourceText = defaultResource?.Value,
                DestinationLanguage = languageName,
                CurrentLanguage = languageSetting?.FirstOrDefault(x => x.LanguageCode == request.DefaultLanguage).LanguageName,
                GlossaryIds = resourceKey.GlossaryIds,
                DestinationLanguageCode = missingResource.Culture,
                ModuleId = resourceKey.ModuleId
            };
        }

        public static void EmptyResourcesThatHasReservedKeywords(List<BlocksLanguageKey> missingResourceKeyResponseList, BlocksLanguageKey resourceKey, List<Resource> resources, string defaultLanguage)
        {
            if (HasKeywordValue(resources, defaultLanguage))
            {
                foreach (var item in resources)
                {
                    item.Value = "";
                }

                missingResourceKeyResponseList.Add(resourceKey);
            }
        }

        public static bool HasKeywordValue(List<Resource> resources, string defaultLanguage)
        {
            var keywordResources = resources.FirstOrDefault(x => x.Culture == defaultLanguage && x.Value?.ToUpper() == "KEY_MISSING");

            return keywordResources != null;
        }

        public async Task UpdateResourceKey(List<BlocksLanguageKey> resourceKeys, TranslateAllEvent request, Dictionary<string, BlocksLanguageKey>? originalResourceKeys = null, string? translateAllOperationId = null, string logFrom = null)
        {
            logFrom ??= LogFromConstants.TranslateAll;
            translateAllOperationId ??= Guid.NewGuid().ToString();
            var updateCount = await _keyRepository.UpdateUilmResourceKeysForChangeAll(resourceKeys);

            // Create timeline entries for updated keys
            foreach (var resourceKey in resourceKeys)
            {
                try
                {
                    // Use the original key for timeline comparison if available
                    BlocksLanguageKey? previousKey = null;
                    if (originalResourceKeys != null && originalResourceKeys.ContainsKey(resourceKey.ItemId))
                    {
                        previousKey = originalResourceKeys[resourceKey.ItemId];
                    }

                    await CreateKeyTimelineEntryAsync(previousKey, resourceKey, logFrom, translateAllOperationId);
                }
                catch (Exception ex)
                {
                    _logger.LogError("Failed to create timeline entry for Key {KeyId} during TranslateAll: {Error}", resourceKey.ItemId, ex.Message);
                }
            }

            _logger.LogInformation("ChangeAll: Uilm Resource key updated: {UpdateCount}", updateCount);
        }

        public async Task<bool> GenerateAsync(GenerateUilmFilesEvent command)
        {
            _logger.LogInformation("++ Started JsonOutputGeneratorService: GenerateAsync()...");

            List<Language> languageSetting = await _languageManagementService.GetLanguagesAsync();

            List<BlocksLanguageModule> applications = string.IsNullOrWhiteSpace(command.ModuleId)
                ? await _moduleManagementService.GetModulesAsync()
                : await _moduleManagementService.GetModulesAsync(command.ModuleId);

            _logger.LogInformation("++ JsonOutputGeneratorService: GenerateAsync()... Found {ApplicationsCount} UilmApplications.", applications.Count);

            var publishedKeys = new List<Key>();
            var failedKeys = new List<Key>();

            foreach (BlocksLanguageModule application in applications)
            {
                List<Key> resourceKeys = await _keyRepository.GetAllKeysByModuleAsync(application.ItemId);
                _logger.LogInformation("++ JsonOutputGeneratorService: GenerateAsync()... Found {ResourceKeysCount} UilmResourceKeys for UilmApplication={ApplicationName}.", resourceKeys.Count, application.ModuleName);

                try
                {
                    List<UilmFile> uilmfiles = ProcessUilmFile(command, languageSetting, resourceKeys, application);

                    _logger.LogInformation("++Saving {UilmfilesCount} UilmFiles for UilmApplication={ApplicationName}", uilmfiles.Count, application.ModuleName);
                    await SaveUniqeFiles(uilmfiles);

                    publishedKeys.AddRange(resourceKeys);
                }
                catch (Exception ex)
                {
                    _logger.LogError("Failed to publish keys for module {ModuleId}: {Error}", application.ItemId, ex.Message);
                    failedKeys.AddRange(resourceKeys);
                }
            }
            // Create history entry for this generation
            var latestHistory = await _languageFileGenerationHistoryRepository.GetLatestLanguageFileGenerationHistory(command.ProjectKey ?? "");
            var newVersion = (latestHistory?.Version ?? 0) + 1;

            var historyEntry = new LanguageFileGenerationHistory
            {
                ItemId = Guid.NewGuid().ToString(),
                CreateDate = DateTime.UtcNow,
                Version = newVersion,
                ModuleId = command.ModuleId,
                ProjectKey = command.ProjectKey ?? ""
            };

            await _languageFileGenerationHistoryRepository.SaveAsync(historyEntry);
            _logger.LogInformation("++Created LanguageFileGenerationHistory entry with Version={Version} for ProjectKey={ProjectKey}", newVersion, command.ProjectKey);

            _logger.LogInformation("++JsonOutputGeneratorService: GenerateAsync execution successful!");

            if (!string.IsNullOrWhiteSpace(command.ModuleId))
            {
                await _notificationService.NotifyExtensionEvent(true, command.ProjectKey);
            }

            // Bulk-insert timeline entries after all operations are complete
            if (publishedKeys.Any())
            {
                var mappedPublishedKeys = publishedKeys.Select(MapKeyToBlocksLanguageKey).ToList();
                var entityIds = mappedPublishedKeys.Select(k => k.ItemId).ToList();
                var previousPublishTimelines = await _keyTimelineRepository.GetLatestPublishTimelinesAsync(entityIds, command.ProjectKey ?? "") ?? new Dictionary<string, KeyTimeline>();

                // Filter out keys with no resource changes since last publish
                var changedKeys = mappedPublishedKeys
                    .Where(key => HasResourceChanges(key, previousPublishTimelines))
                    .ToList();

                if (changedKeys.Any())
                {
                    var previousKeys = changedKeys
                        .Where(k => previousPublishTimelines.ContainsKey(k.ItemId) && previousPublishTimelines[k.ItemId].CurrentData != null)
                        .Select(k => previousPublishTimelines[k.ItemId].CurrentData!)
                        .ToList();

                    await CreateBulkKeyTimelineEntriesAsync(changedKeys, previousKeys, LogFromConstants.Published, command.ProjectKey ?? "");
                }
                else
                {
                    // All keys unchanged � create a single no-change publish timeline entry
                    await CreateNoChangePublishTimelineEntryAsync(LogFromConstants.Published, command.ProjectKey ?? "");
                }
            }

            if (failedKeys.Any())
            {
                var mappedFailedKeys = failedKeys.Select(MapKeyToBlocksLanguageKey).ToList();
                await CreateBulkKeyTimelineEntriesAsync(mappedFailedKeys, LogFromConstants.PublishFailed, command.ProjectKey ?? "");
            }

            return true;
        }

        public List<UilmFile> ProcessUilmFile(GenerateUilmFilesEvent command, List<Language> languages, List<Key> resourceKeys, BlocksLanguageModule application)
        {
            var keyLang = new Language
            {
                LanguageName = "key",
                LanguageCode = "key",
            };
            if (languages.FindIndex(x => x.LanguageName == "key") == -1)
            {
                languages.Add(keyLang);
            }
            List<UilmFile> uilmfiles = new List<UilmFile>();
            foreach (Language language in languages)
            {
                Dictionary<string, object> dictionary = new Dictionary<string, object>();
                if (language.LanguageCode == "key")
                {
                    AssignResourceKeysToDictionaryForKeyMode(resourceKeys, dictionary);
                }
                else
                {
                    AssignResourceKeysToDictionary(resourceKeys, language, dictionary);
                }
                UilmFile uilmFile = new UilmFile()
                {
                    Id = Guid.NewGuid().ToString(),
                    Language = language.LanguageCode,
                    ModuleName = application.ModuleName,
                    Content = JsonConvert.SerializeObject(dictionary)
                };

                uilmfiles.Add(uilmFile);
            }
            return uilmfiles;
        }

        private static void AssignResourceKeysToDictionary(
           List<Key> resourceKeys,
           Language language,
           Dictionary<string, object> dictionary)
        {
            resourceKeys.ForEach((Key reosurceKey) =>
            {
                Resource resource = reosurceKey.Resources.FirstOrDefault(reosurce => reosurce.Culture == language.LanguageCode);

                string resourceValue = resource == null ? "[ KEY MISSING ]" : resource.Value;

                dictionary[reosurceKey.KeyName] = resourceValue;
            });
        }

        private void AssignResourceKeysToDictionaryForKeyMode(
           List<Key> resourceKeys,
           Dictionary<string, object> dictionary)
        {
            resourceKeys.ForEach((Key resourceKey) =>
            {
                AssignToDictionary(dictionary: dictionary, keyPath: resourceKey.KeyName, value: resourceKey.KeyName);
            });
        }

        private void AssignToDictionary(
            Dictionary<string, object> dictionary,
            string keyPath,
            string value)
        {
            try
            {
                string[] keys = keyPath.Split('.');

                Dictionary<string, object> current = dictionary;

                for (int i = 0; i < keys.Length - 1; i++)
                {
                    if (current.ContainsKey(keys[i]))
                    {
                        current = (Dictionary<string, object>)current[keys[i]];
                    }
                    else
                    {
                        Dictionary<string, object> next = new Dictionary<string, object>();
                        current[keys[i]] = next;
                        current = next;
                    }
                }

                current[keys[keys.Length - 1]] = value;
            }
            catch (Exception ex)
            {
                _logger.LogError("Error in AssignToDictionary, keyPath: {KeyPath},  exception: {Ex}", keyPath, JsonConvert.SerializeObject(ex));
            }
        }

        public async Task<bool> SaveUniqeFiles(List<UilmFile> uilmfiles)
        {
            await _keyRepository.DeleteOldUilmFiles(uilmfiles);
            await _keyRepository.SaveNewUilmFiles(uilmfiles);
            return true;
        }

        public async Task<string> GetUilmFile(GetUilmFileRequest request)
        {
            var uilmFile = await _keyRepository.GetUilmFile(request);
            return uilmFile?.Content;
        }
        public async Task<string> GetUilmFile(GetUilmFileRequestForClient request)
        {
            var uilmFile = await _keyRepository.GetUilmFile(request);
            return uilmFile?.Content;
        }

        public async Task SendTranslateAllEvent(TranslateAllRequest request)
        {
            await _messageClient.SendToConsumerAsync(
                new ConsumerMessage<TranslateAllEvent>
                {
                    ConsumerName = Utilities.Constants.TranslateAllKeysQueue,
                    Payload = new TranslateAllEvent
                    {
                        MessageCoRelationId = request.MessageCoRelationId,
                        ProjectKey =BlocksContext.GetContext().TenantId??"",
                        DefaultLanguage = request.DefaultLanguage
                    }
                }
            );
        }

        public async Task SendTranslateBlocksLanguageKeyEvent(TranslateBlocksLanguageKeyRequest request)
        {
            await _messageClient.SendToConsumerAsync(
                new ConsumerMessage<TranslateBlocksLanguageKeyEvent>
                {
                    ConsumerName = Utilities.Constants.TranslateBlocksLanguageKeyQueue,
                    Payload = new TranslateBlocksLanguageKeyEvent
                    {
                        MessageCoRelationId = request.MessageCoRelationId,
                        ProjectKey =BlocksContext.GetContext().TenantId??"",
                        DefaultLanguage = request.DefaultLanguage,
                        KeyId = request.KeyId
                    }
                }
            );
        }

        public async Task SendTranslateBlocksLanguageKeysEvent(TranslateBlocksLanguageKeysRequest request)
        {
            var operationId = Guid.NewGuid().ToString();

            await _messageClient.SendToConsumerAsync(
                new ConsumerMessage<TranslateBlocksLanguageKeysEvent>
                {
                    ConsumerName = Utilities.Constants.TranslateBlocksLanguageKeysQueue,
                    Payload = new TranslateBlocksLanguageKeysEvent
                    {
                        MessageCoRelationId = request.MessageCoRelationId,
                        ProjectKey = BlocksContext.GetContext().TenantId??"",
                        DefaultLanguage = request.DefaultLanguage,
                        KeyIds = request.KeyIds,
                        OperationId = operationId
                    }
                }
            );
        }

        public async Task SendUilmImportEvent(UilmImportRequest request)
        {
            await _messageClient.SendToConsumerAsync(
                new ConsumerMessage<UilmImportEvent>
                {
                    ConsumerName = Utilities.Constants.UilmImportExportQueue,
                    Payload = new UilmImportEvent
                    {
                        FileId = request.FileId,
                        MessageCoRelationId = request.MessageCoRelationId,
                        ProjectKey = BlocksContext.GetContext().TenantId??""
                    }
                }
            );
        }

        public async Task SendUilmExportEvent(UilmExportRequest request)
        {
            var exportFileId = Guid.NewGuid().ToString();

            await _messageClient.SendToConsumerAsync(
                new ConsumerMessage<UilmExportEvent>
                {
                    ConsumerName = Utilities.Constants.UilmImportExportQueue,
                    Payload = new UilmExportEvent
                    {
                        FileId = exportFileId,
                        MessageCoRelationId = request.MessageCoRelationId,
                        ProjectKey = BlocksContext.GetContext().TenantId??"",
                        AppIds = request.AppIds,
                        CallerTenantId = request.CallerTenantId,
                        EndDate = request.EndDate,
                        StartDate = request.StartDate,
                        Languages = request.Languages,
                        OutputType = request.OutputType,
                        ReferenceFileId = request.ReferenceFileId
                    }
                }
            );
        }

        public async Task SendGenerateUilmFilesEvent(GenerateUilmFilesRequest request)
        {
            await _messageClient.SendToConsumerAsync(
                new ConsumerMessage<GenerateUilmFilesEvent>
                {
                    ConsumerName = Utilities.Constants.UilmQueue,
                    Payload = new GenerateUilmFilesEvent
                    {
                        Guid = request.Guid,
                        ProjectKey = BlocksContext.GetContext().TenantId??"",
                        ModuleId = request.ModuleId
                    }
                }
            );
        }

        public async Task<bool> ImportUilmFile(UilmImportEvent request)
        {
            _logger.LogInformation("Importing Uilm file with ID: {FileId}", request.FileId);
            var (fileData, stream) = await GetFileStream(request.FileId, request.ProjectKey);
            if (fileData == null)
            {
                _logger.LogError("Uilm file with ID {FileId} not found", request.FileId);
                return false;
            }
            if (fileData.Name.EndsWith(".xlsx"))
            {
                return await ImportExcelFile(stream, fileData);
            }
            else if (fileData.Name.EndsWith(".json"))
            {
                return await ImportJsonFile(stream, fileData);
            }
            else if (fileData.Name.EndsWith(".csv"))
            {
                return await ImportCsvFile(stream, fileData);
            }
            else if (fileData.Name.EndsWith(".xlf"))
            {
                return await ImportXlfFile(stream, fileData);
            }

            return false;
        }

        private async Task<bool> ImportCsvFile(Stream stream, FileResponse fileData)
        {
            try
            {
                var languageJsonModels = ExtractModelsFromCsv(stream);
                var dbApplications = await GetLanguageApplications(null);
                await ProcessJsonFile(dbApplications, languageJsonModels);

                _logger.LogInformation("ImportCsvFile: Successfully imported FileId:{Id}, FileName: {Name}", fileData.ItemId, fileData.Name);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ImportCsvFile: Failed to import FileId:{Id}, FileName: {Name}", fileData.ItemId, fileData.Name);
                return false;
            }
        }

        private static List<LanguageJsonModel> ExtractModelsFromCsv(Stream stream)
        {
            var memoryStream = stream as MemoryStream;
            var dataStream = new MemoryStream();
            dataStream.Write(memoryStream.ToArray(), 0, (memoryStream.ToArray()).Length);
            dataStream.Seek(0, SeekOrigin.Begin);

            var config = new CsvConfiguration(CultureInfo.InvariantCulture)
            {
                Delimiter = ",",
                HasHeaderRecord = true
            };

            using (var reader = new StreamReader(dataStream))
            {
                using (var csv = new CsvReader(reader, config))
                {
                    csv.Read();
                    csv.ReadHeader();

                    var firstRow = csv.Parser.RawRecord;
                    var fields = firstRow.Split(',');

                    var cultures = new Dictionary<string, string?>();

                    // First, identify all culture columns (non-character length columns)
                    var cultureColumns = new List<string>();
                    for (int i = 4; i < fields.Length; i++) // Start from index 4 (after KeyName)
                    {
                        var fieldName = fields[i].Trim();
                        if (!fieldName.Contains("_CharacterLength"))
                        {
                            cultureColumns.Add(fieldName);
                        }
                    }

                    // Then map each culture to its corresponding character length column
                    foreach (var culture in cultureColumns)
                    {
                        string? characterLengthColumn = null;
                        var expectedCharLengthColumn = $"{culture}_CharacterLength";

                        // Look for the character length column
                        for (int i = 4; i < fields.Length; i++)
                        {
                            if (fields[i].Trim().Equals(expectedCharLengthColumn, StringComparison.OrdinalIgnoreCase))
                            {
                                characterLengthColumn = expectedCharLengthColumn;
                                break;
                            }
                        }

                        cultures.Add(culture, characterLengthColumn);
                    }

                    var languageJsonModels = new List<LanguageJsonModel>();

                    while (csv.Read())
                    {
                        // Helper method to safely get optional fields
                        bool TryGetField<T>(string fieldName, out T value)
                        {
                            try
                            {
                                if (csv.TryGetField<T>(fieldName, out value))
                                {
                                    return true;
                                }
                            }
                            catch
                            {
                                // Field doesn't exist or conversion failed
                            }
                            value = default(T);
                            return false;
                        }

                        var languageJsonModel = new LanguageJsonModel
                        {
                            _id = csv.GetField<string>("ItemId"),
                            Module = csv.GetField<string>("Module"),
                            KeyName = csv.GetField<string>("KeyName"),
                            // Resources will be populated from individual culture columns below
                            ModuleId = csv.GetField<string>("ModuleId"),
                            IsPartiallyTranslated = TryGetField<bool>("IsPartiallyTranslated", out bool isPartiallyTranslated) ? isPartiallyTranslated : false,
                        };

                        var resources = new List<Resource>();

                        foreach (var culture in cultures)
                        {
                            var resource = new Resource();
                            resource.Culture = culture.Key;
                            resource.Value = csv.GetField<string>(culture.Key);
                            resource.CharacterLength = string.IsNullOrEmpty(culture.Value) ? 0 : csv.GetField<int>(culture.Value);

                            resources.Add(resource);
                        }

                        languageJsonModel.Resources = resources.ToArray();

                        languageJsonModels.Add(languageJsonModel);
                    }

                    return languageJsonModels;
                }
            }
        }

        private async Task<bool> ImportJsonFile(Stream stream, FileResponse fileData)
        {
            try
            {
                var languageJsonModels = ExtractModelsFromJson(stream);
                var dbApplications = await GetLanguageApplications(null);
                await ProcessJsonFile(dbApplications, languageJsonModels);

                _logger.LogInformation("ImportJsonFile: Successfully imported FileId:{Id}, FileName: {Name}", fileData.ItemId, fileData.Name);

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ImportJsonFile: Failed to import FileId:{Id}, FileName: {Name}", fileData.ItemId, fileData.Name);
                return false;
            }
        }

        private async Task ProcessJsonFile(List<BlocksLanguageModule> dbApplications, List<LanguageJsonModel> languageJsonModels)
        {
            var uilmApplicationsToBeInserted = new List<BlocksLanguageModule>();
            var uilmApplicationsToBeUpdated = new List<BlocksLanguageModule>();

            var resourceKeysWithoutId = new List<BlocksLanguageKey>();
            var uilmResourceKeys = new List<BlocksLanguageKey>();
            var oldUilmResourceKeys = new List<BlocksLanguageKey>();

            foreach (var languageJsonModel in languageJsonModels)
            {
                var id = languageJsonModel._id;
                var appId = languageJsonModel.ModuleId;
                var isPartiallyTranslated = languageJsonModel.IsPartiallyTranslated;
                var moduleName = languageJsonModel?.Module;
                var keyName = languageJsonModel.KeyName;

                appId = HandleUilmApplication(dbApplications, uilmApplicationsToBeInserted, uilmApplicationsToBeUpdated, appId,
                    isPartiallyTranslated, moduleName);

                var olduilmResourceKey = await GetUilmResourceKey(appId, keyName);

                // Merge resources: combine existing resources with new ones from import
                var mergedResources = MergeResources(olduilmResourceKey?.Resources, languageJsonModel.Resources);

                BlocksLanguageKey uilmResourceKey = new()
                {
                    KeyName = keyName,
                    Resources = mergedResources,
                    ItemId = id,
                    ModuleId = appId,
                    IsPartiallyTranslated = isPartiallyTranslated,
                    CreateDate = olduilmResourceKey?.CreateDate ?? DateTime.UtcNow,
                    LastUpdateDate = DateTime.UtcNow,
                    Value = string.Empty, // Value field is not exported, set to empty
                    Routes = languageJsonModel.Routes ?? olduilmResourceKey?.Routes
                };

                if (olduilmResourceKey == null)
                {
                    // Key doesn't exist - always generate a new ItemId to avoid conflicts with non-GUID ItemIds from import
                    uilmResourceKey.ItemId = Guid.NewGuid().ToString();
                    resourceKeysWithoutId.Add(uilmResourceKey);
                }
                else
                {
                    // Key exists - use the existing ItemId for update to ensure we update the correct record
                    uilmResourceKey.ItemId = olduilmResourceKey.ItemId;
                    oldUilmResourceKeys.Add(olduilmResourceKey);
                    uilmResourceKeys.Add(uilmResourceKey);
                }
            }

            await SaveUilmResourceKey(uilmResourceKeys, resourceKeysWithoutId, oldUilmResourceKeys);

            var validUilmApplicationsToBeInserted = uilmApplicationsToBeInserted.Where(x => x != null && x.ModuleName != null).DistinctBy(x => x.ModuleName).ToList();
            var validUilmApplicationsToBeUpdated = uilmApplicationsToBeUpdated.Where(x => x != null && x.ModuleName != null).DistinctBy(x => x.ModuleName).ToList();
            await SaveUilmApplication(validUilmApplicationsToBeInserted, validUilmApplicationsToBeUpdated);
        }

        private async Task<List<BlocksLanguageModule>> GetLanguageApplications(List<string> appIds = null)
        {
            List<BlocksLanguageModule> applications = null;

            if (appIds != null && appIds.Count > 0)
            {
                applications = await _keyRepository.GetUilmApplications<BlocksLanguageModule>(x => appIds.Contains(x.ItemId));
            }
            else
            {
                applications = await _keyRepository.GetUilmApplications<BlocksLanguageModule>(x => true);
            }

            return applications;
        }

        private static List<LanguageJsonModel> ExtractModelsFromJson(Stream stream)
        {
            List<LanguageJsonModel> languageJsonModels;
            var memoryStream = stream as MemoryStream;
            var dataStream = new MemoryStream();
            dataStream.Write(memoryStream.ToArray(), 0, (memoryStream.ToArray()).Length);
            dataStream.Seek(0, SeekOrigin.Begin);

            using (var file = new StreamReader(dataStream))
            {
                using (var reader = new JsonTextReader(file))
                {
                    var serializer = new JsonSerializer();
                    languageJsonModels = serializer.Deserialize<List<LanguageJsonModel>>(reader);
                }
            }

            return languageJsonModels;
        }

        private async Task<(FileResponse, Stream)> GetFileStream(string fileId, string projectKey)
        {

            var fileData = await _storageDriverService.GetUrlForDownloadFileAsync(new GetFileRequest
            {
                FileId = fileId,
                ProjectKey = projectKey
            });
            if (fileData is null)
            {
                _logger.LogError("ImportUilmFile: File data is null with the file Id: {Id}", fileId);
                return (null, null);
            }

            var stream = await GetFileStream(fileData);
            if (stream is null)
            {
                _logger.LogError("ImportUilmFile: File stream is null with the file Id: {Id}", fileId);
                return (null, null);
            }

            _logger.LogInformation("ImportUilmFile: Fetched FileContent for FileId={FileId} FileName={FileDataName}.", fileId, fileData.Name);

            return (fileData, stream);
        }

        private static async Task<Stream> GetFileStream(FileResponse fileData)
        {

            using var httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.Add("X-Blocks-Key", BlocksContext.GetContext()?.TenantId);

            var fileUrl = fileData.Url;
            var response = await httpClient.GetAsync(fileUrl);

            if (!response.IsSuccessStatusCode)
            {
                return Stream.Null;
            }

            var memoryStream = new MemoryStream();

            await response.Content.CopyToAsync(memoryStream);

            return memoryStream;
        }

        private async Task<bool> ImportExcelFile(Stream stream, FileResponse fileData)
        {
            try
            {
                using XLWorkbook workbook = new XLWorkbook(stream);
                IXLWorksheet worksheet = workbook.Worksheets.First();
                worksheet.Columns().Unhide();

                // header value, column letter
                Dictionary<string, string> columns = new Dictionary<string, string>();
                Dictionary<string, string> languages = new Dictionary<string, string>();

                List<string> systemColumns = new List<string>() { "ItemId", "ModuleId", "Module", "KeyName" };
                List<BlocksLanguageKey> blocksLanguageKeys = new List<BlocksLanguageKey>();

                foreach (IXLColumn col in worksheet.Columns())
                {
                    string columnLetter = col.ColumnLetter();
                    string header = worksheet.Cell(1, columnLetter).Value.ToString();
                    if (!string.IsNullOrEmpty(header) && !columns.ContainsKey(header))
                    {
                        columns.Add(header.Trim(), columnLetter);
                    }

                    if (!string.IsNullOrEmpty(header) && !systemColumns.Contains(header) && !languages.ContainsKey(header))
                    {
                        languages.Add(header.Trim(), columnLetter);
                    }
                }

                if (columns.Count == 0)
                {
                    _logger.LogError("ImportExcelFile: No column found in the excel FileId: {Id}, FileName: {Name}", fileData.ItemId, fileData.Name);
                    return false;
                }

                _logger.LogInformation("ImportExcelFile: Detected {ColumnsCount} columns={Columns} in FileName={FileDataName}", columns.Count, string.Join(", ", columns.Select(x => x.Key).ToList()), fileData.Name);
                _logger.LogInformation("ImportExcelFile: Detected {LanguagesCount} cultures={Cultures} in FileName={FileDataName}", languages.Count, string.Join(", ", languages.Select(x => x.Key).ToList()), fileData.Name);

                // Validate required columns exist
                var requiredColumns = new[] { "ItemId", "ModuleId", "Module", "KeyName" };
                var missingColumns = requiredColumns.Where(col => !columns.ContainsKey(col)).ToList();
                if (missingColumns.Any())
                {
                    _logger.LogError("ImportExcelFile: Missing required columns {MissingColumns} in FileId: {Id}, FileName: {Name}", string.Join(", ", missingColumns), fileData.ItemId, fileData.Name);
                    return false;
                }

                await ProcessExcelCells(worksheet, columns, languages, blocksLanguageKeys);

                _logger.LogInformation("ImportExcelFile: Successfully imported FileId:{Id}, FileName: {Name}", fileData.ItemId, fileData.Name);

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ImportExcelFile: Failed to import FileId:{Id}, FileName: {Name}", fileData.ItemId, fileData.Name);
                return false;
            }
        }

        private async Task<bool> ImportXlfFile(Stream stream, FileResponse fileData)
        {
            try
            {
                // Validate filename pattern - only accept messages.xlf (base) or messages.{lang}.xlf (language files)
                if (!IsValidXlfFileName(fileData.Name, out var extractedLanguageCode, out var isBaseFile))
                {
                    _logger.LogWarning("ImportXlfFile: Ignoring file {FileName} - filename does not match expected pattern (messages.xlf or messages.{{lang}}.xlf)", fileData.Name);
                    return false;
                }

                // Get all languages from the database for mapping
                var dbLanguages = await _languageManagementService.GetLanguagesAsync();

                // Map the extracted language code to the full database language code
                string? mappedLanguageCode = null;
                if (!isBaseFile && !string.IsNullOrEmpty(extractedLanguageCode))
                {
                    mappedLanguageCode = MapToDbLanguageCode(extractedLanguageCode, dbLanguages);
                    if (mappedLanguageCode == null)
                    {
                        _logger.LogWarning("ImportXlfFile: No matching language found in database for language code '{LanguageCode}' from file {FileName}. Ignoring file.",
                            extractedLanguageCode, fileData.Name);
                        return false;
                    }
                    else
                    {
                        _logger.LogInformation("ImportXlfFile: Mapped language code '{OriginalCode}' to '{MappedCode}'",
                            extractedLanguageCode, mappedLanguageCode);
                    }
                }

                _logger.LogInformation("ImportXlfFile: Processing file {FileName}, IsBaseFile: {IsBaseFile}, TargetLanguage: {TargetLanguage}",
                    fileData.Name, isBaseFile, mappedLanguageCode ?? "N/A");

                var languageJsonModels = ExtractModelsFromXlf(stream, mappedLanguageCode, isBaseFile, dbLanguages);
                var dbApplications = await GetLanguageApplications(null);
                await ProcessXlfFile(dbApplications, languageJsonModels);

                _logger.LogInformation("ImportXlfFile: Successfully imported FileId:{Id}, FileName: {Name}", fileData.ItemId, fileData.Name);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ImportXlfFile: Failed to import FileId:{Id}, FileName: {Name}", fileData.ItemId, fileData.Name);
                return false;
            }
        }

        /// <summary>
        /// Maps a language code extracted from filename to the full language code in the database.
        /// Supports matching by:
        /// - Exact match (e.g., "de-DE" matches "de-DE")
        /// - Prefix match (e.g., "de" matches "de-DE")
        /// - Case-insensitive matching
        /// </summary>
        /// <param name="fileLanguageCode">Language code extracted from filename (e.g., "de", "en", "de-DE")</param>
        /// <param name="dbLanguages">List of languages from database</param>
        /// <returns>The matched database language code, or null if no match found</returns>
        private static string? MapToDbLanguageCode(string? fileLanguageCode, List<Language>? dbLanguages)
        {
            if (string.IsNullOrEmpty(fileLanguageCode) || dbLanguages == null || !dbLanguages.Any())
                return null;

            // First, try exact match (case-insensitive)
            var exactMatch = dbLanguages.FirstOrDefault(l =>
                string.Equals(l.LanguageCode, fileLanguageCode, StringComparison.OrdinalIgnoreCase));
            if (exactMatch != null)
                return exactMatch.LanguageCode;

            // Second, try prefix match (e.g., "de" matches "de-DE")
            var prefixMatch = dbLanguages.FirstOrDefault(l =>
                l.LanguageCode != null &&
                l.LanguageCode.StartsWith(fileLanguageCode + "-", StringComparison.OrdinalIgnoreCase));
            if (prefixMatch != null)
                return prefixMatch.LanguageCode;

            return null;
        }

        /// <summary>
        /// Validates if the XLF filename matches the expected pattern.
        /// Base file must be exactly "messages.xlf"
        /// Language files must be exactly "messages.{languageCode}.xlf" (e.g., messages.de.xlf, messages.en.xlf)
        /// </summary>
        /// <param name="fileName">The filename to validate</param>
        /// <param name="languageCode">Output: the extracted language code (null for base file)</param>
        /// <param name="isBaseFile">Output: true if this is the base file (messages.xlf)</param>
        /// <returns>True if the filename matches the expected pattern, false otherwise</returns>
        private static bool IsValidXlfFileName(string fileName, out string? languageCode, out bool isBaseFile)
        {
            languageCode = null;
            isBaseFile = false;

            if (string.IsNullOrEmpty(fileName))
                return false;

            // Check for exact base file name: messages.xlf
            if (fileName.Equals("messages.xlf", StringComparison.OrdinalIgnoreCase))
            {
                isBaseFile = true;
                return true;
            }

            // Check for language file pattern: messages.{lang}.xlf
            if (!fileName.StartsWith("messages.", StringComparison.OrdinalIgnoreCase) ||
                !fileName.EndsWith(".xlf", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            // Extract language code from messages.{lang}.xlf
            var nameWithoutExtension = fileName[..^4]; // Remove .xlf
            var parts = nameWithoutExtension.Split('.');

            // Should be exactly ["messages", "lang"] - no additional parts
            if (parts.Length != 2)
                return false;

            var potentialLanguage = parts[1];

            // Language codes are typically 2-5 characters (e.g., "en", "de", "fr", "en-US", "zh-CN")
            // They should contain only letters and possibly a hyphen
            if (potentialLanguage.Length >= 2 && potentialLanguage.Length <= 10 &&
                potentialLanguage.All(c => char.IsLetter(c) || c == '-'))
            {
                languageCode = potentialLanguage;
                return true;
            }

            return false;
        }

        /// <summary>
        /// Extracts language models from XLF file.
        /// </summary>
        /// <param name="stream">The XLF file stream</param>
        /// <param name="targetLanguageFromFileName">The target language extracted from filename and mapped to DB (null for base files)</param>
        /// <param name="isBaseFile">Whether this is a base file (keys only, no translations)</param>
        /// <param name="dbLanguages">List of languages from database for mapping source language</param>
        /// <returns>List of language models extracted from the file</returns>
        private static List<LanguageJsonModel> ExtractModelsFromXlf(Stream stream, string? targetLanguageFromFileName = null, bool isBaseFile = false, List<Language>? dbLanguages = null)
        {
            var memoryStream = stream as MemoryStream;
            var dataStream = new MemoryStream();
            dataStream.Write(memoryStream.ToArray(), 0, memoryStream.ToArray().Length);
            dataStream.Seek(0, SeekOrigin.Begin);

            XNamespace ns = "urn:oasis:names:tc:xliff:document:1.2";
            var document = XDocument.Load(dataStream);

            var languageJsonModels = new Dictionary<string, LanguageJsonModel>();

            // Parse all <file> elements
            var fileElements = document.Root?.Elements(ns + "file");
            if (fileElements == null)
            {
                return new List<LanguageJsonModel>();
            }

            foreach (var fileElement in fileElements)
            {
                // Use target language from filename if provided (already mapped), otherwise fall back to XML attribute and map it
                var targetLanguage = targetLanguageFromFileName ??
                    MapToDbLanguageCode(fileElement.Attribute("target-language")?.Value, dbLanguages) ??
                    fileElement.Attribute("target-language")?.Value;
                var moduleName = fileElement.Attribute("original")?.Value;

                var body = fileElement.Element(ns + "body");
                if (body == null) continue;

                // Parse all <trans-unit> elements
                var transUnits = body.Elements(ns + "trans-unit");
                foreach (var transUnit in transUnits)
                {
                    var transUnitId = transUnit.Attribute("id")?.Value;
                    // Trim whitespace from keyName to prevent duplicate entries due to leading/trailing spaces
                    var keyName = transUnit.Element(ns + "source")?.Value?.Trim();
                    if (string.IsNullOrEmpty(keyName)) continue;

                    // Extract ItemId from trans-unit id (format: ItemId_Culture)

                    var targetElement = transUnit.Element(ns + "target");
                    var noteElements = transUnit.Elements(ns + "note");

                    var targetValue = targetElement?.Value;
                    var targetState = targetElement?.Attribute("state")?.Value;

                    // Extract metadata from notes
                    var routes = new List<string>();
                    int characterLength = 0;

                    foreach (var note in noteElements)
                    {
                        var noteValue = note.Value;
                        if (noteValue.StartsWith("Module:"))
                        {
                            // Module name is already in fileElement.Attribute("original")
                        }
                        else if (noteValue.StartsWith("Routes:"))
                        {
                            var routesStr = noteValue.Replace("Routes:", "").Trim();
                            routes = routesStr.Split(',').Select(r => r.Trim()).ToList();
                        }
                        else if (noteValue.StartsWith("CharacterLength:"))
                        {
                            var charLengthStr = noteValue.Replace("CharacterLength:", "").Trim();
                            int.TryParse(charLengthStr, out characterLength);
                        }
                    }

                    // Create or update LanguageJsonModel
                    if (!languageJsonModels.ContainsKey(keyName))
                    {
                        languageJsonModels[keyName] = new LanguageJsonModel
                        {
                            _id = transUnitId,
                            Module = moduleName,
                            KeyName = keyName,
                            Resources = new List<Resource>().ToArray(),
                            Routes = routes,
                            IsPartiallyTranslated = targetState == "needs-translation"
                        };
                    }

                    var model = languageJsonModels[keyName];

                    // Add or update resources
                    var resourceList = model.Resources?.ToList() ?? new List<Resource>();

                    // For base files, only import the key without any translations
                    // Do not add any language resources - existing translations should be preserved
                    if (isBaseFile)
                    {
                        // Base file: just import the key, no resources added
                        // The key will be created/updated but existing translations are preserved via MergeResources
                    }
                    else
                    {
                        // Non-base file: import translations for the target language only
                        // Do NOT add source language resource - only import the target language from the file
                        if (!string.IsNullOrEmpty(targetLanguage))
                        {
                            var targetResource = resourceList.FirstOrDefault(r => r.Culture == targetLanguage);
                            if (targetResource == null)
                            {
                                resourceList.Add(new Resource
                                {
                                    Culture = targetLanguage,
                                    Value = targetValue ?? string.Empty,
                                    CharacterLength = characterLength
                                });
                            }
                            else
                            {
                                // Update existing target resource
                                targetResource.Value = targetValue ?? string.Empty;
                                targetResource.CharacterLength = characterLength;
                            }
                        }
                    }

                    model.Resources = resourceList.ToArray();
                }
            }

            return languageJsonModels.Values.ToList();
        }

        /// <summary>
        /// Processes XLF file data using atomic upsert operations for concurrent import safety.
        /// This is a separate function from ProcessJsonFile to handle XLF-specific requirements.
        /// </summary>
        private async Task ProcessXlfFile(List<BlocksLanguageModule> dbApplications, List<LanguageJsonModel> languageJsonModels)
        {
            var uilmApplicationsToBeInserted = new List<BlocksLanguageModule>();
            var uilmApplicationsToBeUpdated = new List<BlocksLanguageModule>();

            // Collect all keys to be upserted - we don't need to separate insert/update anymore
            // The upsert operation handles both cases atomically with resource merging
            var allResourceKeys = new List<BlocksLanguageKey>();
            var resourceKeysWithoutId = new List<BlocksLanguageKey>();
            var uilmResourceKeys = new List<BlocksLanguageKey>();
            var oldUilmResourceKeys = new List<BlocksLanguageKey>();

            // Batch fetch existing keys to reduce DB round trips
            var keyIdentifiers = languageJsonModels
                .Select(m => new { ModuleId = m.ModuleId, KeyName = m.KeyName })
                .Distinct()
                .ToList();

            // Get all existing keys in one query for timeline tracking
            var existingKeysDict = new Dictionary<string, BlocksLanguageKey>();
            if (keyIdentifiers.Any())
            {
                var moduleIds = keyIdentifiers.Select(k => k.ModuleId).Distinct().ToList();
                var existingKeys = await _keyRepository.GetUilmResourceKeys(
                    x => moduleIds.Contains(x.ModuleId),
                    _blocksBaseCommand?.ClientTenantId);

                foreach (var key in existingKeys)
                {
                    var lookupKey = $"{key.ModuleId}|{key.KeyName}";
                    existingKeysDict.TryAdd(lookupKey, key);
                }
            }

            foreach (var languageJsonModel in languageJsonModels)
            {
                var id = languageJsonModel._id;
                var appId = languageJsonModel.ModuleId;
                var isPartiallyTranslated = languageJsonModel.IsPartiallyTranslated;
                var moduleName = languageJsonModel?.Module;
                var keyName = languageJsonModel.KeyName;

                appId = HandleUilmApplication(dbApplications, uilmApplicationsToBeInserted, uilmApplicationsToBeUpdated, appId, isPartiallyTranslated,
                    moduleName);

                // Look up existing key from pre-fetched dictionary
                var lookupKey = $"{appId}|{keyName}";
                existingKeysDict.TryGetValue(lookupKey, out var olduilmResourceKey);

                // Build the resource key - resources will be merged atomically by the upsert
                // We pass the new resources only; the DB-level merge handles combining with existing
                BlocksLanguageKey uilmResourceKey = new()
                {
                    KeyName = keyName,
                    Resources = languageJsonModel.Resources, // Don't merge here - let upsert handle it atomically
                    ItemId = olduilmResourceKey?.ItemId ?? id ?? Guid.NewGuid().ToString(),
                    ModuleId = appId,
                    IsPartiallyTranslated = isPartiallyTranslated,
                    CreateDate = olduilmResourceKey?.CreateDate ?? DateTime.UtcNow,
                    LastUpdateDate = DateTime.UtcNow,
                    Value = string.Empty,
                    Routes = languageJsonModel.Routes ?? olduilmResourceKey?.Routes,
                    TenantId = _tenantId
                };

                allResourceKeys.Add(uilmResourceKey);

                // Track for timeline - separate into existing vs new for proper logging
                if (olduilmResourceKey == null)
                {
                    resourceKeysWithoutId.Add(uilmResourceKey);
                }
                else
                {
                    oldUilmResourceKeys.Add(olduilmResourceKey);
                    uilmResourceKeys.Add(uilmResourceKey);
                }
            }

            await SaveXlfResourceKeys(uilmResourceKeys, resourceKeysWithoutId, oldUilmResourceKeys);

            var validUilmApplicationsToBeInserted = uilmApplicationsToBeInserted.Where(x => x != null && x.ModuleName != null).DistinctBy(x => x.ModuleName).ToList();
            var validUilmApplicationsToBeUpdated = uilmApplicationsToBeUpdated.Where(x => x != null && x.ModuleName != null).DistinctBy(x => x.ModuleName).ToList();
            await SaveUilmApplication(validUilmApplicationsToBeInserted, validUilmApplicationsToBeUpdated);
        }

        /// <summary>
        /// Saves XLF resource keys using atomic upsert operations for concurrent import safety.
        /// This is a separate function from SaveUilmResourceKey to handle XLF-specific requirements.
        /// </summary>
        private async Task SaveXlfResourceKeys(List<BlocksLanguageKey> uilmResourceKeys, List<BlocksLanguageKey> resourceKeysWithoutId, List<BlocksLanguageKey> oldUilmResourceKeys = null)
        {
            var importOperationId = Guid.NewGuid().ToString();

            // Combine all keys and use upsert with merge to handle concurrent imports safely
            var allKeys = new List<BlocksLanguageKey>();
            allKeys.AddRange(uilmResourceKeys);
            allKeys.AddRange(resourceKeysWithoutId);

            if (allKeys.Any())
            {
                // Use upsert with resource merging - this is atomic and handles concurrent imports
                var (upsertedCount, modifiedCount) = await _keyRepository.UpsertResourceKeysWithMergeAsync(allKeys, _blocksBaseCommand?.ClientTenantId);

                // Create timeline entries for all keys
                foreach (var resourceKey in uilmResourceKeys)
                {
                    try
                    {
                        await CreateKeyTimelineEntryAsync(oldUilmResourceKeys?.FirstOrDefault(x => x.ItemId == resourceKey.ItemId), resourceKey, LogFromConstants.UilmImportUpdate, importOperationId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError("Failed to create timeline entry for updated Key {KeyId} during XLF import: {Error}", resourceKey.ItemId, ex.Message);
                    }
                }

                foreach (var resourceKey in resourceKeysWithoutId)
                {
                    try
                    {
                        await CreateKeyTimelineEntryAsync(null, resourceKey, LogFromConstants.UilmImportInsert, importOperationId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError("Failed to create timeline entry for new Key {KeyId} during XLF import: {Error}", resourceKey.ItemId, ex.Message);
                    }
                }

                _logger.LogInformation("SaveXlfResourceKeys: Upserted {UpsertedCount} keys, Modified {ModifiedCount} keys", upsertedCount, modifiedCount);
            }
        }

        private async Task ProcessExcelCells(IXLWorksheet worksheet, Dictionary<string, string> columns, Dictionary<string, string> languages,
            List<BlocksLanguageKey> uilmResourceKeys)
        {
            List<BlocksLanguageKey> oldUilmResourceKeys = new List<BlocksLanguageKey>();
            List<BlocksLanguageModule> dbApplications = await _moduleManagementService.GetModulesAsync();

            var uilmApplicationsToBeInserted = new List<BlocksLanguageModule>();
            var uilmApplicationsToBeUpdated = new List<BlocksLanguageModule>();

            var resourceKeysWithoutId = new List<BlocksLanguageKey>();
            var cultures = languages.Where(x => !x.Key.Contains("_CharacterLength")).ToDictionary(x => x.Key, y => y.Value);
            var excelRows = worksheet.RowsUsed().Count();

            _logger.LogInformation("ImportExcelFile: {Excelrows} UilmResourceKeys Found!", excelRows - 1);

            for (int i = 2; i <= excelRows; i++)
            {
                string id = worksheet.Cell(i, columns["ItemId"]).Value.ToString();
                string moduleId = worksheet.Cell(i, columns["ModuleId"]).Value.ToString();
                string moduleName = worksheet.Cell(i, columns["Module"]).Value.ToString();
                string keyName = worksheet.Cell(i, columns["KeyName"]).Value.ToString();
                // Note: Resources column is not required as resources are populated from language columns
                moduleId = HandleUilmApplication(dbApplications, uilmApplicationsToBeInserted, uilmApplicationsToBeUpdated, moduleId, false, moduleName);

                BlocksLanguageKey uilmResourceKey = new()
                {
                    KeyName = keyName,
                    ItemId = id,
                    ModuleId = moduleId,
                    LastUpdateDate = DateTime.UtcNow,
                    CreateDate = DateTime.UtcNow
                };

                uilmResourceKey.Resources = new Resource[cultures.Count];

                int j = 0;
                foreach (KeyValuePair<string, string> lang in cultures)
                {
                    string resourceValue = worksheet.Cell(i, lang.Value).Value.ToString();
                    int characterLength = 0;
                    
                    uilmResourceKey.Resources[j++] = (new Resource() { Culture = lang.Key, Value = resourceValue, CharacterLength = characterLength });
                }

                var olduilmResourceKey = await GetUilmResourceKey(uilmResourceKey.ModuleId, uilmResourceKey.KeyName);

                if (olduilmResourceKey == null)
                {
                    // Key doesn't exist - always generate a new ItemId to avoid conflicts with non-GUID ItemIds from import
                    uilmResourceKey.ItemId = Guid.NewGuid().ToString();
                    resourceKeysWithoutId.Add(uilmResourceKey);
                }
                else
                {
                    // Key exists - use the existing ItemId for update to ensure we update the correct record
                    uilmResourceKey.ItemId = olduilmResourceKey.ItemId;
                    oldUilmResourceKeys.Add(olduilmResourceKey);
                    uilmResourceKeys.Add(uilmResourceKey);
                }
            }

            await SaveUilmResourceKey(uilmResourceKeys, resourceKeysWithoutId, oldUilmResourceKeys);
            await SaveUilmApplication(uilmApplicationsToBeInserted.DistinctBy(x => x.ModuleName).ToList(), uilmApplicationsToBeUpdated.DistinctBy(x => x.ModuleName).ToList());
        }

        private string HandleUilmApplication(List<BlocksLanguageModule> dbApplications, List<BlocksLanguageModule> uilmApplicationsToBeInserted,
            List<BlocksLanguageModule> uilmApplicationsToBeUpdated, string appId, bool isPartiallyTranslated, string moduleName)
        {
            if (string.IsNullOrWhiteSpace(appId))
            {
                appId = HandleApplicationWithoutAppId(dbApplications, uilmApplicationsToBeInserted, uilmApplicationsToBeUpdated, moduleName);
            }
            else
            {
                HandleApplicationWithAppId(dbApplications, uilmApplicationsToBeInserted, uilmApplicationsToBeUpdated, appId, moduleName);
            }

            return appId;
        }

        private string HandleApplicationWithoutAppId(List<BlocksLanguageModule> dbApplications, List<BlocksLanguageModule> uilmApplicationsToBeInserted,
            List<BlocksLanguageModule> uilmApplicationsToBeUpdated, string moduleName)
        {
            string appId;
            var application = dbApplications?.FirstOrDefault(x => x.ModuleName == moduleName);
            if (application != null)
            {
                appId = application.ItemId;
                application.ModuleName = moduleName;

                var alreadyAddedToUpdateList = uilmApplicationsToBeUpdated.FirstOrDefault(x => x.ModuleName == moduleName);
                if (alreadyAddedToUpdateList is null)
                {
                    uilmApplicationsToBeUpdated.Add(application);
                }
            }
            else
            {
                var alreadyInsertedToApp = uilmApplicationsToBeInserted.FirstOrDefault(x => x.ModuleName == moduleName);
                if (alreadyInsertedToApp is null)
                {
                    var app = new BlocksLanguageModule()
                    {
                        ItemId = Guid.NewGuid().ToString(),
                        ModuleName = moduleName,
                    };

                    uilmApplicationsToBeInserted.Add(app);
                    appId = app.ItemId;
                }
                else
                {
                    appId = alreadyInsertedToApp.ItemId;
                }
            }

            return appId;
        }

        private void HandleApplicationWithAppId(List<BlocksLanguageModule> dbApplications, List<BlocksLanguageModule> uilmApplicationsToBeInserted, List<BlocksLanguageModule> uilmApplicationsToBeUpdated,
            string appId, string moduleName)
        {
            var application = dbApplications?.FirstOrDefault(x => x.ItemId == appId);
            if (application != null)
            {
                application.ModuleName = moduleName;

                var alreadyAddedToUpdateList = uilmApplicationsToBeUpdated.FirstOrDefault(x => x.ItemId == appId);
                if (alreadyAddedToUpdateList is null)
                {
                    uilmApplicationsToBeUpdated.Add(application);
                }
            }
            else
            {
                var alreadyAddedToInsertList = uilmApplicationsToBeInserted.FirstOrDefault(x => x.ItemId == appId);
                if (alreadyAddedToInsertList is null)
                {
                    BlocksLanguageModule uilmApplication = new()
                    {
                        ItemId = appId,
                        ModuleName = moduleName,
                    };

                    uilmApplicationsToBeInserted.Add(uilmApplication);

                }
            }
        }

        /// <summary>
        /// Merges resources from import with existing resources.
        /// New resources override existing ones for the same culture.
        /// Existing resources for cultures not in the import are preserved.
        /// </summary>
        /// <param name="existingResources">Resources from the existing key in database</param>
        /// <param name="newResources">Resources from the import file</param>
        /// <returns>Merged array of resources</returns>
        private static Resource[] MergeResources(Resource[]? existingResources, Resource[]? newResources)
        {
            if (existingResources == null || existingResources.Length == 0)
            {
                return newResources ?? Array.Empty<Resource>();
            }

            if (newResources == null || newResources.Length == 0)
            {
                return existingResources;
            }

            // Start with existing resources as a dictionary for easy lookup
            var mergedDict = existingResources.ToDictionary(r => r.Culture, r => r);

            // Add or update with new resources
            foreach (var newResource in newResources)
            {
                if (string.IsNullOrEmpty(newResource.Culture))
                    continue;

                // Only update if the new resource has a value (don't overwrite with empty values)
                if (!string.IsNullOrEmpty(newResource.Value))
                {
                    mergedDict[newResource.Culture] = newResource;
                }
                else if (!mergedDict.ContainsKey(newResource.Culture))
                {
                    // Add new culture even if empty (for tracking purposes)
                    mergedDict[newResource.Culture] = newResource;
                }
            }

            return mergedDict.Values.ToArray();
        }

        private async Task<BlocksLanguageKey> GetUilmResourceKey(string appId, string keyName)
        {
            if (string.IsNullOrWhiteSpace(appId) || string.IsNullOrWhiteSpace(keyName)) return null;

            return await _keyRepository.GetUilmResourceKey(x => x.ModuleId == appId && x.KeyName == keyName, _blocksBaseCommand?.ClientTenantId);
        }

        private async Task SaveUilmResourceKey(List<BlocksLanguageKey> uilmResourceKeys, List<BlocksLanguageKey> resourceKeysWithoutId, List<BlocksLanguageKey> oldUilmResourceKeys = null)
        {
            var importOperationId = Guid.NewGuid().ToString();

            if (uilmResourceKeys.Any())
            {
                long? updateCount = 0;

                updateCount = await _keyRepository.UpdateUilmResourceKeysForChangeAll(uilmResourceKeys);

                // Create timeline entries for updated keys
                foreach (var resourceKey in uilmResourceKeys)
                {
                    try
                    {
                        await CreateKeyTimelineEntryAsync(oldUilmResourceKeys.FirstOrDefault(x => x.ItemId == resourceKey.ItemId), resourceKey, LogFromConstants.UilmImportUpdate, importOperationId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError("Failed to create timeline entry for updated Key {KeyId} during UilmImport: {Error}", resourceKey.ItemId, ex.Message);
                    }
                }

                _logger.LogInformation("SaveUilmResourceKey: Updated UilmResourceKeys:{Count}", updateCount);
            }
            if (resourceKeysWithoutId.Any())
            {
                await _keyRepository.InsertUilmResourceKeys(resourceKeysWithoutId, _blocksBaseCommand?.ClientTenantId);

                // Create timeline entries for inserted keys
                foreach (var resourceKey in resourceKeysWithoutId)
                {
                    try
                    {
                        await CreateKeyTimelineEntryAsync(null, resourceKey, LogFromConstants.UilmImportInsert, importOperationId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError("Failed to create timeline entry for new Key {KeyId} during UilmImport: {Error}", resourceKey.ItemId, ex.Message);
                    }
                }

                _logger.LogInformation("SaveUilmResourceKey: Inserted UilmResourceKeys:{Count}", resourceKeysWithoutId.Count);
            }
        }

        private BlocksLanguageKey GetBlocksLanguageKey(BlocksLanguageKey key)
        {
            return new BlocksLanguageKey
            {
                ModuleId = key.ModuleId,
                KeyName = key.KeyName,
                Resources = key.Resources,
                ItemId = key.ItemId,
                CreateDate = key.CreateDate,
                LastUpdateDate = key.LastUpdateDate,
            };
        }

        private async Task SaveUilmApplication(List<BlocksLanguageModule> uilmApplicationsToBeInserted,
            List<BlocksLanguageModule> uilmApplicationsToBeUpdated)
        {
            if (uilmApplicationsToBeUpdated.Any())
            {
                await _keyRepository.UpdateBulkUilmApplications(uilmApplicationsToBeUpdated, _blocksBaseCommand?.OrganizationId, _blocksBaseCommand?.IsExternal ?? false, _blocksBaseCommand?.ClientTenantId);
                await AddNumberOfKeysInUilmApplications(uilmApplicationsToBeUpdated);
            }

            if (uilmApplicationsToBeInserted.Any())
            {
                await InsertUilmApplications(uilmApplicationsToBeInserted);
                await AddNumberOfKeysInUilmApplications(uilmApplicationsToBeInserted);
            }
        }

        private async Task AddNumberOfKeysInUilmApplications(List<BlocksLanguageModule> uilmApplications)
        {
            foreach (var application in uilmApplications)
            {
                await _keyRepository.UpdateKeysCountOfAppAsync(application.ItemId, _blocksBaseCommand?.IsExternal ?? false, _blocksBaseCommand?.ClientTenantId, _blocksBaseCommand?.OrganizationId);
            }
        }

        private async Task InsertUilmApplications(List<BlocksLanguageModule> uilmApplicationsToBeInserted)
        {
            await _keyRepository.InsertUilmApplications(uilmApplicationsToBeInserted, _blocksBaseCommand?.ClientTenantId);
        }

        public async Task<bool> ExportUilmFile(UilmExportEvent request)
        {
            var languageSettings = await GetLanguageSetting();
            var languageApplications = await GetLanguageApplications(request.AppIds);
            var languageResourceKeys = await GetLanguageResourceKeys(request.AppIds);

            switch (request.OutputType)
            {
                case OutputType.Xlsx:
                    return await GenerateXlsxFile(languageApplications, languageResourceKeys, request.FileId, languageSettings, request.Languages);
                case OutputType.Json:
                    return await GenerateJsonFile(languageApplications, languageResourceKeys, request.FileId, languageSettings, request.Languages);
                case OutputType.Csv:
                    return await GenerateCsvFile(languageApplications, languageResourceKeys, request.FileId, languageSettings, request.Languages);
                case OutputType.Xlf:
                    return await GenerateXlfFile(languageApplications, languageResourceKeys, request.FileId, languageSettings, request.Languages, request.ReferenceFileId, request.ProjectKey);
                default:
                    return false;
            }
        }

        private async Task<BlocksLanguage> GetLanguageSetting()
        {
            BlocksLanguage languageSetting = null;

            languageSetting = await _keyRepository.GetLanguageSettingAsync(_blocksBaseCommand?.ClientTenantId);

            return languageSetting;
        }

        private async Task<bool> GenerateXlsxFile(List<BlocksLanguageModule> applications,
            List<BlocksLanguageKey> resourceKeys, string fileId, BlocksLanguage languageSetting, List<string> requestedLanguages)
        {
            var xlsxOutputGenerator = _serviceProvider.GetService<XlsxOutputGeneratorService>();

            // Get all languages from BlocksLanguage collection
            var allLanguages = await _keyRepository.GetAllLanguagesAsync(string.Empty);

            // Filter languages if specific languages are requested
            if (requestedLanguages != null && requestedLanguages.Any())
            {
                allLanguages = allLanguages.Where(l => requestedLanguages.Contains(l.LanguageCode)).ToList();
            }

            var workBook = await xlsxOutputGenerator.GenerateAsync<XLWorkbook>(allLanguages, applications, resourceKeys, languageSetting.LanguageCode);
            if (workBook == null)
            {
                _logger.LogError("GenerateAndWriteFile: Workbook is null");
                return false;
            }
            var xlsxStream = new MemoryStream();
            workBook.SaveAs(xlsxStream);
            var fileName = "uilm_xlsx_" + DateTime.Now.ToString(DateTimeFormat) + ".xlsx";
            return await SaveUilmFile(fileId, fileName, xlsxStream);
        }

        private async Task<bool> SaveUilmFile(string fileId, string fileName, MemoryStream stream)
        {
            var metaData = new Dictionary<string, object>
            {
                ["FileName"] = new { Type = "String", Value = fileName },
                ["Report"] = new { Type = "String", Value = "UILM Export Data" }
            };

            var result = await _storageHelperService.SaveIntoStorage(stream, fileId, fileName, metaData, "Blocks-Language-Export");
            if (result)
            {
                _logger.LogInformation("SaveUilmFile: Uploaded fileName={FileName}, fileId={NewFileId}", fileName, fileId);

                // Create UilmExportedFile entry in DB after successful storage
                await CreateUilmExportedFileEntryAsync(fileId, fileName);
            }
            else
            {
                _logger.LogError("SaveUilmFile: Error in saving file");
            }

            return result;
        }

        private async Task CreateUilmExportedFileEntryAsync(string fileId, string fileName)
        {
            try
            {
                var exportedFile = new UilmExportedFile
                {
                    FileId = fileId,
                    FileName = fileName,
                    CreateDate = DateTime.UtcNow,
                    CreatedBy = BlocksContext.GetContext()?.UserId ?? "System"
                };

                await _keyRepository.SaveUilmExportedFileAsync(exportedFile);
                _logger.LogInformation("SaveUilmFile: Created UilmExportedFile entry for fileId={FileId}", fileId);
            }
            catch (Exception ex)
            {
                _logger.LogError("SaveUilmFile: Failed to create UilmExportedFile entry for fileId={FileId}, Error: {Error}", fileId, ex.Message);
                // Don't fail the entire operation if just the DB entry creation fails
            }
        }

        private async Task<bool> GenerateJsonFile(List<BlocksLanguageModule> applications,
            List<BlocksLanguageKey> resourceKeys, string fileId, BlocksLanguage languageSetting, List<string> requestedLanguages)
        {
            var jsonOutputGenerator = _serviceProvider.GetService<JsonOutputGeneratorService>();

            // Get all languages from BlocksLanguage collection
            var allLanguages = await _keyRepository.GetAllLanguagesAsync(string.Empty);

            // Filter languages if specific languages are requested
            if (requestedLanguages != null && requestedLanguages.Any())
            {
                allLanguages = allLanguages.Where(l => requestedLanguages.Contains(l.LanguageCode)).ToList();
            }

            var jsonString = await jsonOutputGenerator.GenerateAsync<string>(allLanguages, applications, resourceKeys, languageSetting.LanguageCode);
            if (string.IsNullOrEmpty(jsonString))
            {
                _logger.LogError("GenerateAndWriteFile: Json is null");
                return false;
            }
            var fileBytes = Encoding.UTF8.GetBytes(jsonString);
            var jsonStream = new MemoryStream(fileBytes.ToArray());
            var JsonFileName = "uilm_json_" + DateTime.Now.ToString(DateTimeFormat) + ".json";
            return await SaveUilmFile(fileId, JsonFileName, jsonStream);
        }

        private async Task<bool> GenerateCsvFile(List<BlocksLanguageModule> applications,
            List<BlocksLanguageKey> resourceKeys, string fileId, BlocksLanguage languageSetting, List<string> requestedLanguages)
        {
            var csvOutputGenerator = _serviceProvider.GetService<CsvOutputGeneratorService>();

            // Get all languages from BlocksLanguage collection
            var allLanguages = await _keyRepository.GetAllLanguagesAsync(string.Empty);

            // Filter languages if specific languages are requested
            if (requestedLanguages != null && requestedLanguages.Any())
            {
                allLanguages = allLanguages.Where(l => requestedLanguages.Contains(l.LanguageCode)).ToList();
            }

            var stream = await csvOutputGenerator.GenerateAsync<MemoryStream>(allLanguages, applications, resourceKeys, languageSetting.LanguageCode);
            if (stream is null)
            {
                _logger.LogError("GenerateAndWriteFile: Csv Stream is null");
                return false;
            }
            var csvFileName = "uilm_csv_" + DateTime.Now.ToString(DateTimeFormat) + ".csv";
            return await SaveUilmFile(fileId, csvFileName, stream);
        }

        private async Task<bool> GenerateXlfFile(List<BlocksLanguageModule> applications,
            List<BlocksLanguageKey> resourceKeys, string fileId, BlocksLanguage languageSetting, List<string> requestedLanguages,
            string referenceFileId, string projectKey)
        {
            // Filter languages if specific languages are requested
            var languages = requestedLanguages != null && requestedLanguages.Any()
                ? requestedLanguages
                : (await _keyRepository.GetAllLanguagesAsync(string.Empty)).Select(l => l.LanguageCode).ToList();

            // If reference file is provided, use it as template
            if (!string.IsNullOrWhiteSpace(referenceFileId))
            {
                _logger.LogInformation("GenerateXlfFile: Using reference file as template with ID: {ReferenceFileId}", referenceFileId);

                var (fileData, stream) = await GetFileStream(referenceFileId, projectKey);
                if (fileData is null || stream is null)
                {
                    _logger.LogError("GenerateXlfFile: Failed to load reference file with ID: {ReferenceFileId}", referenceFileId);
                    return false;
                }

                // Generate XLF files for each language using the reference as template
                var exportStreamFileMap = await GetLanguageStreamMapFromTemplate(languages, stream, resourceKeys);

                var zipStream = CreateZipStream(exportStreamFileMap);
                var xlfZipFileName = "uilm_xlf_" + DateTime.Now.ToString(DateTimeFormat) + ".zip";

                return await SaveUilmFile(fileId, xlfZipFileName, zipStream);
            }
            else
            {
                // No reference file - generate from scratch
                var xlfOutputGenerator = _serviceProvider.GetService<XlfOutputGeneratorService>();
                var allLanguages = await _keyRepository.GetAllLanguagesAsync(string.Empty);

                if (requestedLanguages != null && requestedLanguages.Any())
                {
                    allLanguages = allLanguages.Where(l => requestedLanguages.Contains(l.LanguageCode)).ToList();
                }

                var stream = await xlfOutputGenerator.GenerateAsync<MemoryStream>(allLanguages, applications, resourceKeys, languageSetting.LanguageCode, null);
                if (stream is null)
                {
                    _logger.LogError("GenerateAndWriteFile: XLF ZIP Stream is null");
                    return false;
                }

                var xlfZipFileName = "uilm_xlf_" + DateTime.Now.ToString("yyyyMMddHHmmss") + ".zip";
                return await SaveUilmFile(fileId, xlfZipFileName, stream);
            }
        }

        private async Task<Dictionary<string, MemoryStream>> GetLanguageStreamMapFromTemplate(List<string> languages, Stream referenceStream, List<BlocksLanguageKey> resourceKeys)
        {
            var exportStreamFileMap = new Dictionary<string, MemoryStream>();

            foreach (var language in languages)
            {
                _logger.LogInformation("GetLanguageStreamMapFromTemplate: Processing language: {Language}", language);

                // Build resource key-value map for this language from database
                var resourceKeyValueMap = new Dictionary<string, string>();

                foreach (var dbResource in resourceKeys)
                {
                    var resource = dbResource?.Resources?.FirstOrDefault(x => x.Culture == language);
                    if (resource != null && !string.IsNullOrEmpty(dbResource?.KeyName))
                    {
                        resourceKeyValueMap.TryAdd(dbResource.KeyName, resource.Value);
                    }
                }

                // Copy the reference stream for this language
                using (MemoryStream copyStream = new MemoryStream())
                {
                    referenceStream.Position = 0;
                    await referenceStream.CopyToAsync(copyStream);
                    copyStream.Position = 0;

                    // Write database values into the XLF template
                    var exportStream = WriteToXlf(copyStream, resourceKeyValueMap, language);

                    // Use short language code for filename (e.g., "de" instead of "de-DE")
                    var shortLanguageCode = language.Contains('-') ? language.Split('-')[0] : language;
                    var xlfFileName = $"messages.{shortLanguageCode}.xlf";

                    exportStreamFileMap.Add(xlfFileName, exportStream);
                }
            }

            return exportStreamFileMap;
        }

        private MemoryStream WriteToXlf(Stream templateStream, Dictionary<string, string> resourceKeyValueMap, string targetLanguage)
        {
            try
            {
                var document = XDocument.Load(templateStream);

                // Detect the namespace from the document root instead of hardcoding it
                XNamespace ns = document.Root?.GetDefaultNamespace() ?? "urn:oasis:names:tc:xliff:document:1.2";

                var fileElements = document.Root?.Descendants(ns + "file");
                if (fileElements == null || !fileElements.Any())
                {
                    _logger.LogWarning("WriteToXlf: No file elements found in XLF template");
                    return new MemoryStream();
                }

                int matchedCount = 0;

                // Update the target language attribute
                foreach (var fileElement in fileElements)
                {
                    fileElement.SetAttributeValue("target-language", targetLanguage);

                    var body = fileElement.Element(ns + "body");
                    if (body == null) continue;

                    // Use Descendants to find trans-unit elements that may be nested inside <group> elements
                    var transUnits = body.Descendants(ns + "trans-unit");
                    foreach (var transUnit in transUnits)
                    {
                        var keyName = transUnit.Element(ns + "source")?.Value;

                        if (string.IsNullOrEmpty(keyName)) continue;

                        // If we have a value from database, update the target element
                        if (resourceKeyValueMap.TryGetValue(keyName, out var value) && !string.IsNullOrEmpty(value))
                        {
                            var targetElement = transUnit.Element(ns + "target");
                            if (targetElement != null)
                            {
                                targetElement.Value = value;
                            }
                            else
                            {
                                // Create target element if it doesn't exist
                                var sourceElement = transUnit.Element(ns + "source");
                                sourceElement?.AddAfterSelf(new XElement(ns + "target", value));
                            }
                            matchedCount++;
                        }
                    }
                }

                // Write the updated XML to a new stream
                var outputStream = new MemoryStream();
                document.Save(outputStream);
                outputStream.Position = 0;

                _logger.LogInformation("WriteToXlf: Successfully updated XLF for language: {Language} with {Count} matched keys out of {Total} available", targetLanguage, matchedCount, resourceKeyValueMap.Count);

                return outputStream;
            }
            catch (Exception ex)
            {
                _logger.LogError("WriteToXlf: Error updating XLF template: {Error}", ex.Message);
                return new MemoryStream();
            }
        }

        private MemoryStream CreateZipStream(Dictionary<string, MemoryStream> fileStreamMap)
        {
            var zipStream = new MemoryStream();

            using (var archive = new System.IO.Compression.ZipArchive(zipStream, System.IO.Compression.ZipArchiveMode.Create, true))
            {
                foreach (var kvp in fileStreamMap)
                {
                    var fileName = kvp.Key;
                    var fileStream = kvp.Value;

                    var zipEntry = archive.CreateEntry(fileName, System.IO.Compression.CompressionLevel.Optimal);

                    using (var entryStream = zipEntry.Open())
                    {
                        fileStream.Position = 0;
                        fileStream.CopyTo(entryStream);
                    }

                    _logger.LogInformation("CreateZipStream: Added {FileName} to ZIP archive", fileName);
                }
            }

            zipStream.Position = 0;
            _logger.LogInformation("CreateZipStream: Created ZIP with {Count} files", fileStreamMap.Count);

            return zipStream;
        }


        private async Task<List<BlocksLanguageKey>> GetLanguageResourceKeys(List<string> appIds = null)
        {
            List<BlocksLanguageKey> resourceKeys = null;

            if (appIds != null && appIds.Count > 0)
            {
                resourceKeys = await _keyRepository.GetUilmResourceKeys(x =>
                    appIds.Contains(x.ModuleId),
                    _blocksBaseCommand?.ClientTenantId);
            }
            else
            {
                resourceKeys = await _keyRepository.GetUilmResourceKeys(x => true,
                    _blocksBaseCommand?.ClientTenantId);
            }

            return resourceKeys;
        }

        public async Task PublishUilmExportNotification(bool response, string fileId, string? messageCoRelationId, string tenantId)
        {
            var result = await _notificationService.NotifyExportEvent(response, fileId, messageCoRelationId, tenantId);
            if (result)
            {
                _logger.LogInformation("Notification: sent succussfully messageCoRelationId: {MessageCoRelationId}, fileId={FileId}", messageCoRelationId, fileId);
            }
            else
            {
                _logger.LogError("Notification: sending failed messageCoRelationId: {MessageCoRelationId}, fileId={FileId}", messageCoRelationId, fileId);
            }
        }

        public async Task PublishTranslateAllNotification(bool response, string? messageCoRelationId)
        {
            var result = await _notificationService.NotifyTranslateAllEvent(response, messageCoRelationId);
            if (result)
            {
                _logger.LogInformation("Notification: sent succussfully for TranslateAllEvent with messageCoRelationId: {MessageCoRelationId}", messageCoRelationId);
            }
            else
            {
                _logger.LogError("Notification: sending failed for TranslateAllEvent with messageCoRelationId: {MessageCoRelationId}", messageCoRelationId);
            }
        }

        public async Task PublishTranslateBlocksLanguageKeyNotification(bool response, string? messageCoRelationId)
        {
            var result = await _notificationService.NotifyTranslateBlocksLanguageKeyEvent(response, messageCoRelationId);
            if (result)
            {
                _logger.LogInformation("Notification: sent successfully for TranslateBlocksLanguageKeyEvent with messageCoRelationId: {MessageCoRelationId}", messageCoRelationId);
            }
            else
            {
                _logger.LogError("Notification: sending failed for TranslateBlocksLanguageKeyEvent with messageCoRelationId: {MessageCoRelationId}", messageCoRelationId);
            }
        }

        public async Task PublishEnvironmentDataMigrationNotification(bool response, string? messageCoRelationId, string projectKey, string targetedProjectKey)
        {
            var result = await _notificationService.NotifyEnvironmentDataMigrationEvent(response, messageCoRelationId, projectKey, targetedProjectKey);
            if (result)
            {
                _logger.LogInformation("Notification: sent successfully for EnvironmentDataMigrationEvent with messageCoRelationId: {MessageCoRelationId}, ProjectKey: {ProjectKey}, TargetedProjectKey: {TargetedProjectKey}",
                    messageCoRelationId, projectKey, targetedProjectKey);
            }
            else
            {
                _logger.LogError("Notification: sending failed for EnvironmentDataMigrationEvent with messageCoRelationId: {MessageCoRelationId}, ProjectKey: {ProjectKey}, TargetedProjectKey: {TargetedProjectKey}",
                    messageCoRelationId, projectKey, targetedProjectKey);
            }
        }

        public async Task<BaseMutationResponse> DeleteCollectionsAsync(DeleteCollectionsRequest request)
        {
            _logger.LogInformation("Delete collections operation started");

            if (request.Collections == null || !request.Collections.Any())
            {
                _logger.LogWarning("Delete collections operation ended - No collections specified");
                return new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "Collections", "At least one collection must be specified" }
                    }
                };
            }

            var validCollections = new List<string> { "BlocksLanguageKeys", "BlocksLanguages", "BlocksLanguageModules", "UilmFiles" };
            var invalidCollections = request.Collections.Where(c => !validCollections.Contains(c)).ToList();

            if (invalidCollections.Any())
            {
                _logger.LogWarning("Delete collections operation ended - Invalid collections specified: {InvalidCollections}", string.Join(", ", invalidCollections));
                return new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "Collections", $"Invalid collections specified: {string.Join(", ", invalidCollections)}. Valid collections are: {string.Join(", ", validCollections)}" }
                    }
                };
            }

            try
            {
                var deleteResults = await _keyRepository.DeleteCollectionsAsync(request.Collections);

                var totalDeleted = deleteResults.Values.Sum();
                _logger.LogInformation("Delete collections operation completed successfully. Collections: {Collections}, Total records deleted: {TotalDeleted}",
                    string.Join(", ", request.Collections), totalDeleted);

                return new BaseMutationResponse
                {
                    IsSuccess = true
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Delete collections operation failed");
                return new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "Operation", "Failed to delete collections data. Please try again." }
                    }
                };
            }
        }

        public async Task<BaseMutationResponse> RollbackAsync(RollbackRequest request)
        {
            _logger.LogInformation("Rollback operation started for ItemId: {ItemId}", request.ItemId);

            try
            {
                // Get the timeline entry directly by ItemId
                var timeline = await _keyTimelineRepository.GetTimelineByItemIdAsync(request.ItemId);

                if (timeline == null)
                {
                    _logger.LogWarning("Rollback failed - No timeline found for ItemId: {ItemId}", request.ItemId);
                    return new BaseMutationResponse
                    {
                        IsSuccess = false,
                        Errors = new Dictionary<string, string>
                        {
                            { "ItemId", "No timeline found for the specified key" }
                        }
                    };
                }

                if (timeline.PreviousData == null || string.IsNullOrEmpty(timeline.PreviousData.ItemId))
                {
                    _logger.LogWarning("Rollback failed - No previous data available for ItemId: {ItemId}", request.ItemId);
                    return new BaseMutationResponse
                    {
                        IsSuccess = false,
                        Errors = new Dictionary<string, string>
                        {
                            { "PreviousData", "No previous data available for rollback" }
                        }
                    };
                }

                // Get the current BlocksLanguageKey by PreviousData.ItemId
                var currentKey = await _keyRepository.GetUilmResourceKey(x => x.ItemId == timeline.PreviousData.ItemId, "");
                if (currentKey == null)
                {
                    _logger.LogWarning("Rollback failed - Key not found with ItemId: {ItemId}", timeline.PreviousData.ItemId);
                    return new BaseMutationResponse
                    {
                        IsSuccess = false,
                        Errors = new Dictionary<string, string>
                        {
                            { "Key", "Key not found in database" }
                        }
                    };
                }

                // Store current state for timeline
                var rollbackFromKey = GetBlocksLanguageKey(currentKey);

                // Update the key with previous data
                currentKey.KeyName = timeline.PreviousData.KeyName;
                currentKey.Resources = timeline.PreviousData.Resources;
                currentKey.Routes = timeline.PreviousData.Routes;
                currentKey.IsPartiallyTranslated = timeline.PreviousData.IsPartiallyTranslated;
                currentKey.LastUpdateDate = DateTime.UtcNow;

                // Save the rolled back key
                await _keyRepository.SaveKeyAsync(currentKey);

                // Create timeline entry for the rollback operation
                await CreateKeyTimelineEntryAsync(rollbackFromKey, currentKey, LogFromConstants.Rollback);

                _logger.LogInformation("Rollback operation completed successfully for ItemId: {ItemId}", request.ItemId);

                return new BaseMutationResponse
                {
                    IsSuccess = true
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Rollback operation failed for ItemId: {ItemId}", request.ItemId);
                return new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "Operation", "Rollback operation failed. Please try again." }
                    }
                };
            }
        }

        private async Task CreateKeyTimelineEntryAsync(BlocksLanguageKey? previousKey, BlocksLanguageKey? currentKey, string logFrom, string? operationId = null, string? entityId = null)
        {
            try
            {
                var context = BlocksContext.GetContext();
                var resolvedEntityId = entityId ?? currentKey?.ItemId ?? previousKey?.ItemId ?? "";
                var timeline = new KeyTimeline
                {
                    EntityId = resolvedEntityId,
                    CurrentData = currentKey,
                    PreviousData = previousKey,
                    LogFrom = logFrom,
                    UserId = context?.UserId ?? "System",
                    CreateDate = DateTime.UtcNow,
                    LastUpdateDate = DateTime.UtcNow,
                    OperationId = operationId ?? Guid.NewGuid().ToString()
                };

                await _keyTimelineRepository.SaveKeyTimelineAsync(timeline);
                _logger.LogInformation("Timeline entry created for Key {KeyId} from {LogFrom}", resolvedEntityId, logFrom);
            }
            catch (Exception ex)
            {
                _logger.LogError("Failed to create timeline entry for Key {KeyId}: {Error}", entityId ?? currentKey?.ItemId ?? previousKey?.ItemId, ex.Message);
                // Don't throw - timeline creation should not break the main operation
            }
        }

        public async Task CreateBulkKeyTimelineEntriesAsync(List<BlocksLanguageKey> keys, string logFrom, string targetedProjectKey)
        {
            try
            {
                if (!keys.Any()) return;

                var operationId = Guid.NewGuid().ToString();
                var context = BlocksContext.GetContext();
                var timelines = keys.Select(key => new KeyTimeline
                {
                    EntityId = key.ItemId,
                    CurrentData = key,
                    PreviousData = null,
                    LogFrom = logFrom,
                    UserId = context?.UserId ?? "System",
                    CreateDate = DateTime.UtcNow,
                    LastUpdateDate = DateTime.UtcNow,
                    OperationId = operationId
                }).ToList();

                await _keyTimelineRepository.BulkSaveKeyTimelinesAsync(timelines, targetedProjectKey);
                _logger.LogInformation("Bulk timeline entries created for {Count} keys from {LogFrom}", keys.Count, logFrom);
            }
            catch (Exception ex)
            {
                _logger.LogError("Failed to create bulk timeline entries for {Count} keys: {Error}", keys.Count, ex.Message);
                // Don't throw - timeline creation should not break the main operation
            }
        }

        public async Task CreateBulkKeyTimelineEntriesAsync(List<BlocksLanguageKey> keys, List<BlocksLanguageKey> previousKeys, string logFrom, string targetedProjectKey)
        {
            try
            {
                if (!keys.Any()) return;

                // Create a dictionary for quick lookup of previous keys by ItemId
                var previousKeyDict = previousKeys?.ToDictionary(k => k.ItemId, k => k) ?? new Dictionary<string, BlocksLanguageKey>();

                var operationId = Guid.NewGuid().ToString();
                var context = BlocksContext.GetContext();
                var timelines = keys.Select(key => new KeyTimeline
                {
                    EntityId = key.ItemId,
                    CurrentData = key,
                    PreviousData = previousKeyDict.TryGetValue(key.ItemId, out var previousKey) ? previousKey : null,
                    LogFrom = logFrom,
                    UserId = context?.UserId ?? "System",
                    CreateDate = DateTime.UtcNow,
                    LastUpdateDate = DateTime.UtcNow,
                    OperationId = operationId
                }).ToList();

                await _keyTimelineRepository.BulkSaveKeyTimelinesAsync(timelines, targetedProjectKey);
                _logger.LogInformation("Bulk timeline entries created for {Count} keys from {LogFrom}", keys.Count, logFrom);
            }
            catch (Exception ex)
            {
                _logger.LogError("Failed to create bulk timeline entries for {Count} keys: {Error}", keys.Count, ex.Message);
                // Don't throw - timeline creation should not break the main operation
            }
        }

        public async Task CreateNoChangePublishTimelineEntryAsync(string logFrom, string targetedProjectKey)
        {
            try
            {
                var context = BlocksContext.GetContext();
                var timeline = new KeyTimeline
                {
                    EntityId = null,
                    CurrentData = null,
                    PreviousData = null,
                    LogFrom = logFrom,
                    UserId = context?.UserId ?? "System",
                    CreateDate = DateTime.UtcNow,
                    LastUpdateDate = DateTime.UtcNow,
                    OperationId = Guid.NewGuid().ToString()
                };

                await _keyTimelineRepository.BulkSaveKeyTimelinesAsync(new List<KeyTimeline> { timeline }, targetedProjectKey);
                _logger.LogInformation("No-change publish timeline entry created for {LogFrom}", logFrom);
            }
            catch (Exception ex)
            {
                _logger.LogError("Failed to create no-change publish timeline entry: {Error}", ex.Message);
            }
        }

        private BlocksLanguageKey MapKeyToBlocksLanguageKey(Key key)
        {
            return new BlocksLanguageKey
            {
                ItemId = key.ItemId ?? Guid.NewGuid().ToString(),
                KeyName = key.KeyName,
                ModuleId = key.ModuleId,
                Resources = key.Resources,
                Routes = key.Routes ?? new List<string>(),
                IsPartiallyTranslated = key.IsPartiallyTranslated,
                LastUpdateDate = key.LastUpdateDate,
                CreateDate = key.CreateDate,
                TenantId = _tenantId
            };
        }

        public static bool HasResourceChanges(BlocksLanguageKey currentKey, Dictionary<string, KeyTimeline> previousPublishTimelines)
        {
            if (!previousPublishTimelines.TryGetValue(currentKey.ItemId, out var previousTimeline) || previousTimeline.CurrentData == null)
            {
                return true; // No previous publish entry � treat as changed (new key)
            }

            var previousResources = previousTimeline.CurrentData.Resources;
            var currentResources = currentKey.Resources;

            if (previousResources == null && currentResources == null) return false;
            if (previousResources == null || currentResources == null) return true;
            if (previousResources.Length != currentResources.Length) return true;

            var previousDict = previousResources.ToDictionary(r => r.Culture ?? "", r => r.Value ?? "");

            foreach (var resource in currentResources)
            {
                var culture = resource.Culture ?? "";
                var currentValue = resource.Value ?? "";

                if (!previousDict.TryGetValue(culture, out var previousValue) || previousValue != currentValue)
                {
                    return true;
                }
            }

            return false;
        }

        public async Task<GetLanguageFileGenerationHistoryResponse> GetLanguageFileGenerationHistoryAsync(GetLanguageFileGenerationHistoryRequest request)
        {
            return await _languageFileGenerationHistoryRepository.GetPaginatedAsync(request);
        }
    }
}
