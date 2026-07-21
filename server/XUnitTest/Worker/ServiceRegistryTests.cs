using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared.Entities;
using Eurolm.DomainService.Shared.Utilities;
using Eurolm.DomainService.Shared.Events;
using Eurolm.DomainService.Validation;
using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Storage.DomainService.Storage;
using Storage.DomainService.Storage.Validators;
using Worker;
using Worker.Consumers;

namespace XUnitTest
{
    public class ServiceRegistryTests
    {
        [Fact]
        public void RegisterApplicationServices_RegistersExpectedServicesWithExpectedLifetimes()
        {
            var services = new ServiceCollection();
            var localizationSecret = new LocalizationSecret
            {
                ChatGptEncryptedSecret = "encrypted",
                ChatGptEncryptionKey = "key"
            };

            global::Worker.ServiceRegistry.AddEurolmRegisterApplicationServices(services, localizationSecret);

            AssertRegistration<ILocalizationSecret>(services, ServiceLifetime.Singleton, implementationInstance: localizationSecret);

            AssertRegistration<IConsumer<GenerateUilmFilesEvent>, GenerateUilmFilesConsumer>(services, ServiceLifetime.Singleton);
            AssertRegistration<IConsumer<TranslateAllEvent>, TranslateAllEventConsumer>(services, ServiceLifetime.Singleton);
            AssertRegistration<IConsumer<TranslateBlocksLanguageKeyEvent>, TranslateBlocksLanguageKeyEventConsumer>(services, ServiceLifetime.Singleton);
            AssertRegistration<IConsumer<UilmImportEvent>, UilmImportEventConsumer>(services, ServiceLifetime.Singleton);
            AssertRegistration<IConsumer<UilmExportEvent>, UilmExportEventConsumer>(services, ServiceLifetime.Singleton);
            AssertRegistration<IConsumer<EnvironmentDataMigrationEvent>, EuroLMEnvironmentDataMigrationEventConsumer>(services, ServiceLifetime.Singleton);

            AssertRegistration<XlsxOutputGeneratorService, XlsxOutputGeneratorService>(services, ServiceLifetime.Singleton);
            AssertRegistration<JsonOutputGeneratorService, JsonOutputGeneratorService>(services, ServiceLifetime.Singleton);
            AssertRegistration<CsvOutputGeneratorService, CsvOutputGeneratorService>(services, ServiceLifetime.Singleton);
            AssertRegistration<XlfOutputGeneratorService, XlfOutputGeneratorService>(services, ServiceLifetime.Singleton);

            AssertRegistration<IModuleManagementService, ModuleManagementService>(services, ServiceLifetime.Singleton);
            AssertRegistration<IModuleRepository, ModuleRepository>(services, ServiceLifetime.Singleton);
            AssertRegistration<IValidator<Module>, ModuleValidator>(services, ServiceLifetime.Singleton);

            AssertRegistration<ILanguageManagementService, LanguageManagementService>(services, ServiceLifetime.Singleton);
            AssertRegistration<ILanguageRepository, LanguageRepository>(services, ServiceLifetime.Singleton);
            AssertRegistration<IValidator<Language>, LanguageValidator>(services, ServiceLifetime.Singleton);

            AssertRegistration<StorageHelper, StorageHelper>(services, ServiceLifetime.Singleton);

            AssertRegistration<IKeyManagementService, KeyManagementService>(services, ServiceLifetime.Singleton);
            AssertRegistration<IKeyRepository, KeyRepository>(services, ServiceLifetime.Singleton);
            AssertRegistration<IKeyTimelineRepository, KeyTimelineRepository>(services, ServiceLifetime.Singleton);
            AssertRegistration<ILanguageFileGenerationHistoryRepository, LanguageFileGenerationHistoryRepository>(services, ServiceLifetime.Singleton);
            AssertRegistration<IValidator<Key>, KeyValidator>(services, ServiceLifetime.Singleton);
            AssertRegistration<IValidator<TranslateBlocksLanguageKeyRequest>, TranslateBlocksLanguageKeyRequestValidator>(services, ServiceLifetime.Singleton);
            AssertRegistration<IEnvironmentDataMigrationRepository, EnvironmentDataMigrationRepository>(services, ServiceLifetime.Singleton);

            AssertRegistration<IAssistantService, AssistantService>(services, ServiceLifetime.Singleton);

            AssertRegistration<IGlossaryManagementService, GlossaryManagementService>(services, ServiceLifetime.Singleton);
            AssertRegistration<IGlossaryRepository, GlossaryRepository>(services, ServiceLifetime.Singleton);
            AssertRegistration<IValidator<Glossary>, GlossaryValidator>(services, ServiceLifetime.Singleton);

            AssertRegistration<IValidator<UpdateFileRequest>, UpdateFileRequestValidator>(services, ServiceLifetime.Transient);

            AssertRegistration<INotificationService, NotificationService>(services, ServiceLifetime.Singleton);
            AssertRegistration<IHttpHelperServices, HttpHelperServices>(services, ServiceLifetime.Singleton);
            AssertRegistration<IWebHookService, WebHookService>(services, ServiceLifetime.Singleton);
            AssertRegistration<IBlocksWebhookRepository, BlocksWebhookRepository>(services, ServiceLifetime.Singleton);
        }

        private static void AssertRegistration<TService, TImplementation>(
            IServiceCollection services,
            ServiceLifetime expectedLifetime)
        {
            var descriptor = services.FirstOrDefault(d =>
                d.ServiceType == typeof(TService) &&
                d.ImplementationType == typeof(TImplementation));

            descriptor.Should().NotBeNull($"{typeof(TService).Name} should be registered with {typeof(TImplementation).Name}");
            descriptor!.Lifetime.Should().Be(expectedLifetime);
        }

        private static void AssertRegistration<TService>(
            IServiceCollection services,
            ServiceLifetime expectedLifetime,
            object implementationInstance)
        {
            var descriptor = services.FirstOrDefault(d =>
                d.ServiceType == typeof(TService) &&
                d.ImplementationInstance == implementationInstance);

            descriptor.Should().NotBeNull($"{typeof(TService).Name} should be registered with provided instance");
            descriptor!.Lifetime.Should().Be(expectedLifetime);
        }
    }
}
