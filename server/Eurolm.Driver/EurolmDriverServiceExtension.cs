using Blocks.EurolmDriver;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Validation;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace Blocks.Extensions.DependencyInjection;

public static class EurolmDriverServiceExtension
{
    public static void RegisterBlocksEurolmServices(this IServiceCollection services)
    {
        services.AddSingleton<IEurolmDriverService, EurolmDriverService>();
        services.AddSingleton<ILanguageManagementService, LanguageManagementService>();
        services.AddSingleton<ILanguageRepository, LanguageRepository>();
        services.AddTransient<IValidator<Language>, LanguageValidator>();
    }
}
