using BlocksTemplate.Api.Security;
using FluentAssertions;
using Microsoft.Extensions.Configuration;

namespace XUnitTest.Api.Security;

/// <summary>
/// The SPA's CSP, ported from blocks-monitor (which took it from blocks-iam). Two things went wrong with the first version of this
/// policy and both are pinned here: the host list was hardcoded to <c>dev-*</c> (stg and prod
/// could not reach their own IAM), and <c>style-src 'self'</c> blocked the inline styles the
/// login page and UI libraries inject at runtime. Those <c>&lt;style&gt;</c> elements now carry the
/// per-response style nonce instead of relying on 'unsafe-inline'.
/// </summary>
public class ContentSecurityPolicyTests
{
    private static IConfiguration Config(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();

    // ---------- Origins follow configuration, not the code ----------

    [Fact]
    public void Build_UsesTheConfiguredEnvironmentsHosts()
    {
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["FrontendRuntime:BLOCKS_IAM_BASE_URL"] = "https://iam.example.com",
            ["FrontendRuntime:BLOCKS_OS_BASE_URL"] = "https://os.example.com",
            ["FrontendRuntime:BLOCKS_DATA_BASE_URL"] = "https://data.example.com",
        }));

        policy.Should().Contain("https://iam.example.com");
        policy.Should().Contain("https://os.example.com");
        policy.Should().Contain("https://data.example.com");
    }

    [Fact]
    public void Build_NamesNoEnvironmentItWasNotConfiguredWith()
    {
        // The regression this class exists for. A hardcoded dev host list meant the policy
        // was right on dev and would have stopped the SPA reaching its own API on stg/prod.
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["FrontendRuntime:BLOCKS_IAM_BASE_URL"] = "https://stg-iam.blocksdevelopers.com",
            ["FrontendRuntime:BLOCKS_OS_BASE_URL"] = "https://stg-os.blocksdevelopers.com",
        }));

        policy.Should().NotContain("dev-iam.blocksdevelopers.com");
        policy.Should().NotContain("dev-os.blocksdevelopers.com");
    }

    [Fact]
    public void Build_FormActionIsTheIdentityHostAndThePortal()
    {
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["FrontendRuntime:BLOCKS_IAM_BASE_URL"] = "https://iam.example.com",
            ["FrontendRuntime:BLOCKS_OS_BASE_URL"] = "https://os.example.com",
            ["FrontendRuntime:BLOCKS_DATA_BASE_URL"] = "https://data.example.com",
        }));

        var formAction = Directive(policy, "form-action");
        formAction.Should().Contain("https://iam.example.com");
        formAction.Should().Contain("https://os.example.com");
        formAction.Should().NotContain("https://data.example.com");
    }

    // ---------- WebSockets need their own scheme ----------

    [Fact]
    public void Build_EmitsTheWebSocketFormOfTheLogicHost()
    {
        // A CSP source is scheme-sensitive: https://host does not permit wss://host, which is
        // why the hardcoded policy listed wss://dev-logic separately.
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["FrontendRuntime:BLOCKS_LOGIC_BASE_URL"] = "https://logic.example.com",
        }));

        var connect = Directive(policy, "connect-src");
        connect.Should().Contain("https://logic.example.com");
        connect.Should().Contain("wss://logic.example.com");
    }

    [Theory]
    [InlineData("https://logic.example.com/hub", "wss://logic.example.com")]
    [InlineData("wss://logic.example.com", "wss://logic.example.com")]
    [InlineData("http://logic.example.com", null)]
    [InlineData("not-a-url", null)]
    [InlineData("", null)]
    public void ToWebSocketOrigin_OnlyAllowsEncryptedSockets(string value, string? expected)
    {
        ContentSecurityPolicy.ToWebSocketOrigin(value).Should().Be(expected);
    }

    // The unencrypted socket origin, built from the scheme constant so the test reads the same
    // value the policy would have emitted before plain sockets were dropped.
    private static readonly string PlainSocketOrigin =
        new UriBuilder(Uri.UriSchemeWs, "logic.example.com").Uri.GetLeftPart(UriPartial.Authority);

    [Fact]
    public void ToWebSocketOrigin_RefusesAPlainSocketOrigin()
    {
        ContentSecurityPolicy.ToWebSocketOrigin(PlainSocketOrigin).Should().BeNull();
    }

    [Fact]
    public void Build_GivesAPlainHttpLogicHostNoSocketAllowance()
    {
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["FrontendRuntime:BLOCKS_LOGIC_BASE_URL"] = "http://logic.example.com",
        }));

        Directive(policy, "connect-src").Should().NotContain(PlainSocketOrigin);
    }

    // ---------- Third-party origins the runtime config cannot describe ----------

    [Fact]
    public void Build_AppendsConfiguredExtraOrigins()
    {
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["Csp:ExtraConnectSrc"] = "https://api.rollbar.com https://code.selise.biz",
            ["Csp:ExtraImgSrc"] = "https://cdn.example.com",
        }));

        Directive(policy, "connect-src").Should().Contain("https://api.rollbar.com");
        Directive(policy, "connect-src").Should().Contain("https://code.selise.biz");
        Directive(policy, "img-src").Should().Contain("https://cdn.example.com");
    }

    // ---------- Directives that must not drift ----------

    [Fact]
    public void Build_AllowsStyleElementsOnlyWithTheNonceAndBlocksInlineScripts()
    {
        // ZAP 10055 (CSP: style-src unsafe-inline): <style> elements need the nonce; style
        // attributes stay allowed through style-src-attr only.
        var policy = ContentSecurityPolicy.Build(Config([]));

        Directive(policy, "style-src").Should().Be($" 'self' 'nonce-{ContentSecurityPolicy.StyleNoncePlaceholder}'");
        Directive(policy, "style-src").Should().NotContain("'unsafe-inline'");
        Directive(policy, "style-src-attr").Should().Be(" 'unsafe-inline'");
        Directive(policy, "script-src").Should().NotContain("'unsafe-inline'");
        Directive(policy, "script-src").Should().NotContain("'unsafe-eval'");
    }

    [Fact]
    public void WithStyleNonce_ReplacesThePlaceholderOnly()
    {
        var policy = ContentSecurityPolicy.BuildPolicy([], [], []);

        var withNonce = ContentSecurityPolicy.WithStyleNonce(policy, "abc123==");

        Directive(withNonce, "style-src").Should().Be(" 'self' 'nonce-abc123=='");
        withNonce.Should().NotContain(ContentSecurityPolicy.StyleNoncePlaceholder);
        withNonce.Replace("abc123==", ContentSecurityPolicy.StyleNoncePlaceholder, StringComparison.Ordinal).Should().Be(policy);
    }

    [Fact]
    public void WithStyleNonce_RefusesAnEmptyNonce()
    {
        var act = () => ContentSecurityPolicy.WithStyleNonce(ContentSecurityPolicy.BuildPolicy([], [], []), "");

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void RenderIndex_WritesTheNonceIntoTheShell()
    {
        var template = $"<meta name=\"csp-nonce\" nonce=\"{ContentSecurityPolicy.StyleNoncePlaceholder}\" />";

        ContentSecurityPolicy.RenderIndex(template, "n0nce").Should().Be("<meta name=\"csp-nonce\" nonce=\"n0nce\" />");
    }

    [Fact]
    public void RenderIndex_RefusesAnEmptyNonce()
    {
        var act = () => ContentSecurityPolicy.RenderIndex("<html></html>", "");

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void ShippedIndexHtml_CarriesTheNoncePlaceholderAndTheShim()
    {
        // The server can only stamp the nonce if the built shell has the placeholder, and
        // runtime <style> elements only get it through /csp-nonce.js loaded before the app.
        var indexHtml = File.ReadAllText(Path.Combine(RepoRoot(), "client", "index.html"));

        indexHtml.Should().Contain($"<meta name=\"csp-nonce\" nonce=\"{ContentSecurityPolicy.StyleNoncePlaceholder}\" />");
        indexHtml.IndexOf("/csp-nonce.js", StringComparison.Ordinal).Should()
            .BeLessThan(indexHtml.IndexOf("/app/main.tsx", StringComparison.Ordinal));
        File.Exists(Path.Combine(RepoRoot(), "client", "app", "public", "csp-nonce.js")).Should().BeTrue();
    }

    [Fact]
    public void Build_KeepsTheFramingAndObjectRestrictions()
    {
        var policy = ContentSecurityPolicy.Build(Config([]));

        policy.Should().Contain("frame-ancestors 'none'");
        policy.Should().Contain("object-src 'none'");
        policy.Should().Contain("base-uri 'self'");
    }

    // ---------- A malformed value cannot inject a directive ----------

    [Theory]
    [InlineData("not-a-url")]
    [InlineData("javascript:alert(1)")]
    [InlineData("https://evil.example.com; script-src *")]
    public void ToOrigin_RejectsAnythingThatIsNotAnHttpOrWebSocketOrigin(string value)
    {
        // "https://evil...; script-src *" parses as a URI whose path carries the injection,
        // so the assertion is that only the authority survives -- never the directive.
        var origin = ContentSecurityPolicy.ToOrigin(value);
        (origin == null || !origin.Contains("script-src", StringComparison.Ordinal)).Should().BeTrue();
    }

    [Fact]
    public void ToOrigin_DropsPathQueryAndTrailingSlash()
    {
        ContentSecurityPolicy.ToOrigin("https://iam.example.com/api/?x=1")
            .Should().Be("https://iam.example.com");
    }

    [Fact]
    public void Build_ExtraOriginsCannotInjectADirective()
    {
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["Csp:ExtraConnectSrc"] = "https://ok.example.com; script-src * 'unsafe-eval'",
            ["Csp:ExtraImgSrc"] = "javascript:alert(1), data:text/html,x",
        }));

        Directive(policy, "connect-src").Should().Contain("https://ok.example.com");
        Directive(policy, "script-src").Should().Be(" 'self'");
        policy.Should().NotContain("unsafe-eval");
        policy.Should().NotContain("javascript:");
        policy.Should().NotContain("text/html");
    }

    [Fact]
    public void Build_WithNoConfigurationAllowsOnlySelfAndTheFixedSources()
    {
        var policy = ContentSecurityPolicy.Build(Config([]));

        Directive(policy, "connect-src").Should().Be(
            $" 'self' {ContentSecurityPolicy.BlobStorageFallback} {ContentSecurityPolicy.TemplateCdnSource}");
        Directive(policy, "img-src").Should().Be($" 'self' data: blob: {ContentSecurityPolicy.BlobStorageFallback}");
        Directive(policy, "form-action").Should().Be(" 'self'");
    }

    // ---------- Fixed sources: an environment with only FrontendRuntime keeps working ----------

    [Fact]
    public void Build_AllowsTheImportTemplateCdn()
    {
        // The import file modal fetches its templates from the CDN before saving them.
        var policy = ContentSecurityPolicy.Build(Config([]));

        Directive(policy, "connect-src").Should().Contain("https://az-cdn.selise.biz");
    }

    [Fact]
    public void Build_UsesTheConfiguredBlobStorageInsteadOfTheWildcard()
    {
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["Csp:BlobStorageSrc"] = "https://account.blob.core.windows.net/container/file.json?sig=x",
        }));

        Directive(policy, "connect-src").Should().Contain("https://account.blob.core.windows.net");
        Directive(policy, "img-src").Should().Contain("https://account.blob.core.windows.net");
        policy.Should().NotContain(ContentSecurityPolicy.BlobStorageFallback);
    }

    [Fact]
    public void Build_FallsBackToTheBlobWildcardWhenTheSettingHoldsNoOrigin()
    {
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["Csp:BlobStorageSrc"] = "not-a-url",
        }));

        Directive(policy, "connect-src").Should().Contain(ContentSecurityPolicy.BlobStorageFallback);
        Directive(policy, "img-src").Should().Contain(ContentSecurityPolicy.BlobStorageFallback);
    }

    [Fact]
    public void Build_AllowsRollbarOnlyWhenErrorReportingIsConfigured()
    {
        var without = ContentSecurityPolicy.Build(Config([]));
        var with = ContentSecurityPolicy.Build(Config(new()
        {
            ["FrontendRuntime:BLOCKS_ROLLBAR_CLIENT_TOKEN"] = "placeholder-token",
        }));

        Directive(without, "connect-src").Should().NotContain(ContentSecurityPolicy.RollbarSource);
        Directive(with, "connect-src").Should().Contain(ContentSecurityPolicy.RollbarSource);
        with.Should().NotContain("placeholder-token");
    }

    [Fact]
    public void Build_CoversEveryServiceHostOfTheRuntimeConfig()
    {
        // Each *_BASE_URL / *_URL key the SPA can call (runtime-config.js) is a connect source.
        var keys = ContentSecurityPolicy.ConnectOriginKeys;
        var values = keys.Select((key, i) => (key, i)).ToDictionary(
            entry => "FrontendRuntime:" + entry.key,
            entry => (string?)$"https://host{entry.i}.example.com/path/");

        var connect = Directive(ContentSecurityPolicy.Build(Config(values)), "connect-src");

        for (var i = 0; i < keys.Length; i++)
        {
            connect.Should().Contain($"https://host{i}.example.com");
        }

        var runtimeConfig = File.ReadAllText(Path.Combine(RepoRoot(), "client", "app", "public", "runtime-config.js"));
        foreach (var key in ContentSecurityPolicy.ConnectOriginKeys)
        {
            runtimeConfig.Should().Contain($"{key}: \"__{key}__\"");
        }
    }

    [Fact]
    public void Build_KeepsTheExactBlobWildcardWhenConfigured()
    {
        var policy = ContentSecurityPolicy.Build(Config(new()
        {
            ["Csp:BlobStorageSrc"] = ContentSecurityPolicy.BlobStorageFallback,
        }));

        Directive(policy, "img-src").Should().Be($" 'self' data: blob: {ContentSecurityPolicy.BlobStorageFallback}");
    }

    [Fact]
    public void ShippedIndexHtml_HasNoInlineScriptAndNoExternalStylesheet()
    {
        // script-src 'self' only works when the runtime config is the external
        // /runtime-config.js, and the third-party font stylesheet had no integrity (ZAP 90003).
        var indexHtml = File.ReadAllText(Path.Combine(RepoRoot(), "client", "index.html"));

        indexHtml.Should().Contain("<script src=\"/runtime-config.js\"></script>");
        indexHtml.Should().NotContain("<script>");
        indexHtml.Should().NotContain("__BLOCKS_ENV__");
        indexHtml.Should().NotContain("https://");
        indexHtml.IndexOf("/runtime-config.js", StringComparison.Ordinal).Should()
            .BeLessThan(indexHtml.IndexOf("/app/main.tsx", StringComparison.Ordinal));
    }

    /// <summary>The repository root: the first directory above the test output with client/index.html.</summary>
    private static string RepoRoot()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            if (File.Exists(Path.Combine(dir.FullName, "client", "index.html"))) return dir.FullName;
        }

        throw new DirectoryNotFoundException("client/index.html not found above the test output.");
    }

    /// <summary>The sources of one directive, without its name or the trailing separator.</summary>
    private static string Directive(string policy, string name)
    {
        var parts = policy.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var directive = parts.Single(p => p.StartsWith(name + " ", StringComparison.Ordinal)
                                          || p.Equals(name, StringComparison.Ordinal));
        return directive[name.Length..];
    }
}
