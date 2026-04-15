using Blocks.Extension.DependencyInjection;
using Blocks.Genesis;
using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Services.HelperService;
using BlocksTemplate.DomainService.Shared.Entities;
using BlocksTemplate.DomainService.Shared.Events;
using DomainService.Storage;
using BlocksTemplate.DomainService.Validation;
using FluentValidation;
using Storage.DomainService.Shared.Services;
using Storage.DomainService.Storage;
using Storage.DomainService.Storage.Validators;
using Worker.Consumers;


namespace Worker
{
    public static class ServiceRegistry
    {
        public static void RegisterApplicationServices(this IServiceCollection services, ILocalizationSecret localizationSecret)
        {
            services.AddSingleton<ILocalizationSecret>(localizationSecret);
            services.AddSingleton<IConsumer<GenerateUilmFilesEvent>, GenerateUilmFilesConsumer>();
            services.AddSingleton<IConsumer<TranslateAllEvent>, TranslateAllEventConsumer>();
            services.AddSingleton<IConsumer<TranslateBlocksLanguageKeyEvent>, TranslateBlocksLanguageKeyEventConsumer>();
            services.AddSingleton<IConsumer<UilmImportEvent>, UilmImportEventConsumer>();
            services.AddSingleton<IConsumer<UilmExportEvent>, UilmExportEventConsumer>();
            services.AddSingleton<IConsumer<EnvironmentDataMigrationEvent>, EnvironmentDataMigrationEventConsumer>();

            services.AddSingleton<XlsxOutputGeneratorService>();
            services.AddSingleton<JsonOutputGeneratorService>();
            services.AddSingleton<CsvOutputGeneratorService>();
            services.AddSingleton<XlfOutputGeneratorService>();

            services.AddSingleton<IModuleManagementService, ModuleManagementService>();
            services.AddSingleton<IModuleRepository, ModuleRepository>();
            services.AddSingleton<IValidator<Module>, ModuleValidator>();

            services.AddSingleton<ILanguageManagementService, LanguageManagementService>();
            services.AddSingleton<ILanguageRepository, LanguageRepository>();
            services.AddSingleton<IValidator<Language>, LanguageValidator>();
            
            services.AddSingleton<StorageHelper>();

            services.AddSingleton<IKeyManagementService, KeyManagementService>();
            services.AddSingleton<IKeyRepository, KeyRepository>();
            services.AddSingleton<IKeyTimelineRepository, KeyTimelineRepository>();
            services.AddSingleton<ILanguageFileGenerationHistoryRepository, LanguageFileGenerationHistoryRepository>();
            services.AddSingleton<IValidator<Key>, KeyValidator>();
            services.AddSingleton<IValidator<TranslateBlocksLanguageKeyRequest>, TranslateBlocksLanguageKeyRequestValidator>();
            services.AddSingleton<IEnvironmentDataMigrationRepository, EnvironmentDataMigrationRepository>();

            services.AddSingleton<IAssistantService, AssistantService>();

            services.AddSingleton<IGlossaryManagementService, GlossaryManagementService>();
            services.AddSingleton<IGlossaryRepository, GlossaryRepository>();
            services.AddSingleton<IValidator<Glossary>, GlossaryValidator>();

            services.RegisterBlocksStorageServices();
            services.AddSingleton<DmsArtifactBuilderFactory>();
            services.AddTransient<IValidator<UpdateFileRequest>, UpdateFileRequestValidator>();
            services.AddTransient<AwsS3CompatibleStorageService>();
            services.AddSingleton<FileArtifactBuilder>();
            services.AddSingleton<FolderArtifactBuilder>();
            
            services.AddSingleton<INotificationService, NotificationService>();
            services.AddSingleton<IHttpHelperServices, HttpHelperServices>();
            services.AddSingleton<IWebHookService, WebHookService>();
            services.AddSingleton<IBlocksWebhookRepository, BlocksWebhookRepository>();
        }
    }
}
