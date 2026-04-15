using Blocks.Genesis;
using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Shared;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace BlocksTemplate.DomainService.Services
{
    public class GlossaryManagementService : IGlossaryManagementService
    {
        private readonly IValidator<Glossary> _validator;
        private readonly ILogger<GlossaryManagementService> _logger;
        private readonly IGlossaryRepository _glossaryRepository;

        private readonly string _tenantId = BlocksContext.GetContext()?.TenantId ?? "";

        public GlossaryManagementService(IValidator<Glossary> validator,
                                         ILogger<GlossaryManagementService> logger,
                                         IGlossaryRepository glossaryRepository)
        {
            _validator = validator;
            _logger = logger;
            _glossaryRepository = glossaryRepository;
        }

        public async Task<ApiResponse> SaveGlossaryAsync(Glossary glossary)
        {
            var validationResult = await _validator.ValidateAsync(glossary);

            if (!validationResult.IsValid)
                return new ApiResponse(string.Empty, validationResult.Errors);

            try
            {
                var repoGlossary = await MappedIntoRepoGlossaryAsync(glossary);
                await _glossaryRepository.SaveAsync(repoGlossary);
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
                        { "itemId", "Glossary item not found" }
                    }
                };
            }

            await _glossaryRepository.DeleteAsync(request.ItemId);

            _logger.LogInformation("Deleting glossary end -- Success");
            return new BaseMutationResponse { IsSuccess = true };
        }

        private async Task<BlocksGlossary> MappedIntoRepoGlossaryAsync(Glossary glossary)
        {
            BlocksGlossary repoGlossary;

            if (!string.IsNullOrEmpty(glossary.ItemId))
            {
                var existing = await _glossaryRepository.GetByIdAsync(glossary.ItemId);
                if (existing != null)
                {
                    repoGlossary = new BlocksGlossary
                    {
                        ItemId = existing.ItemId,
                        CreateDate = existing.CreateDate,
                        TenantId = _tenantId
                    };
                }
                else
                {
                    repoGlossary = new BlocksGlossary
                    {
                        ItemId = glossary.ItemId,
                        CreateDate = DateTime.UtcNow,
                        TenantId = _tenantId
                    };
                }
            }
            else
            {
                repoGlossary = new BlocksGlossary
                {
                    ItemId = Guid.NewGuid().ToString(),
                    CreateDate = DateTime.UtcNow,
                    TenantId = _tenantId
                };
            }

            repoGlossary.LastUpdateDate = DateTime.UtcNow;
            repoGlossary.Name = glossary.Name;
            repoGlossary.Language = glossary.Language;
            repoGlossary.Type = glossary.Type;
            repoGlossary.Context = glossary.Context;
            repoGlossary.AdditionalNote = glossary.AdditionalNote;

            return repoGlossary;
        }
    }
}
