using Blocks.Extension.DependencyInjection;
using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Services.HelperService;
using BlocksTemplate.DomainService.Shared.Entities;
using BlocksTemplate.DomainService.Validation;
using DomainService.Storage;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Storage.DomainService.Shared.Services;
using Storage.DomainService.Storage;
using Storage.DomainService.Storage.Validators;


namespace BlocksTemplate.DomainService;

public static class ServiceRegistry
{
    public static IServiceCollection AddDomainServices(this IServiceCollection services, ILocalizationSecret localizationSecret)
    {
        services.AddSingleton<ILocalizationSecret>(localizationSecret);

        // Module
        services.AddSingleton<IModuleManagementService, ModuleManagementService>();
        services.AddSingleton<IModuleRepository, ModuleRepository>();
        services.AddSingleton<IValidator<Module>, ModuleValidator>();

        // Language
        services.AddSingleton<ILanguageManagementService, LanguageManagementService>();
        services.AddSingleton<ILanguageRepository, LanguageRepository>();
        services.AddSingleton<IValidator<Language>, LanguageValidator>();

        // Key
        services.AddSingleton<IKeyManagementService, KeyManagementService>();
        services.AddSingleton<IKeyRepository, KeyRepository>();
        services.AddSingleton<IKeyTimelineRepository, KeyTimelineRepository>();
        services.AddSingleton<ILanguageFileGenerationHistoryRepository, LanguageFileGenerationHistoryRepository>();
        services.AddSingleton<IValidator<Key>, KeyValidator>();
        services.AddSingleton<IValidator<TranslateBlocksLanguageKeyRequest>, TranslateBlocksLanguageKeyRequestValidator>();

        // Helper Services
        services.AddSingleton<StorageHelper>();
        services.AddSingleton<IAssistantService, AssistantService>();
        services.AddSingleton<INotificationService, NotificationService>();
        services.AddSingleton<IHttpHelperServices, HttpHelperServices>();
        services.AddSingleton<IWebHookService, WebHookService>();
        services.AddSingleton<IBlocksWebhookRepository, BlocksWebhookRepository>();




        services.AddSingleton<DmsArtifactBuilderFactory>();
        services.AddTransient<IValidator<UpdateFileRequest>, UpdateFileRequestValidator>();
        services.AddTransient<AwsS3CompatibleStorageService>();
        services.AddSingleton<FileArtifactBuilder>();
        services.AddSingleton<FolderArtifactBuilder>();

        services.RegisterBlocksStorageServices();
        services.AddTransient<IValidator<UpdateFileRequest>, UpdateFileRequestValidator>();
        services.AddSingleton<IEventService, EventService>();
        services.AddValidatorsFromAssembly(typeof(IEventService).Assembly);


        return services;
    }
}
