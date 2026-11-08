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
        private readonly IActionPublisher _actionPublisher;

        private const string LanguageChangedAction = "localization.language.changed";

        private static string CurrentTenantId => BlocksContext.GetContext()?.TenantId
            ?? throw new InvalidOperationException("A tenant context is required to save a language.");

        public LanguageManagementService(IValidator<Language> validator,
                                        ILogger<LanguageManagementService> logger,
                                        ILanguageRepository languageRepository,
                                        IActionPublisher actionPublisher)
        {
            _validator = validator;
            _logger = logger;
            _languageRepository = languageRepository;
            _actionPublisher = actionPublisher;
        }

        public async Task<ApiResponse> SaveLanguageAsync(Language language)
        {
            var validationResult = await _validator.ValidateAsync(language);

            if (!validationResult.IsValid)
                return new ApiResponse(string.Empty, validationResult.Errors);

            bool isNew;
            try
            {
                (var repoLanguage, isNew) = await MappedIntoRepoLanguageAsync(language);
                await _languageRepository.SaveAsync(repoLanguage);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while saving BlocksLanguage {ErrorMessage}", ex.Message);
                return new ApiResponse(ex.Message);
            }

            if (isNew)
                await PublishLanguageChangedAsync(language.LanguageCode, "added");

            return new ApiResponse();
        }

        public async Task<List<Language>> GetLanguagesAsync()
        {
            return await _languageRepository.GetAllLanguagesAsync();
        }
        public async Task<List<Language>> GetLanguagesAsync(string ProjectKey)
        {
            return await _languageRepository.GetAllLanguagesAsync(ProjectKey);
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
            await PublishLanguageChangedAsync(language.LanguageCode, "removed");
            return new BaseMutationResponse { IsSuccess = true };
        }
        private async Task<(BlocksLanguage Language, bool IsNew)> MappedIntoRepoLanguageAsync(Language language)
        {
            var repoLanguage = await _languageRepository.GetLanguageByNameAsync(language.LanguageName);
            var isNew = repoLanguage == null;

            if (repoLanguage == null)
                repoLanguage = new BlocksLanguage { ItemId = Guid.NewGuid().ToString(), CreateDate = DateTime.UtcNow, TenantId = CurrentTenantId};

            repoLanguage.LastUpdateDate = DateTime.UtcNow;
            repoLanguage.LanguageCode = language.LanguageCode;
            repoLanguage.LanguageName = language.LanguageName;
            repoLanguage.IsDefault = language.IsDefault;

            return (repoLanguage, isNew);
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
            await PublishLanguageChangedAsync(language.LanguageCode, "default");
            return new BaseMutationResponse { IsSuccess = true };
        }

        private Task PublishLanguageChangedAsync(string languageCode, string change)
        {
            return _actionPublisher.PublishAsync(LanguageChangedAction, new
            {
                projectKey = BlocksContext.GetContext()?.TenantId ?? string.Empty,
                language = languageCode,
                change
            });
        }
    }
}
