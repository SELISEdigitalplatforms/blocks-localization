using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Shared;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace Eurolm.DomainService.Services
{
    public class ModuleManagementService : IModuleManagementService
    {
        private readonly IValidator<Module> _validator;
        private readonly IModuleRepository _moduleRepository;
        private readonly ILogger<ModuleManagementService> _logger;
        //private readonly Lazy<IKeyBulkOperationsService> _keyBulkOperationsService;
        private readonly IGlossaryRepository _glossaryRepository;
        private readonly IKeyRepository _keyRepository;
        private readonly IKeyTimelineRepository _keyTimelineRepository;

        private const string ItemIdErrorKey = "ItemId";
        private const string TargetModuleIdErrorKey = "TargetModuleId";

        public ModuleManagementService(IValidator<Module> validator,
                                      IModuleRepository moduleRepository,
                                      ILogger<ModuleManagementService> logger,
                                      //Lazy<IKeyBulkOperationsService> keyBulkOperationsService,
                                      IGlossaryRepository glossaryRepository,
                                      IKeyRepository keyRepository,
                                      IKeyTimelineRepository keyTimelineRepository)
        {
            _validator = validator;
            _moduleRepository = moduleRepository;
            _logger = logger;
            //_keyBulkOperationsService = keyBulkOperationsService;
            _glossaryRepository = glossaryRepository;
            _keyRepository = keyRepository;
            _keyTimelineRepository = keyTimelineRepository;
        }

        public async Task<ApiResponse> SaveModuleAsync(SaveModuleRequest module)
        {
            var validationResult = await _validator.ValidateAsync(module);

            if (!validationResult.IsValid)
                return new ApiResponse(string.Empty, validationResult.Errors);

            try
            {
                var repoModule = await MappedIntoRepoModuleAsync(module);
                await _moduleRepository.SaveAsync(repoModule);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while saving BlocksLanguageModule {ErrorMessage}", ex.Message);
                return new ApiResponse(ex.Message);
            }

            return new ApiResponse();
        }

        public async Task<List<BlocksLanguageModule>> GetModulesAsync(string? moduleId = null)
        {
            if (string.IsNullOrEmpty(moduleId))
            {
                return await _moduleRepository.GetAllAsync();
            }

            var module = await _moduleRepository.GetByIdAsync(moduleId);
            return module != null ? new List<BlocksLanguageModule> { module } : new List<BlocksLanguageModule>();
        }
        public async Task<List<BlocksLanguageModule>> GetModulesAsync(string projectKey,string? moduleId = null)
        {
            if (string.IsNullOrEmpty(moduleId))
            {
                return await _moduleRepository.GetAllAsync(projectKey);
            }

            var module = await _moduleRepository.GetByIdAsync(projectKey,moduleId);
            return module != null ? new List<BlocksLanguageModule> { module } : new List<BlocksLanguageModule>();
        }

        public async Task<BaseMutationResponse> DeleteModuleAsync(DeleteModuleRequest request)
        {
            if (string.IsNullOrWhiteSpace(request?.ItemId))
                return new BaseMutationResponse { IsSuccess = false };

            var isMove = !string.IsNullOrWhiteSpace(request.TargetModuleId);
            if (isMove && request.TargetModuleId == request.ItemId)
                return DeleteModuleFailure(TargetModuleIdErrorKey, "Choose a different module to move the keys to");

            try
            {
                var module = await _moduleRepository.GetByIdAsync(request.ItemId);
                if (module == null)
                    return DeleteModuleFailure(ItemIdErrorKey, "Module not found");

                if (isMove)
                {
                    var moveError = await MoveAllKeysAsync(request.ItemId, request.TargetModuleId!);
                    if (moveError != null)
                        return DeleteModuleFailure(TargetModuleIdErrorKey, moveError);
                }

                // A module is only deletable once it is empty; this also catches a key added during the move.
                if (await _keyRepository.HasKeysInModuleAsync(request.ItemId))
                    return DeleteModuleFailure(ItemIdErrorKey, "Module has keys. Please delete or move all keys to another module before deleting it.");

                await _moduleRepository.DeleteAsync(request.ItemId);
                return new BaseMutationResponse { IsSuccess = true };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while deleting BlocksLanguageModule {ErrorMessage}", ex.Message);
                return DeleteModuleFailure("Error", "An unexpected error occurred");
            }
        }

        /// <summary>
        /// Moves every key of the source module to the target module. All-or-nothing: returns an error
        /// message, and moves nothing, when the target is missing or already has a key with the same name.
        /// </summary>
        private async Task<string?> MoveAllKeysAsync(string sourceModuleId, string targetModuleId)
        {
            var targetModule = await _moduleRepository.GetByIdAsync(targetModuleId);
            if (targetModule == null)
                return "Target module not found";

            var tenantId = BlocksContext.GetContext()?.TenantId ?? "";
            var keysToMove = await _keyRepository.GetUilmResourceKeys(k => k.ModuleId == sourceModuleId, tenantId);
            if (keysToMove.Count == 0)
                return null;

            // A module cannot hold two keys with the same name.
            var conflictingNames = (await _keyRepository.GetKeysByKeyNamesAsync(
                    keysToMove.Select(k => k.KeyName).Distinct().ToArray(), targetModuleId))
                .Select(k => k.KeyName)
                .Distinct()
                .OrderBy(name => name, StringComparer.Ordinal)
                .ToList();

            if (conflictingNames.Count > 0)
                return $"Keys with these names already exist in {targetModule.ModuleName}: {string.Join(", ", conflictingNames)}. Rename or delete them before moving";

            await _keyRepository.MoveKeysAsync(keysToMove.Select(k => k.ItemId).ToList(), targetModuleId);
            await CreateMoveTimelinesAsync(keysToMove, targetModuleId, tenantId);
            return null;
        }

        private async Task CreateMoveTimelinesAsync(List<BlocksLanguageKey> movedKeys, string targetModuleId, string tenantId)
        {
            try
            {
                var userId = BlocksContext.GetContext()?.UserId ?? "System";
                var operationId = Guid.NewGuid().ToString();
                var movedAt = DateTime.UtcNow;
                var timelines = movedKeys.Select(key => new KeyTimeline
                {
                    EntityId = key.ItemId,
                    PreviousData = key,
                    CurrentData = CloneWithModule(key, targetModuleId, movedAt),
                    LogFrom = LogFromConstants.KeyBulkMove,
                    UserId = userId,
                    CreateDate = movedAt,
                    LastUpdateDate = movedAt,
                    OperationId = operationId
                }).ToList();

                await _keyTimelineRepository.BulkSaveKeyTimelinesAsync(timelines, tenantId);
            }
            catch (Exception ex)
            {
                // The keys are already moved; a missing history entry must not fail the operation.
                _logger.LogError(ex, "Failed to create move timeline entries for {Count} keys", movedKeys.Count);
            }
        }

        private static BlocksLanguageKey CloneWithModule(BlocksLanguageKey key, string moduleId, DateTime lastUpdateDate) => new BlocksLanguageKey
        {
            ItemId = key.ItemId,
            TenantId = key.TenantId,
            CreateDate = key.CreateDate,
            CreatedBy = key.CreatedBy,
            LastUpdateDate = lastUpdateDate,
            LastUpdatedBy = key.LastUpdatedBy,
            KeyName = key.KeyName,
            ModuleId = moduleId,
            Value = key.Value,
            Resources = key.Resources,
            Routes = key.Routes,
            GlossaryIds = key.GlossaryIds,
            Context = key.Context,
            IsPartiallyTranslated = key.IsPartiallyTranslated
        };

        private static BaseMutationResponse DeleteModuleFailure(string field, string message) => new BaseMutationResponse
        {
            IsSuccess = false,
            Errors = new Dictionary<string, string> { { field, message } }
        };

        public async Task<BaseMutationResponse> TagGlossaryAsync(TagGlossaryRequest request)
        {
            try
            {
                var tenantId = BlocksContext.GetContext()?.TenantId ?? "";
                var currentlyTagged = await _glossaryRepository.GetByModuleIdAsync(tenantId, request.ModuleId);

                foreach (var glossary in currentlyTagged)
                {
                    if (!request.GlossaryIds.Contains(glossary.ItemId ?? ""))
                    {
                        glossary.ModuleIds?.Remove(request.ModuleId);
                        await _glossaryRepository.SaveAsync(MapToBlocksGlossary(glossary, tenantId));
                    }
                }

                if (request.GlossaryIds.Count > 0)
                {
                    var targetGlossaries = await _glossaryRepository.GetByIdsAsync(request.GlossaryIds);
                    foreach (var glossary in targetGlossaries)
                    {
                        glossary.ModuleIds ??= new List<string>();
                        if (!glossary.ModuleIds.Contains(request.ModuleId))
                        {
                            glossary.ModuleIds.Add(request.ModuleId);
                            await _glossaryRepository.SaveAsync(MapToBlocksGlossary(glossary, tenantId));
                        }
                    }
                }

                return new BaseMutationResponse { IsSuccess = true };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while tagging glossary for module {ErrorMessage}", ex.Message);
                return new BaseMutationResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "Error", ex.Message } } };
            }
        }

        private async Task<BlocksLanguageModule> MappedIntoRepoModuleAsync(Module module)
        {
            BlocksLanguageModule? repoModule = null;

            if (!string.IsNullOrEmpty(module.ItemId))
            {
                repoModule = await _moduleRepository.GetByIdAsync(module.ItemId);
            }

            repoModule ??= await _moduleRepository.GetByNameAsync(module.ModuleName);

            if (repoModule == null)
            {
                var tenantId = BlocksContext.GetContext()?.TenantId ?? "";
                repoModule = new BlocksLanguageModule { ItemId = Guid.NewGuid().ToString(), CreateDate = DateTime.UtcNow, TenantId = tenantId, CreatedBy = BlocksContext.GetContext().UserId };
            }

            repoModule.ModuleName = module.ModuleName;
            repoModule.LastUpdateDate = DateTime.UtcNow;
            repoModule.LastUpdatedBy = BlocksContext.GetContext().UserId;

            return repoModule;
        }

        private static BlocksGlossary MapToBlocksGlossary(Glossary glossary, string tenantId) => new BlocksGlossary
        {
            ItemId = glossary.ItemId ?? "",
            Name = glossary.Name,
            Language = glossary.Language ?? "",
            Type = glossary.Type ?? "",
            Context = glossary.Context ?? "",
            AdditionalNote = glossary.AdditionalNote ?? "",
            IsGlobal = glossary.IsGlobal,
            ModuleIds = glossary.ModuleIds,
            CreateDate = glossary.CreateDate,
            LastUpdateDate = DateTime.UtcNow,
            TenantId = tenantId
        };
    }
}
