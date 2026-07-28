using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Shared;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace Eurolm.DomainService.Services
{
    public class LanguageManagementService : ILanguageManagementService
    {
        private readonly IValidator<Language> _validator;
        private readonly ILogger<LanguageManagementService> _logger;
        private readonly ILanguageRepository _languageRepository;

        private readonly string _tenantId = BlocksContext.GetContext()?.TenantId ?? "";

        public LanguageManagementService(IValidator<Language> validator,
                                        ILogger<LanguageManagementService> logger,
                                        ILanguageRepository languageRepository)
        {
            _validator = validator;
            _logger = logger;
            _languageRepository = languageRepository;
        }

        public async Task<ApiResponse> SaveLanguageAsync(Language language)
        {
            var validationResult = await _validator.ValidateAsync(language);

            if (!validationResult.IsValid)
                return new ApiResponse(string.Empty, validationResult.Errors);

            try
            {
                var repoLanguage = await MappedIntoRepoLanguageAsync(language);
                await _languageRepository.SaveAsync(repoLanguage);
            }
            catch (Exception ex)
            {
                _logger.LogError("Error while saving BlocksLanguage {ErrorMessage} : {StackTrace}", ex.Message, ex.StackTrace);
                return new ApiResponse(ex.Message);
            }

            return new ApiResponse();
        }

        public async Task<List<Language>> GetLanguagesAsync()
        {
            return await _languageRepository.GetAllLanguagesAsync();
        }
        public async Task<List<Language>> GetLanguagesAsync(string projectKey)
        {
            return await _languageRepository.GetAllLanguagesAsync(projectKey);
        }
        public async Task<BaseMutationResponse> DeleteAsync(DeleteLanguageRequest request)
        {
            _logger.LogInformation("Deleting language start");

            var language = await _languageRepository.GetLanguageByNameAsync(request.LanguageName);
            if (language == null)
            {
                _logger.LogInformation("Deleting language end -- language not found");

                return new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "languageName", "language not found" }
                    }
                };
            }

            await _languageRepository.DeleteAsync(request.LanguageName);

            _logger.LogInformation("Deleting language end -- Success");
            return new BaseMutationResponse { IsSuccess = true };
        }
        private async Task<BlocksLanguage> MappedIntoRepoLanguageAsync(Language language)
        {
            var repoLanguage = await _languageRepository.GetLanguageByNameAsync(language.LanguageName);

            if(repoLanguage == null)
                repoLanguage = new BlocksLanguage { ItemId = Guid.NewGuid().ToString(), CreateDate = DateTime.UtcNow, TenantId = _tenantId};

            repoLanguage.LastUpdateDate = DateTime.UtcNow;
            repoLanguage.LanguageCode = language.LanguageCode;
            repoLanguage.LanguageName = language.LanguageName;
            repoLanguage.IsDefault = language.IsDefault;

            return repoLanguage;
        }

        public async Task<BaseMutationResponse> SetDefaultLanguage(SetDefaultLanguageRequest request)
        {
            _logger.LogInformation("Default language set start");

            var language = await _languageRepository.GetLanguageByNameAsync(request.LanguageName);
            if (language == null)
            {
                _logger.LogInformation("Default language set end -- language not found");

                return new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "languageName", "language not found" }
                    }
                };
            }

            language.IsDefault = true;

            await Task.WhenAll(
                _languageRepository.SaveAsync(language),
                _languageRepository.RemoveDefault(language)
            );

            _logger.LogInformation("Deleting language end -- Success");
            return new BaseMutationResponse { IsSuccess = true };
        }

    }
}
