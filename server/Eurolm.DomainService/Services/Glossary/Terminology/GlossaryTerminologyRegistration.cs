using Eurolm.DomainService.Repositories;
using Microsoft.Extensions.DependencyInjection;

namespace Eurolm.DomainService.Services
{
    public static class GlossaryTerminologyRegistration
    {
        /// <summary>The per-tenant matcher cache, the terminology service and the violation re-check, shared by the API and the worker.</summary>
        public static IServiceCollection AddGlossaryTerminology(this IServiceCollection services)
        {
            services.AddSingleton<IGlossaryMatcherCache>(sp =>
                new GlossaryMatcherCache(tenantId => sp.GetRequiredService<IGlossaryRepository>().GetAllEntitiesAsync(tenantId)));
            services.AddSingleton<IGlossaryTerminologyService, GlossaryTerminologyService>();
            services.AddSingleton<IGlossaryRecheckJobRepository, GlossaryRecheckJobRepository>();
            services.AddSingleton<IGlossaryRecheckService, GlossaryRecheckService>();
            services.AddSingleton<IGlossaryChangeNotifier, GlossaryChangeNotifier>();
            return services;
        }
    }
}
