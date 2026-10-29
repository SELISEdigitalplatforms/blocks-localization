using Microsoft.Extensions.Configuration;

namespace Eurolm.DomainService.Services
{
    /// <summary>The <c>GlossaryEnforcement:Enabled</c> flag (default off) for the server terminology pipeline.</summary>
    public static class GlossaryEnforcement
    {
        public const string EnabledKey = "GlossaryEnforcement:Enabled";

        public static bool IsEnabled(IConfiguration configuration) => configuration.GetValue<bool>(EnabledKey);
    }
}
