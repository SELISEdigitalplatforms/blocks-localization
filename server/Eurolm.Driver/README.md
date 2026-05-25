# SeliseBlocks.EurolmDriver

Blocks Eurolm Driver provides access to Eurolm language management features as a NuGet package.

## Usage

Register the services in your `Program.cs` or service configuration:

```csharp
services.RegisterBlocksEurolmServices();
```

Then inject `IEurolmDriverService` and call `GetLanguagesAsync()`:

```csharp
public class MyService
{
    private readonly IEurolmDriverService _eurolmDriverService;

    public MyService(IEurolmDriverService eurolmDriverService)
    {
        _eurolmDriverService = eurolmDriverService;
    }

    public async Task<List<Language>> GetLanguages()
    {
        return await _eurolmDriverService.GetLanguagesAsync();
    }
}
```
