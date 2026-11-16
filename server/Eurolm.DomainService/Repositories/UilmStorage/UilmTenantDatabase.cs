using Blocks.Genesis;
using MongoDB.Driver;

namespace Eurolm.DomainService.Repositories.UilmStorage
{
    internal static class UilmTenantDatabase
    {
        /// <summary>The current tenant's database; Storage publishing never runs without a tenant.</summary>
        public static IMongoDatabase Current(IDbContextProvider dbContextProvider)
        {
            var tenantId = BlocksContext.GetContext()?.TenantId;
            if (string.IsNullOrWhiteSpace(tenantId))
            {
                throw new InvalidOperationException("A tenant context is required for UILM Storage data.");
            }
            return dbContextProvider.GetDatabase(tenantId);
        }
    }
}
