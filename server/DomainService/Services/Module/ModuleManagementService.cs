using Blocks.Genesis;
using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Shared;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace BlocksTemplate.DomainService.Services
{
    public class ModuleManagementService : IModuleManagementService
    {
        private readonly IValidator<Module> _validator;
        private readonly IModuleRepository _moduleRepository;
        private readonly ILogger<ModuleManagementService> _logger;

        private readonly string _tenantId = BlocksContext.GetContext()?.TenantId ?? "";

        public ModuleManagementService(IValidator<Module> validator, 
                                      IModuleRepository moduleRepository,
                                      ILogger<ModuleManagementService> logger)
        {
            _validator = validator;
            _moduleRepository = moduleRepository;
            _logger = logger;
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

        private async Task<BlocksLanguageModule> MappedIntoRepoModuleAsync(Module module)
        {
            var repoModule = await _moduleRepository.GetByNameAsync(module.ModuleName);

            if (repoModule == null)
            {
                repoModule = new BlocksLanguageModule { ItemId = Guid.NewGuid().ToString(), CreateDate = DateTime.UtcNow, TenantId = _tenantId };
            }

            repoModule.ModuleName = module.ModuleName;
            repoModule.LastUpdateDate = DateTime.UtcNow;

            return repoModule;
        }
    }
}
