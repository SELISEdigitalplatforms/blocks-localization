using BlocksTemplate.Api;
using BlocksTemplate.DomainService;
using Blocks.Genesis;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;

var serviceName = "blocks-template-api";
var secret = await ApplicationConfigurations.ConfigureLogAndSecretsAsync(serviceName, VaultType.Azure);
var builder = WebApplication.CreateBuilder(args);


ApplicationConfigurations.ConfigureApiEnv(builder, args);

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 15 * 1024 * 1024; // 15 MB
});

var services = builder.Services;

services.AddHealthChecks();

builder.Services.AddDomainServices();
builder.Services.AddFluentValidationAutoValidation();
ApplicationConfigurations.ConfigureServices(services, new MessageConfiguration { });
ApplicationConfigurations.ConfigureApi(services);

builder.Services.Configure<MvcOptions>(options =>
{
    options.Conventions.Insert(0, new GlobalApiRoutePrefixConvention("api"));
});

var wwwrootPath = Path.Combine(builder.Environment.ContentRootPath, "wwwroot");
Directory.CreateDirectory(wwwrootPath);

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

var indexHtml = Path.Combine(app.Environment.WebRootPath ?? "", "index.html");
if (File.Exists(indexHtml))
{
    app.MapFallbackToFile("/index.html");
}

ApplicationConfigurations.ConfigureMiddleware(app);

await app.RunAsync();
