using Blocks.Extension.DependencyInjection;
using DomainService.Storage;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared.Entities;
using Eurolm.DomainService.Validation;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Storage.DomainService.Shared.Services;
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
            services.AddSingleton<IValidator<TranslateBlocksLanguageKeysRequest>, TranslateBlocksLanguageKeysRequestValidator>();

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


        }
    }
}
