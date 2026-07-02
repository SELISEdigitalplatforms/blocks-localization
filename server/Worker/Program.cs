using Blocks.Genesis;
using Eurolm.DomainService.Utilities;
using Worker;
using Worker.Configuration;
using Worker.Consumers;
using SeliseBlocks.ConfigurationDriver;

const string _serviceName = "blocks-localization-worker";

//var vaultType = ResolveVaultType();
//Console.WriteLine($"Using Genesis vault type: {vaultType}");
var secret = await ApplicationConfigurations.ConfigureLogAndSecretsAsync(_serviceName, VaultType.Azure);
var localizationSecret = await LocalizationSecret.ProcessBlocksSecret(VaultType.Azure);
await CreateHostBuilder(args).Build().RunAsync();

IHostBuilder CreateHostBuilder(string[] args) =>
        Host.CreateDefaultBuilder(args)
        .ConfigureAppConfiguration((context, builder) =>
        {
            ApplicationConfigurations.ConfigureWorkerEnv(builder, args);

            // Merge the DB-backed "Secrets" document into configuration (same
            // SecretKey as the Api) so KeyPairs values such as RootTenantId,
            // NotificationServiceUrl and Salt are read from the DB.
            builder.AddMongoDbConfiguration(options =>
            {
                options.ConnectionString = secret.DatabaseConnectionString;
                options.DatabaseName     = secret.RootDatabaseName;
                options.CollectionName   = "Secrets";
                options.SecretKey        = "blocks-secret-localization";
            });
        })
        .ConfigureServices((services) =>
        {
            services.AddHttpClient();

            services.Configure<VerioSystemSettings>(services.BuildServiceProvider().GetRequiredService<IConfiguration>().GetSection("VerioSystemSettings"));

            services.AddHostedService<PeriodicPingBackgroundService>();


            services.AddEurolmRegisterApplicationServices(localizationSecret);
            ApplicationConfigurations.ConfigureWorker(services, Constants.GetMessageConfiguration(secret.MessageConnectionString));
            //ApplicationConfigurations.ConfigureWorker(services, IdentifierConstants.GetMessageConfiguration(secret.MessageConnectionString));
        });

static VaultType ResolveVaultType()
{
    var configuredVaultType = Environment.GetEnvironmentVariable("BLOCKS_VAULT_TYPE");
    if (!string.IsNullOrWhiteSpace(configuredVaultType) &&
        Enum.TryParse<VaultType>(configuredVaultType, true, out var parsedVaultType))
    {
        return parsedVaultType;
    }

    var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ??
                      Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");

    return string.Equals(environment, "Development", StringComparison.OrdinalIgnoreCase)
        ? VaultType.OnPrem
        : VaultType.Azure;
}
