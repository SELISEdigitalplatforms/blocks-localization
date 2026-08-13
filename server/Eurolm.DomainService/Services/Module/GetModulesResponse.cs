using Eurolm.DomainService.Repositories;

namespace Eurolm.DomainService.Services
{
    public class GetModulesResponse
    {
        public List<BlocksLanguageModule> Items { get; set; } = new();
        public long TotalCount { get; set; }
    }
}
