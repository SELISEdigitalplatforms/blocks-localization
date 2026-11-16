using BlocksTemplate.Api.Middleware;
using BlocksTemplate.Api.Security;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;

namespace XUnitTest.Api.Middleware;

public class SecurityHeadersMiddlewareTests
{
    private static readonly string Csp = ContentSecurityPolicy.BuildPolicy([], [], []);

    [Fact]
    public void Apply_sets_browser_security_headers()
    {
        var context = new DefaultHttpContext();
        context.Request.Path = "/";

        SecurityHeadersMiddleware.Apply(context, Csp);

        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"].ToString().Should().Be("nosniff");
        headers["X-Frame-Options"].ToString().Should().Be("DENY");
        headers["Strict-Transport-Security"].ToString().Should().Contain("max-age=31536000");
        headers["Content-Security-Policy"].ToString().Should().Be(Csp);
        headers["Cache-Control"].ToString().Should().Contain("no-store");
    }

    private static readonly byte[] Key = Enumerable.Range(1, 32).Select(i => (byte)i).ToArray();

    [Fact]
    public async Task InvokeAsync_stamps_the_style_nonce_into_the_policy_and_the_context()
    {
        var nonces = new StyleNonce(Key);
        var seed = StyleNonce.NewSeed();
        var context = new DefaultHttpContext();
        context.Request.Path = "/app/console";
        context.Request.Headers.Cookie = $"{StyleNonce.SeedCookieName}={seed}";
        var middleware = new SecurityHeadersMiddleware(_ => Task.CompletedTask, Csp, nonces);

        await middleware.InvokeAsync(context);

        var nonce = nonces.For(seed);
        context.Items[SecurityHeadersMiddleware.StyleNonceItemKey].Should().Be(nonce);
        var policy = context.Response.Headers["Content-Security-Policy"].ToString();
        policy.Should().Contain($"style-src 'self' 'nonce-{nonce}'");
        policy.Should().NotContain(ContentSecurityPolicy.StyleNoncePlaceholder);
    }

    [Fact]
    public async Task InvokeAsync_gives_the_same_browser_the_same_nonce()
    {
        // ZAP 10104 compares two responses for one page: one browser must get one shell.
        var nonces = new StyleNonce(Key);
        var seed = StyleNonce.NewSeed();
        var middleware = new SecurityHeadersMiddleware(_ => Task.CompletedTask, Csp, nonces);
        var policies = new List<string>();
        for (var i = 0; i < 2; i++)
        {
            var context = new DefaultHttpContext();
            context.Request.Path = "/";
            context.Request.Headers.Cookie = $"{StyleNonce.SeedCookieName}={seed}";
            await middleware.InvokeAsync(context);
            policies.Add(context.Response.Headers["Content-Security-Policy"].ToString());
        }

        policies[0].Should().Be(policies[1]);
    }

    [Fact]
    public void Apply_sets_immutable_cache_for_assets()
    {
        var context = new DefaultHttpContext();
        context.Request.Path = "/assets/index.js";

        SecurityHeadersMiddleware.Apply(context, Csp);

        context.Response.Headers["Cache-Control"].ToString()
            .Should().Contain("immutable");
    }

    [Fact]
    public async Task InvokeAsync_applies_the_headers_again_when_the_response_starts()
    {
        // A handler further down may reset the headers; they are set again just before the
        // response is sent.
        var feature = new StartableResponseFeature();
        var context = new DefaultHttpContext();
        context.Features.Set<IHttpResponseFeature>(feature);
        context.Request.Path = "/";
        var middleware = new SecurityHeadersMiddleware(
            ctx => { ctx.Response.Headers.Clear(); return Task.CompletedTask; },
            Csp,
            new StyleNonce(Key));

        await middleware.InvokeAsync(context);
        context.Response.Headers.ContainsKey("X-Frame-Options").Should().BeFalse();
        await feature.StartAsync();

        context.Response.Headers["X-Frame-Options"].ToString().Should().Be("DENY");
        context.Response.Headers["Content-Security-Policy"].ToString().Should().StartWith("default-src 'self';");
    }

    /// <summary>A response feature that runs its OnStarting callbacks on demand.</summary>
    private sealed class StartableResponseFeature : HttpResponseFeature
    {
        private readonly List<(Func<object, Task> Callback, object State)> _onStarting = [];

        public override void OnStarting(Func<object, Task> callback, object state) => _onStarting.Add((callback, state));

        public async Task StartAsync()
        {
            foreach (var (callback, state) in _onStarting)
            {
                await callback(state).ConfigureAwait(false);
            }
        }
    }
}
