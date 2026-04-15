using Blocks.Extension.DependencyInjection;
using BlocksTemplate.DomainService;
using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Services.HelperService;
using BlocksTemplate.DomainService.Shared.Entities;
using BlocksTemplate.DomainService.Validation;
using DomainService.Storage;
using FluentValidation;
using Storage.DomainService.Shared.Services;
using Storage.DomainService.Storage;
using Storage.DomainService.Storage.Validators;

namespace Api
{
    /// <summary>
    /// A static class responsible for registering application services and validators.
    /// </summary>

    public static class ServiceRegistry
    {
        /// <summary>
        /// Registers services and validators related to modules, languages, and keys.
        /// </summary>
        /// <param name="services">The collection of services to which dependencies are registered.</param>

        public static void RegisterApplicationServices(this IServiceCollection services, ILocalizationSecret localizationSecret)
        {
            services.AddSingleton<ILocalizationSecret>(localizationSecret);

            services.AddSingleton<IModuleManagementService, ModuleManagementService>();
            services.AddSingleton<IModuleRepository, ModuleRepository>();
            services.AddSingleton<IValidator<Module>, ModuleValidator>();

            services.AddSingleton<ILanguageManagementService, LanguageManagementService>();
            services.AddSingleton<ILanguageRepository, LanguageRepository>();
            services.AddSingleton<IValidator<Language>, LanguageValidator>();

            services.AddSingleton<StorageHelper>();

            services.AddSingleton<DmsArtifactBuilderFactory>();
            services.AddTransient<IValidator<UpdateFileRequest>, UpdateFileRequestValidator>();
            services.AddTransient<AwsS3CompatibleStorageService>();
            services.AddSingleton<FileArtifactBuilder>();
            services.AddSingleton<FolderArtifactBuilder>();

            services.AddSingleton<IKeyManagementService, KeyManagementService>();
            services.AddSingleton<IKeyRepository, KeyRepository>();
            services.AddSingleton<IKeyTimelineRepository, KeyTimelineRepository>();
            services.AddSingleton<ILanguageFileGenerationHistoryRepository, LanguageFileGenerationHistoryRepository>();
            services.AddSingleton<IValidator<Key>, KeyValidator>();
            services.AddSingleton<IValidator<TranslateBlocksLanguageKeyRequest>, TranslateBlocksLanguageKeyRequestValidator>();

            services.RegisterBlocksStorageServices();

            services.AddTransient<IValidator<UpdateFileRequest>, UpdateFileRequestValidator>();

            services.AddSingleton<IAssistantService, AssistantService>();

            services.AddSingleton<INotificationService, NotificationService>();
            services.AddSingleton<IHttpHelperServices, HttpHelperServices>();
            services.AddSingleton<IWebHookService, WebHookService>();
            services.AddSingleton<IBlocksWebhookRepository, BlocksWebhookRepository>();

            services.AddSingleton<IGlossaryManagementService, GlossaryManagementService>();
            services.AddSingleton<IGlossaryRepository, GlossaryRepository>();
            services.AddSingleton<IValidator<Glossary>, GlossaryValidator>();
            services.AddSingleton<IEventService, EventService>();
            services.AddValidatorsFromAssembly(typeof(IEventService).Assembly);


        }
    }
}
