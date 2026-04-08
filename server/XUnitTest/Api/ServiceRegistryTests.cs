using BlocksTemplate.Api;
using BlocksTemplate.DomainService;
using Blocks.Genesis;
using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Services.HelperService;
using BlocksTemplate.DomainService.Shared.Entities;
using BlocksTemplate.DomainService.Validation;
using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Storage.DomainService.Storage;
using Storage.DomainService.Storage.Validators;

namespace BlocksTemplate.XUnitTest
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

            services.AddDomainServices(localizationSecret);

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
            AssertRegistration<IKeyTimelineRepository, KeyTimelineRepository>(services, ServiceLifetime.Singleton);
            AssertRegistration<ILanguageFileGenerationHistoryRepository, LanguageFileGenerationHistoryRepository>(services, ServiceLifetime.Singleton);
            AssertRegistration<IValidator<Key>, KeyValidator>(services, ServiceLifetime.Singleton);
            AssertRegistration<IValidator<TranslateBlocksLanguageKeyRequest>, TranslateBlocksLanguageKeyRequestValidator>(services, ServiceLifetime.Singleton);

            AssertRegistration<IValidator<UpdateFileRequest>, UpdateFileRequestValidator>(services, ServiceLifetime.Transient);

            AssertRegistration<IAssistantService, AssistantService>(services, ServiceLifetime.Singleton);

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
