using Api;
using Blocks.Genesis;
using BlocksTemplate.DomainService.Utilities;

const string _serviceName = "blocks-localization-api";
var blocksSecret = await ApplicationConfigurations.ConfigureLogAndSecretsAsync(_serviceName, VaultType.Azure);
var builder = WebApplication.CreateBuilder(args);

ApplicationConfigurations.ConfigureApiEnv(builder, args);
var services = builder.Services;
var localizationSecret = await LocalizationSecret.ProcessBlocksSecret(VaultType.Azure);

services.AddHealthChecks();
builder.Services.RegisterApplicationServices(localizationSecret);
ApplicationConfigurations.ConfigureServices(services, Constants.GetMessageConfiguration(blocksSecret.MessageConnectionString));
ApplicationConfigurations.ConfigureApi(services);

var app = builder.Build();
ApplicationConfigurations.ConfigureMiddleware(app);
await app.RunAsync();
