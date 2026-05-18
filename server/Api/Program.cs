using BlocksTemplate.Api;
using Blocks.Genesis;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Eurolm.DomainService.Shared;
using Eurolm.DomainService.Utilities;

var serviceName = Constants.ServiceName;
//var vaultType = ResolveVaultType();
//Console.WriteLine($"Using Genesis vault type: {vaultType}");
var secret = await ApplicationConfigurations.ConfigureLogAndSecretsAsync(serviceName, VaultType.Azure);
var builder = WebApplication.CreateBuilder(args);

ApplicationConfigurations.ConfigureApiEnv(builder, args);

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
var localizationSecret = await LocalizationSecret.ProcessBlocksSecret(VaultType.Azure);

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
// if (File.Exists(indexHtml))
// {
//     app.MapFallbackToFile("/index.html");
//     // x-blocks-key cookie
// }
if (File.Exists(indexHtml))
{

    app.MapFallback(async context =>
    {
        // var tenantService = context.RequestServices.GetRequiredService<ITenants>();
        // var dbContext = context.RequestServices.GetRequiredService<IDbContextProvider>();
        // var host = context.Request.Host.Value;
        // var tenant = tenantService.GetTenantByApplicationDomain(host);
        // var database = dbContext.GetDatabase(tenant.TenantId);
        // var captcheSetting = await (await database.GetCollection<CaptchaConfiguration>("CaptchaConfigurations").FindAsync(Builders<CaptchaConfiguration>.Filter.Eq(mc => mc.IsEnable, true))).FirstOrDefaultAsync();
        // ApplyFrontendRuntimeSettings(builder.Configuration, wwwrootPath, tenant.TenantId, captcheSetting.CaptchaKey);

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
    //  var envFilePath = Path.Combine(Directory.GetCurrentDirectory(), ".env");
    //var section = configuration.GetSection("FrontendRuntime");
    //var replacements = new Dictionary<string, string?>
    //{
    //    ["__BLOCKS_API_BASE_URL__"] = section["BLOCKS_API_BASE_URL"],
    //    ["__BLOCKS_X_BLOCKS_KEY__"] = section["BLOCKS_X_BLOCKS_KEY"],
    //    ["__BLOCKS_GOOGLE_SITE_KEY__"] = section["BLOCKS_GOOGLE_SITE_KEY"],
    //    ["__BLOCKS_CONSTRUCT_URL__"] = section["BLOCKS_CONSTRUCT_URL"]
    //};

    DotNetEnv.Env.Load();

    var replacements = new Dictionary<string, string?>
    {
        ["__BLOCKS_API_BASE_URL__"] = Environment.GetEnvironmentVariable("BLOCKS_API_BASE_URL"),
        ["__BLOCKS_X_BLOCKS_KEY__"] = Environment.GetEnvironmentVariable("BLOCKS_X_BLOCKS_KEY"),
        ["__BLOCKS_GOOGLE_SITE_KEY__"] = Environment.GetEnvironmentVariable("BLOCKS_GOOGLE_SITE_KEY"),
        ["__BLOCKS_CONSTRUCT_URL__"] = Environment.GetEnvironmentVariable("BLOCKS_CONSTRUCT_URL"),
        ["__BLOCKS_OIDC_CLIENT_ID__"] = Environment.GetEnvironmentVariable("BLOCKS_OIDC_CLIENT_ID"),
        ["__BLOCKS_LOGIC_BASE_URL__"] = Environment.GetEnvironmentVariable("BLOCKS_LOGIC_BASE_URL"),
        ["__BLOCKS_IDP_BASE_URL__"] = Environment.GetEnvironmentVariable("BLOCKS_IDP_BASE_URL"),
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
