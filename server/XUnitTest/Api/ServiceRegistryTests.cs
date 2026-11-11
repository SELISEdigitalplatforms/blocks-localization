using BlocksTemplate.Api;
using Blocks.Genesis;

using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Storage.DomainService.Storage;
using Storage.DomainService.Storage.Validators;
using Worker;
using Eurolm.DomainService.Shared.Entities;
using Eurolm.DomainService.Shared.Utilities;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Validation;
using Eurolm.DomainService.Repositories.UilmStorage;
using Eurolm.DomainService.Services.UilmStorage;

namespace XUnitTest
{
    public class ApiServiceRegistryTests
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

            Eurolm.DomainService.Shared.ServiceRegistry.AddEurolmRegisterApplicationServices(services, localizationSecret);

            AssertRegistration<ILocalizationSecret>(services, ServiceLifetime.Singleton, implementationInstance: localizationSecret);

            AssertRegistration<IModuleManagementService, ModuleManagementService>(services, ServiceLifetime.Singleton);
            AssertRegistration<IModuleRepository, ModuleRepository>(services, ServiceLifetime.Singleton);
            AssertRegistration<IValidator<Module>, ModuleValidator>(services, ServiceLifetime.Singleton);

            AssertRegistration<ILanguageManagementService, LanguageManagementService>(services, ServiceLifetime.Singleton);
            AssertRegistration<ILanguageRepository, LanguageRepository>(services, ServiceLifetime.Singleton);
            AssertRegistration<IValidator<Language>, LanguageValidator>(services, ServiceLifetime.Singleton);

            AssertRegistration<StorageHelper, StorageHelper>(services, ServiceLifetime.Singleton);

            AssertRegistration<IKeyManagementService, KeyManagementService>(services, ServiceLifetime.Singleton);
            AssertRegistration<IKeyRepository, KeyRepository>(services, ServiceLifetime.Singleton);
            AssertRegistration<ILocalizationUniquenessRepository, LocalizationUniquenessRepository>(services, ServiceLifetime.Singleton);
            AssertRegistration<IKeyTimelineRepository, KeyTimelineRepository>(services, ServiceLifetime.Singleton);
            AssertRegistration<ILanguageFileGenerationHistoryRepository, LanguageFileGenerationHistoryRepository>(services, ServiceLifetime.Singleton);
            AssertRegistration<IValidator<Key>, KeyValidator>(services, ServiceLifetime.Singleton);
            AssertRegistration<IValidator<TranslateBlocksLanguageKeyRequest>, TranslateBlocksLanguageKeyRequestValidator>(services, ServiceLifetime.Singleton);

            AssertRegistration<IValidator<UpdateFileRequest>, UpdateFileRequestValidator>(services, ServiceLifetime.Transient);

            // Built by a factory so it gets the named Azure OpenAI client (AddAssistantService).
            services.Should().ContainSingle(d => d.ServiceType == typeof(IAssistantService) && d.ImplementationFactory != null && d.Lifetime == ServiceLifetime.Singleton);

            AssertRegistration<INotificationService, NotificationService>(services, ServiceLifetime.Singleton);
            AssertRegistration<IHttpHelperServices, HttpHelperServices>(services, ServiceLifetime.Singleton);
            AssertRegistration<IWebHookService, WebHookService>(services, ServiceLifetime.Singleton);
            AssertRegistration<IBlocksWebhookRepository, BlocksWebhookRepository>(services, ServiceLifetime.Singleton);

            // UILM files in Storage (#348)
            services.Should().ContainSingle(d => d.ServiceType == typeof(UilmStorageOptions) && d.ImplementationInstance != null);
            AssertRegistration<IUilmStoredFileRepository, UilmStoredFileRepository>(services, ServiceLifetime.Singleton);
            AssertRegistration<IUilmStorageSettingsRepository, UilmStorageSettingsRepository>(services, ServiceLifetime.Singleton);
            AssertRegistration<IUilmPublishCounterRepository, UilmPublishCounterRepository>(services, ServiceLifetime.Singleton);
            AssertRegistration<IUilmFilePublisher, UilmFilePublisher>(services, ServiceLifetime.Singleton);
            AssertRegistration<IUilmFileReader, UilmFileReader>(services, ServiceLifetime.Singleton);
            AssertRegistration<IUilmMaintenanceService, UilmMaintenanceService>(services, ServiceLifetime.Singleton);
            services.Should().Contain(d => d.ServiceType == typeof(IHttpClientFactory));
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
