using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Shared.Entities;

namespace Eurolm.DomainService.Services
{
    public abstract class OutputGenerator
    {
        public abstract Task<T> GenerateAsync<T>(List<BlocksLanguage> languageSettings, List<BlocksLanguageModule> applications,
            List<BlocksLanguageKey> resourceKeys, string defaultLanguage);

        // Overload for generators that support reference translations (e.g., XLF)
        public virtual Task<T> GenerateAsync<T>(List<BlocksLanguage> languageSettings, List<BlocksLanguageModule> applications,
            List<BlocksLanguageKey> resourceKeys, string defaultLanguage, Dictionary<string, Dictionary<string, string>> referenceTranslations)
        {
            // Default implementation ignores reference translations
            return GenerateAsync<T>(languageSettings, applications, resourceKeys, defaultLanguage);
        }
    }
}
