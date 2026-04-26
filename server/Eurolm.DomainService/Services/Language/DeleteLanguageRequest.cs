using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class DeleteLanguageRequest : IProjectKey
    {
        public string LanguageName { get; set; }
        public string? ProjectKey { get; set; }
    }
}
