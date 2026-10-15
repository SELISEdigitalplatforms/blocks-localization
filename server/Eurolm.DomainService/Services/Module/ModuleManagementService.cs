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

        public ModuleManagementService(IValidator<Module> validator,
                                      IModuleRepository moduleRepository,
                                      ILogger<ModuleManagementService> logger,
                                      //Lazy<IKeyBulkOperationsService> keyBulkOperationsService,
                                      IGlossaryRepository glossaryRepository,
                                      IKeyRepository keyRepository)
        {
            _validator = validator;
            _moduleRepository = moduleRepository;
            _logger = logger;
            //_keyBulkOperationsService = keyBulkOperationsService;
            _glossaryRepository = glossaryRepository;
            _keyRepository = keyRepository;
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

            try
            {
                var module = await _moduleRepository.GetByIdAsync(request.ItemId);
                if (module == null)
                    return new BaseMutationResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "ItemId", "Module not found" } } };

                // Keys are deleted or moved separately; a module is only deletable once it is empty.
                if (await _keyRepository.HasKeysInModuleAsync(request.ItemId))
                    return new BaseMutationResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "ItemId", "Module has keys. Please delete or move all keys to another module before deleting it." } } };

                await _moduleRepository.DeleteAsync(request.ItemId);
                return new BaseMutationResponse { IsSuccess = true };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while deleting BlocksLanguageModule {ErrorMessage}", ex.Message);
                return new BaseMutationResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "Error", "An unexpected error occurred" } } };
            }
        }

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
