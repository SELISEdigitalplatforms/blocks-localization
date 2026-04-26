using BlocksTemplate.DomainService.Services;
namespace BlocksTemplate.DomainService.Repositories
{
    public interface IModuleRepository
    {
        Task SaveAsync(BlocksLanguageModule module);
        Task<BlocksLanguageModule> GetByNameAsync(string name);
        Task<BlocksLanguageModule> GetByIdAsync(string id);
        Task<List<BlocksLanguageModule>> GetAllAsync();
    }
}
