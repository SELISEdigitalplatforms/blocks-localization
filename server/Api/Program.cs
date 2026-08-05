using BlocksTemplate.Api;
using Blocks.Genesis;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Eurolm.DomainService.Shared;
using Eurolm.DomainService.Shared.Utilities;
using Eurolm.DomainService.Utilities;
using SeliseBlocks.ConfigurationDriver;

var serviceName = Constants.ServiceName;
var vaultType = ApplicationConfigurations.ResolveVaultType();
Console.WriteLine($"Using Genesis vault type: {vaultType}");
var secret = await ApplicationConfigurations.ConfigureLogAndSecretsAsync(serviceName, vaultType);
var builder = WebApplication.CreateBuilder(args);

ApplicationConfigurations.ConfigureApiEnv(builder, args);

// Load frontend runtime settings (and other config) from the DB. The Mongo
// "Secrets" document keyed by "blocks-secret-localization" is merged into
// IConfiguration, exposing the "FrontendRuntime" section consumed below.
builder.Configuration.AddMongoDbConfiguration(options =>
{
    options.ConnectionString = secret.DatabaseConnectionString;
    options.DatabaseName     = secret.RootDatabaseName;
    options.CollectionName   = "Secrets";
    options.SecretKey        = "blocks-secret-localization";
});

ApplicationConfigurations.ConfigureServices(builder.Services, Constants.GetMessageConfiguration(secret.MessageConnectionString));

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 15 * 1024 * 1024; // 15 MB
});

var services = builder.Services;

services.AddHealthChecks();



var wwwrootPath = Path.Combine(builder.Environment.ContentRootPath, "wwwroot");
Directory.CreateDirectory(wwwrootPath);

ApplyFrontendRuntimeSettings(builder.Configuration, wwwrootPath);
var localizationSecret = await LocalizationSecret.ProcessBlocksSecret(vaultType);

ApplicationConfigurations.ConfigureApi(services, serviceName);

builder.Services.Configure<MvcOptions>(options =>
{
    options.Conventions.Insert(0, new GlobalApiRoutePrefixConvention("api"));
});
services.AddEurolmRegisterApplicationServices(localizationSecret);

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();
var indexHtml = Path.Combine(app.Environment.WebRootPath ?? "", "index.html");
if (File.Exists(indexHtml))
{

    app.MapFallback(async context =>
    {

        //context.Response.Cookies.Append("x-blocks-key", tenant.TenantId, new CookieOptions
        //{
        //    Domain = tenant.CookieDomain,
        //    HttpOnly = true,
        //    Secure = true,
        //    SameSite = SameSiteMode.None,
        //    Path = "/"
        //});
        context.Response.ContentType = "text/html; charset=utf-8";
        await context.Response.SendFileAsync(indexHtml);

    });

    // x-blocks-key cookie
    // check if domain match
    // get google captch key BLOCKS_GOOGLE_SITE_KEY
    // Base Url
    // Construct URL

}


ApplicationConfigurations.ConfigureMiddleware(app);
await app.RunAsync();

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

static void ApplyFrontendRuntimeSettings(IConfiguration configuration, string webRootPath)
{
    // Read frontend runtime values from the DB-backed "FrontendRuntime" config
    // section (populated by AddMongoDbConfiguration from the "Secrets" collection).
    // Standard .NET config layering still applies, so env vars named
    // "FrontendRuntime__BLOCKS_*" override individual keys at deploy time.
    var section = configuration.GetSection("FrontendRuntime");
    var replacements = new Dictionary<string, string?>
    {
        ["__BLOCKS_PUBLIC_API_BASE_URL__"] = section["BLOCKS_PUBLIC_API_BASE_URL"],
        ["__BLOCKS_LOCALIZATION_BASE_URL__"] = section["BLOCKS_LOCALIZATION_BASE_URL"],
        ["__BLOCKS_LOCALIZATION_CALLBACK_URL__"] = section["BLOCKS_LOCALIZATION_CALLBACK_URL"],
        ["__BLOCKS_LOCALIZATION_CLIENT_ID__"] = section["BLOCKS_LOCALIZATION_CLIENT_ID"],
        ["__BLOCKS_X_BLOCKS_KEY__"] = section["BLOCKS_X_BLOCKS_KEY"],
        ["__BLOCKS_GOOGLE_SITE_KEY__"] = section["BLOCKS_GOOGLE_SITE_KEY"],
        ["__BLOCKS_CONSTRUCT_URL__"] = section["BLOCKS_CONSTRUCT_URL"],
        ["__BLOCKS_GITHUB_SSO_CLIENT_ID__"] = section["BLOCKS_GITHUB_SSO_CLIENT_ID"],
        ["__BLOCKS_OIDC_CLIENT_ID__"] = section["BLOCKS_OIDC_CLIENT_ID"],
        ["__BLOCKS_BASE_DOMAIN__"] = section["BLOCKS_BASE_DOMAIN"],
        ["__BLOCKS_IAM_BASE_URL__"] = section["BLOCKS_IAM_BASE_URL"],
        ["__BLOCKS_IAM_CALLBACK_URL__"] = section["BLOCKS_IAM_CALLBACK_URL"],
        ["__BLOCKS_IAM_CLIENT_ID__"] = section["BLOCKS_IAM_CLIENT_ID"],
        ["__BLOCKS_AGENTS_BASE_URL__"] = section["BLOCKS_AGENTS_BASE_URL"],
        ["__BLOCKS_AGENTS_CALLBACK_URL__"] = section["BLOCKS_AGENTS_CALLBACK_URL"],
        ["__BLOCKS_AGENTS_CLIENT_ID__"] = section["BLOCKS_AGENTS_CLIENT_ID"],
        ["__BLOCKS_DATA_BASE_URL__"] = section["BLOCKS_DATA_BASE_URL"],
        ["__BLOCKS_DATA_CALLBACK_URL__"] = section["BLOCKS_DATA_CALLBACK_URL"],
        ["__BLOCKS_DATA_CLIENT_ID__"] = section["BLOCKS_DATA_CLIENT_ID"],
        ["__BLOCKS_OS_BASE_URL__"] = section["BLOCKS_OS_BASE_URL"],
        ["__BLOCKS_OS_CALLBACK_URL__"] = section["BLOCKS_OS_CALLBACK_URL"],
        ["__BLOCKS_OS_CLIENT_ID__"] = section["BLOCKS_OS_CLIENT_ID"],
        ["__BLOCKS_UTILITIES_BASE_URL__"] = section["BLOCKS_UTILITIES_BASE_URL"],
        ["__BLOCKS_UTILITIES_CALLBACK_URL__"] = section["BLOCKS_UTILITIES_CALLBACK_URL"],
        ["__BLOCKS_UTILITIES_CLIENT_ID__"] = section["BLOCKS_UTILITIES_CLIENT_ID"],
        ["__BLOCKS_LOGIC_BASE_URL__"] = section["BLOCKS_LOGIC_BASE_URL"],
        ["__BLOCKS_LOGIC_CALLBACK_URL__"] = section["BLOCKS_LOGIC_CALLBACK_URL"],
        ["__BLOCKS_LOGIC_CLIENT_ID__"] = section["BLOCKS_LOGIC_CLIENT_ID"],
        ["__BLOCKS_MONITOR_BASE_URL__"] = section["BLOCKS_MONITOR_BASE_URL"],
        ["__BLOCKS_MONITOR_CALLBACK_URL__"] = section["BLOCKS_MONITOR_CALLBACK_URL"],
        ["__BLOCKS_MONITOR_CLIENT_ID__"] = section["BLOCKS_MONITOR_CLIENT_ID"],
        ["__BLOCKS_RELEASE_BASE_URL__"] = section["BLOCKS_RELEASE_BASE_URL"],
        ["__BLOCKS_RELEASE_CALLBACK_URL__"] = section["BLOCKS_RELEASE_CALLBACK_URL"],
        ["__BLOCKS_RELEASE_CLIENT_ID__"] = section["BLOCKS_RELEASE_CLIENT_ID"],
        ["__BLOCKS_STUDIO_BASE_URL__"] = section["BLOCKS_STUDIO_BASE_URL"],
        ["__BLOCKS_STUDIO_CALLBACK_URL__"] = section["BLOCKS_STUDIO_CALLBACK_URL"],
        ["__BLOCKS_STUDIO_CLIENT_ID__"] = section["BLOCKS_STUDIO_CLIENT_ID"],
        ["__BLOCKS_ALLOWED_SERVICES__"] = section["BLOCKS_ALLOWED_SERVICES"],

    };

    var files = Directory.EnumerateFiles(webRootPath, "*", SearchOption.AllDirectories)
        .Where(path =>
        {
            var ext = Path.GetExtension(path);
            return ext.Equals(".html", StringComparison.OrdinalIgnoreCase)
                || ext.Equals(".js", StringComparison.OrdinalIgnoreCase)
                || ext.Equals(".css", StringComparison.OrdinalIgnoreCase)
                || ext.Equals(".json", StringComparison.OrdinalIgnoreCase);
        });

    foreach (var filePath in files)
    {
        var content = File.ReadAllText(filePath);
        var updated = content;

        foreach (var (token, value) in replacements)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                updated = updated.Replace(token, value, StringComparison.Ordinal);
            }
        }

        if (!ReferenceEquals(content, updated) && !content.Equals(updated, StringComparison.Ordinal))
        {
            File.WriteAllText(filePath, updated);
        }
    }
}
