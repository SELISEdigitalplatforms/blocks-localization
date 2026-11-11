using Blocks.Extension.DependencyInjection;
using Blocks.Secrets;
using DomainService.Storage;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Repositories.UilmStorage;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Services.UilmStorage;
using Eurolm.DomainService.Shared.Entities;
using Eurolm.DomainService.Validation;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Storage.DomainService.Services;
using Storage.DomainService.Storage;
using Storage.DomainService.Storage.Validators;
using System;
using System.Collections.Generic;
using System.Text;

namespace Eurolm.DomainService.Shared
{
    public static class ServiceRegistry
    {
        public static void AddEurolmRegisterApplicationServices(this IServiceCollection services, ILocalizationSecret localizationSecret)
        {
            services.AddSingleton<ILocalizationSecret>(localizationSecret);

            services.AddSingleton<IModuleManagementService, ModuleManagementService>();
            services.AddSingleton<IModuleRepository, ModuleRepository>();
            services.AddSingleton<IValidator<Module>, ModuleValidator>();

            services.AddSingleton<ILanguageManagementService, LanguageManagementService>();
            services.AddSingleton<ILanguageRepository, LanguageRepository>();
            services.AddSingleton<IValidator<Language>, LanguageValidator>();

            services.AddSingleton<StorageHelper>();

            services.AddTransient<IValidator<UpdateFileRequest>, UpdateFileRequestValidator>();

            services.AddSingleton<IKeyManagementService, KeyManagementService>();
            services.AddSingleton<IKeyRepository, KeyRepository>();
            services.AddSingleton<ILocalizationUniquenessRepository, LocalizationUniquenessRepository>();
            services.AddSingleton<IKeyTimelineRepository, KeyTimelineRepository>();
            services.AddSingleton<ILanguageFileGenerationHistoryRepository, LanguageFileGenerationHistoryRepository>();
            services.AddSingleton<IValidator<Key>, KeyValidator>();
            services.AddSingleton<IValidator<TranslateBlocksLanguageKeyRequest>, TranslateBlocksLanguageKeyRequestValidator>();
            services.AddSingleton<IValidator<TranslateBlocksLanguageKeysRequest>, TranslateBlocksLanguageKeysRequestValidator>();
            services.AddSingleton<IValidator<GetKeysRequest>, GetKeysRequestValidator>();
            services.AddSingleton<IValidator<DeleteKeysRequest>, DeleteKeysRequestValidator>();

            // UILM files in Storage (#348): options with code defaults, the ledger/settings/counter repositories,
            // the publisher (worker), the reader with its own size-limited cache (API) and maintenance.
            services.AddSingleton(sp => new UilmStorageInfrastructure(
                new UilmStorageOptions(), sp.GetRequiredService<IHttpClientFactory>(), TimeProvider.System));
            services.AddSingleton<IUilmStoredFileRepository, UilmStoredFileRepository>();
            services.AddSingleton<IUilmStorageSettingsRepository, UilmStorageSettingsRepository>();
            services.AddSingleton<IUilmPublishCounterRepository, UilmPublishCounterRepository>();
            services.AddSingleton<IUilmFilePublisher, UilmFilePublisher>();
            services.AddSingleton<IUilmFileReader, UilmFileReader>();
            services.AddSingleton<IUilmMaintenanceService, UilmMaintenanceService>();
            services.AddSingleton<IUilmMaintenanceQueue, UilmMaintenanceQueue>();
            services.AddHttpClient(UilmStorageHttp.ClientName);

            services.AddBlocksSecrets();
            services.RegisterBlocksStorageServices();

            services.AddTransient<IValidator<UpdateFileRequest>, UpdateFileRequestValidator>();

            services.AddAssistantService();

            services.AddSingleton<INotificationService, NotificationService>();
            services.AddSingleton<IHttpHelperServices, HttpHelperServices>();
            services.AddSingleton<IWebHookService, WebHookService>();
            services.AddSingleton<IBlocksWebhookRepository, BlocksWebhookRepository>();

            services.AddSingleton<IGlossaryManagementService, GlossaryManagementService>();
            services.AddSingleton<IGlossaryRepository, GlossaryRepository>();
            services.AddSingleton<IValidator<Glossary>, GlossaryValidator>();
            services.AddSingleton<IGlossaryMigrationService, GlossaryMigrationService>();
            services.AddGlossaryTerminology();


        }
    }
}
