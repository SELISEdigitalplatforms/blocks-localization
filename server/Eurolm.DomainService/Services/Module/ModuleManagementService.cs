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
        private readonly IGlossaryRepository _glossaryRepository;

        public ModuleManagementService(IValidator<Module> validator,
                                      IModuleRepository moduleRepository,
                                      ILogger<ModuleManagementService> logger,
                                      IGlossaryRepository glossaryRepository)
        {
            _validator = validator;
            _moduleRepository = moduleRepository;
            _logger = logger;
            _glossaryRepository = glossaryRepository;
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
                _logger.LogError("Error while saving BlocksLanguageModule {ErrorMessage} : {StackTrace}", ex.Message, ex.StackTrace);
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
                return await _moduleRepository.GetAllAsync();
            }

            var module = await _moduleRepository.GetByIdAsync(projectKey,moduleId);
            return module != null ? new List<BlocksLanguageModule> { module } : new List<BlocksLanguageModule>();
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
                _logger.LogError("Error while tagging glossary for module {ErrorMessage} : {StackTrace}", ex.Message, ex.StackTrace);
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
                repoModule = new BlocksLanguageModule { ItemId = Guid.NewGuid().ToString(), CreateDate = DateTime.UtcNow, TenantId = tenantId };
            }

            repoModule.ModuleName = module.ModuleName;
            repoModule.LastUpdateDate = DateTime.UtcNow;

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
