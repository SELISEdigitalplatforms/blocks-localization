using Blocks.Genesis;
using BlocksTemplate.DomainService.Utilities;
using Worker;

const string _serviceName = "blocks-localization-worker";

var secret = await ApplicationConfigurations.ConfigureLogAndSecretsAsync(_serviceName, VaultType.Azure);

var localizationSecret = await LocalizationSecret.ProcessBlocksSecret(VaultType.Azure);

await CreateHostBuilder(args).Build().RunAsync();

IHostBuilder CreateHostBuilder(string[] args) =>
        Host.CreateDefaultBuilder(args)
        .ConfigureAppConfiguration((context, builder) =>
        {
            ApplicationConfigurations.ConfigureWorkerEnv(builder, args);
        })
        .ConfigureServices((services) =>
        {
            services.AddHttpClient();
            services.RegisterApplicationServices(localizationSecret);
            ApplicationConfigurations.ConfigureWorker(services, Constants.GetMessageConfiguration(secret.MessageConnectionString));
        });