using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Shared;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging;

namespace Eurolm.DomainService.Services
{
    public class GlossaryManagementService : IGlossaryManagementService
    {
        private readonly IValidator<Glossary> _validator;
        private readonly ILogger<GlossaryManagementService> _logger;
        private readonly IGlossaryRepository _glossaryRepository;
        private readonly IKeyRepository _keyRepository;

        internal const string VersionConflictMessage = "This glossary was changed by someone else. Reload and try again.";
        internal const string ItemNotFoundMessage = "Glossary item not found";

        private static string CurrentTenantId => BlocksContext.GetContext()?.TenantId
            ?? throw new InvalidOperationException("A tenant context is required to save a glossary.");

        public GlossaryManagementService(IValidator<Glossary> validator,
                                         ILogger<GlossaryManagementService> logger,
                                         IGlossaryRepository glossaryRepository,
                                         IKeyRepository keyRepository)
        {
            _validator = validator;
            _logger = logger;
            _glossaryRepository = glossaryRepository;
            _keyRepository = keyRepository;
        }

        public async Task<ApiResponse> SaveGlossaryAsync(Glossary glossary)
        {
            var validationResult = await _validator.ValidateAsync(glossary);

            if (!validationResult.IsValid)
                return new ApiResponse(string.Empty, validationResult.Errors);

            try
            {
                if (string.IsNullOrEmpty(glossary.ItemId))
                {
                    await _glossaryRepository.InsertAsync(MapNewGlossary(glossary));
                    return new ApiResponse();
                }

                var existing = await _glossaryRepository.GetStoredByIdAsync(glossary.ItemId);
                if (existing == null)
                    return ValidationError(nameof(Glossary.ItemId), ItemNotFoundMessage);

                // Clients that omit version (CLI, extension) skip the check.
                if (glossary.Version.HasValue && glossary.Version.Value != existing.Version)
                    return ValidationError(nameof(Glossary.Version), VersionConflictMessage);

                var matched = await _glossaryRepository.ReplaceAsync(MapUpdatedGlossary(glossary, existing), glossary.Version);
                if (!matched)
                {
                    // A concurrent save won the versioned replace, or the glossary was deleted meanwhile.
                    return glossary.Version.HasValue
                        ? ValidationError(nameof(Glossary.Version), VersionConflictMessage)
                        : ValidationError(nameof(Glossary.ItemId), ItemNotFoundMessage);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError("Error while saving Glossary {ErrorMessage} : {StackTrace}", ex.Message, ex.StackTrace);
                return new ApiResponse(ex.Message);
            }

            return new ApiResponse();
        }

        public async Task<GetGlossariesResponse> GetGlossariesAsync(GetGlossariesRequest request)
        {
            return await _glossaryRepository.GetAllAsync(request);
        }

        public async Task<Glossary?> GetGlossaryByIdAsync(string itemId)
        {
            return await _glossaryRepository.GetByIdAsync(itemId);
        }

        public async Task<BaseMutationResponse> DeleteGlossaryAsync(DeleteGlossaryRequest request)
        {
            _logger.LogInformation("Deleting glossary start");

            var glossary = await _glossaryRepository.GetByIdAsync(request.ItemId);
            if (glossary == null)
            {
                _logger.LogInformation("Deleting glossary end -- glossary not found");

                return new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "itemId", ItemNotFoundMessage }
                    }
                };
            }

            // Untag every key first, so no key is left pointing at a deleted glossary. Retrying after a
            // failed delete below is safe: the pull is idempotent.
            try
            {
                var modifiedKeys = await _keyRepository.RemoveGlossaryIdFromKeysAsync(request.ItemId);
                _logger.LogInformation("Deleting glossary -- removed from {ModifiedKeyCount} keys", modifiedKeys);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Deleting glossary end -- could not remove it from keys: {ErrorMessage}", ex.Message);

                return new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "Error", "Could not remove the glossary from keys. Nothing was deleted." }
                    }
                };
            }

            await _glossaryRepository.DeleteAsync(request.ItemId);

            _logger.LogInformation("Deleting glossary end -- Success");
            return new BaseMutationResponse { IsSuccess = true };
        }

        private static ApiResponse ValidationError(string propertyName, string message) =>
            new(string.Empty, new List<ValidationFailure> { new(propertyName, message) });

        private static BlocksGlossary MapNewGlossary(Glossary glossary)
        {
            var now = DateTime.UtcNow;
            var userId = BlocksContext.GetContext()?.UserId;
            var repoGlossary = new BlocksGlossary
            {
                ItemId = Guid.NewGuid().ToString(),
                CreateDate = now,
                LastUpdateDate = now,
                CreatedBy = userId,
                LastUpdatedBy = userId,
                TenantId = CurrentTenantId,
                Version = 1
            };
            CopyEditableFields(glossary, repoGlossary);
            return repoGlossary;
        }

        private static BlocksGlossary MapUpdatedGlossary(Glossary glossary, BlocksGlossary existing)
        {
            var repoGlossary = new BlocksGlossary
            {
                ItemId = existing.ItemId,
                CreateDate = existing.CreateDate,
                CreatedBy = existing.CreatedBy,
                LastUpdateDate = DateTime.UtcNow,
                LastUpdatedBy = BlocksContext.GetContext()?.UserId,
                TenantId = CurrentTenantId,
                Version = existing.Version + 1
            };
            CopyEditableFields(glossary, repoGlossary);
            return repoGlossary;
        }

        private static void CopyEditableFields(Glossary glossary, BlocksGlossary repoGlossary)
        {
            repoGlossary.Name = Glossary.NormalizeName(glossary.Name);
            repoGlossary.Language = glossary.Language;
            repoGlossary.Type = glossary.Type;
            repoGlossary.Context = glossary.Context;
            repoGlossary.AdditionalNote = glossary.AdditionalNote;
            repoGlossary.IsGlobal = glossary.IsGlobal;
            repoGlossary.ModuleIds = glossary.ModuleIds;
        }
    }
}
