using Eurolm.DomainService.Services;

namespace Blocks.EurolmDriver;

public interface IEurolmDriverService
{
    /// <summary>
    /// Retrieves all available languages.
    /// </summary>
    /// <returns>A list of <see cref="Language"/> objects.</returns>
    Task<List<Language>> GetLanguagesAsync();
}
