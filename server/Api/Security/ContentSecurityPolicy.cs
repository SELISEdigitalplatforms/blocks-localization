using Microsoft.Extensions.Configuration;

namespace BlocksTemplate.Api.Security;

/// <summary>
/// Builds the SPA's Content-Security-Policy from configuration.
/// <para>
/// Same pattern as blocks-monitor, blocks-data and blocks-logic
/// (<c>server/Api/Security/ContentSecurityPolicy.cs</c>). The origins come from the
/// <c>FrontendRuntime</c> section that fills /runtime-config.js, so the policy follows the
/// environment the host runs in. Anything no runtime key describes goes in <c>Csp:Extra*</c>
/// rather than back into code; the few fixed third parties below keep an environment that has
/// only the <c>FrontendRuntime</c> section working.
/// </para>
/// </summary>
public static class ContentSecurityPolicy
{
    /// <summary>
    /// <c>FrontendRuntime</c> keys holding an origin the SPA makes requests to: the HTTP clients
    /// (client/app/lib/http-client.ts, session-refresh.ts, user-lookup.service.ts) and the
    /// genesis-os shell, which reads the sibling service hosts from the same runtime config.
    /// </summary>
    internal static readonly string[] ConnectOriginKeys =
    [
        "BLOCKS_PUBLIC_API_BASE_URL",
        "BLOCKS_IAM_BASE_URL",
        "BLOCKS_CONSTRUCT_URL",
        "BLOCKS_LOCALIZATION_BASE_URL",
        "BLOCKS_AGENTS_BASE_URL",
        "BLOCKS_DATA_BASE_URL",
        "BLOCKS_UTILITIES_BASE_URL",
        "BLOCKS_LOGIC_BASE_URL",
        "BLOCKS_MONITOR_BASE_URL",
        "BLOCKS_RELEASE_BASE_URL",
        "BLOCKS_STUDIO_BASE_URL",
        "BLOCKS_OS_BASE_URL",
    ];

    /// <summary>
    /// Origins the SPA opens a WebSocket to: the genesis-os notification hub on the Logic host.
    /// A CSP source is scheme-sensitive, so <c>https://host</c> does not permit <c>wss://host</c>.
    /// </summary>
    internal static readonly string[] WebSocketOriginKeys =
    [
        "BLOCKS_LOGIC_BASE_URL",
    ];

    /// <summary>Where a login POST may be sent: the identity host and the portal.</summary>
    internal static readonly string[] FormActionOriginKeys =
    [
        "BLOCKS_IAM_BASE_URL",
        "BLOCKS_OS_BASE_URL",
    ];

    /// <summary>
    /// Used only when <c>Csp:BlobStorageSrc</c> is not set (as in blocks-logic). The language
    /// file import and the reference-file upload of the key export PUT the file to a pre-signed
    /// Azure Blob URL, and profile pictures are served from storage too; the storage account
    /// differs per environment, so an environment without the setting keeps working. Set the
    /// exact account(s) to drop the wildcard.
    /// </summary>
    public const string BlobStorageFallback = "https://*.blob.core.windows.net";

    /// <summary>
    /// The CDN holding the import templates (TEMPLATE_URLS in the import file modal), which the
    /// modal fetches before saving them as a download.
    /// </summary>
    public const string TemplateCdnSource = "https://az-cdn.selise.biz";

    /// <summary>
    /// Error reporting of genesis-os, enabled when <c>BLOCKS_ROLLBAR_CLIENT_TOKEN</c> is set.
    /// </summary>
    public const string RollbarSource = "https://api.rollbar.com";

    /// <summary>
    /// Stands in for the style nonce (see <see cref="StyleNonce"/>): in the policy built at
    /// startup and in the built index.html (meta[name=csp-nonce]). Replaced on every response.
    /// </summary>
    public const string StyleNoncePlaceholder = "__CSP_STYLE_NONCE__";

    /// <summary>The policy for one response, with the placeholder swapped for its nonce.</summary>
    public static string WithStyleNonce(string policy, string nonce)
    {
        ArgumentNullException.ThrowIfNull(policy);
        ArgumentException.ThrowIfNullOrEmpty(nonce);
        return policy.Replace(StyleNoncePlaceholder, nonce, StringComparison.Ordinal);
    }

    /// <summary>The SPA shell for one response, carrying the same nonce as its header.</summary>
    public static string RenderIndex(string indexHtmlTemplate, string nonce)
    {
        ArgumentNullException.ThrowIfNull(indexHtmlTemplate);
        ArgumentException.ThrowIfNullOrEmpty(nonce);
        return indexHtmlTemplate.Replace(StyleNoncePlaceholder, nonce, StringComparison.Ordinal);
    }

    public static string Build(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var runtime = configuration.GetSection("FrontendRuntime");
        var csp = configuration.GetSection("Csp");

        var blobStorage = Normalize(Split(csp["BlobStorageSrc"]));
        IEnumerable<string?> blob = blobStorage.Count > 0 ? blobStorage : [BlobStorageFallback];
        IEnumerable<string?> rollbar = string.IsNullOrWhiteSpace(runtime["BLOCKS_ROLLBAR_CLIENT_TOKEN"])
            ? []
            : [RollbarSource];

        return BuildPolicy(
            connectSrc: Origins(runtime, ConnectOriginKeys)
                .Concat(Origins(runtime, WebSocketOriginKeys).Select(ToWebSocketOrigin))
                .Concat(blob)
                .Concat([TemplateCdnSource])
                .Concat(rollbar)
                .Concat(Split(csp["ExtraConnectSrc"])),
            imgSrc: blob.Concat(Split(csp["ExtraImgSrc"])),
            formAction: Origins(runtime, FormActionOriginKeys).Concat(Split(csp["ExtraFormAction"])));
    }

    /// <summary>The policy itself, separated from configuration so it can be asserted directly.</summary>
    public static string BuildPolicy(
        IEnumerable<string?> connectSrc,
        IEnumerable<string?> imgSrc,
        IEnumerable<string?> formAction)
    {
        var connect = Normalize(connectSrc);
        var img = Normalize(imgSrc);
        var form = Normalize(formAction);

        return string.Join(
            " ",
            "default-src 'self';",
            "script-src 'self';",

            // Styles. <style> elements need the style nonce (StyleNonce). genesis-os (login page,
            // logo loader) and the Radix primitives create them at runtime; /csp-nonce.js stamps
            // the nonce on every <style> made through document.createElement, and the server
            // writes the same nonce into index.html (see WithStyleNonce / RenderIndex). Plain
            // style-src 'self' without the nonce laid the monitor login page out 2789px tall
            // with the button off-screen. Same approach as blocks-monitor (b4f78c8), blocks-iam
            // (66f9b48d), blocks-os#643 and blocks-release (1ae6edc).
            //
            // Style attributes stay allowed through style-src-attr only: components set them,
            // an attribute cannot carry a nonce, and an attribute cannot load a script.
            // script-src stays strict, which is the directive that matters for injection.
            $"style-src 'self' 'nonce-{StyleNoncePlaceholder}';",
            "style-src-attr 'unsafe-inline';",

            $"img-src 'self' data: blob:{Suffix(img)};",
            "font-src 'self' data:;",
            $"connect-src 'self'{Suffix(connect)};",
            "frame-ancestors 'none';",
            "base-uri 'self';",
            "object-src 'none';",
            $"form-action 'self'{Suffix(form)}");
    }

    /// <summary>
    /// Reduce configured values to distinct, sorted origins. The blob fallback is the one
    /// wildcard kept as is (a URI parser rejects <c>*.</c> hosts, and configuration cannot add it).
    /// </summary>
    private static List<string> Normalize(IEnumerable<string?> values) =>
        values
            .Select(value => string.Equals(value, BlobStorageFallback, StringComparison.Ordinal) ? value : ToOrigin(value))
            .Where(origin => origin is not null)
            .Select(origin => origin!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(origin => origin, StringComparer.OrdinalIgnoreCase)
            .ToList();

    private static IEnumerable<string?> Origins(IConfiguration section, IEnumerable<string> keys) =>
        keys.Select(key => section[key]);

    /// <summary>
    /// A CSP source is an origin, so any path, query or trailing slash is dropped. A value that
    /// is not an absolute http(s)/ws(s) URL is ignored rather than emitted verbatim, so a
    /// malformed secret cannot inject a directive.
    /// </summary>
    public static string? ToOrigin(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;

        if (!Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri)) return null;

        if (uri.Scheme != Uri.UriSchemeHttp
            && uri.Scheme != Uri.UriSchemeHttps
            && uri.Scheme != Uri.UriSchemeWs
            && uri.Scheme != Uri.UriSchemeWss) return null;

        return uri.GetLeftPart(UriPartial.Authority);
    }

    /// <summary>
    /// The wss origin a browser uses to open a socket to an https host, or null. Plain http and
    /// ws hosts get no socket allowance: an unencrypted socket would carry the session token and
    /// notification payloads in clear text.
    /// </summary>
    public static string? ToWebSocketOrigin(string? value)
    {
        var origin = ToOrigin(value);
        if (origin is null) return null;

        if (origin.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return "wss://" + origin["https://".Length..];
        if (origin.StartsWith("wss://", StringComparison.OrdinalIgnoreCase))
            return origin;
        return null;
    }

    /// <summary>Space- or comma-separated list, for origins no runtime key describes.</summary>
    public static IEnumerable<string?> Split(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? []
            : value.Split([' ', ',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private static string Suffix(List<string> origins) =>
        origins.Count == 0 ? string.Empty : " " + string.Join(" ", origins);
}
