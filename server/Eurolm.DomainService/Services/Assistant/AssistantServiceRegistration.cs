using Microsoft.Extensions.DependencyInjection;

namespace Eurolm.DomainService.Services
{
    public static class AssistantServiceRegistration
    {
        /// <summary>
        /// The singleton <see cref="AssistantService"/> with its own Azure OpenAI client, shared by the API and the worker.
        /// The singleton holds one HttpClient for the life of the process, so its handler recycles pooled
        /// connections itself: a connection the Azure load balancer has silently dropped (idle about 4 minutes)
        /// is no longer reused, where a request sent on it would wait with no answer.
        /// </summary>
        public static IServiceCollection AddAssistantService(this IServiceCollection services)
        {
            services.AddHttpClient(AssistantService.HttpClientName)
                .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
                {
                    PooledConnectionLifetime = TimeSpan.FromMinutes(2),
                    PooledConnectionIdleTimeout = TimeSpan.FromSeconds(60)
                });

            services.AddSingleton<IAssistantService>(sp => ActivatorUtilities.CreateInstance<AssistantService>(
                sp, sp.GetRequiredService<IHttpClientFactory>().CreateClient(AssistantService.HttpClientName)));

            return services;
        }
    }
}
