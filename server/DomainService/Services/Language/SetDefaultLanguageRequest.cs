using Blocks.Genesis;

namespace BlocksTemplate.DomainService.Services
{
    public class SetDefaultLanguageRequest : IProjectKey
    {
        public string LanguageName { get; set; }
        public string? ProjectKey { get; set; }
    }
}
