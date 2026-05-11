using Eurolm.DomainService.Services;

namespace Blocks.EurolmDriver;

public class EurolmDriverService : IEurolmDriverService
{
    private readonly ILanguageManagementService _languageManagementService;

    public EurolmDriverService(ILanguageManagementService languageManagementService)
    {
        _languageManagementService = languageManagementService;
    }

    public async Task<List<Language>> GetLanguagesAsync()
    {
        return await _languageManagementService.GetLanguagesAsync();
    }
}
