using BlocksTemplate.Api.Middleware;
using BlocksTemplate.Api.Security;
using FluentAssertions;
using Microsoft.AspNetCore.Http;

namespace XUnitTest.Api.Middleware;

public class SpaShellTests
{
    private const string Template = "<head><meta name=\"csp-nonce\" nonce=\"" + ContentSecurityPolicy.StyleNoncePlaceholder + "\" /></head>";

    private static DefaultHttpContext Context(string method, string path, string nonce = "n0nce")
    {
        var context = new DefaultHttpContext();
        context.Request.Method = method;
        context.Request.Path = path;
        context.Items[SecurityHeadersMiddleware.StyleNonceItemKey] = nonce;
        context.Response.Body = new MemoryStream();
        return context;
    }

    private static string Body(HttpContext context)
    {
        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body, leaveOpen: true);
        return reader.ReadToEnd();
    }

    [Theory]
    [InlineData("GET", "/", true)]
    [InlineData("HEAD", "/", true)]
    [InlineData("GET", "", true)]
    [InlineData("GET", "/index.html", true)]
    [InlineData("GET", "/INDEX.HTML", true)]
    [InlineData("POST", "/", false)]
    [InlineData("GET", "/app/console", false)]
    [InlineData("GET", "/assets/index.js", false)]
    public void IsRootRequest_matches_only_reads_of_the_root_shell(string method, string path, bool expected)
    {
        SpaShell.IsRootRequest(Context(method, path).Request).Should().Be(expected);
    }

    [Fact]
    public async Task WriteAsync_renders_the_shell_with_the_response_nonce()
    {
        var context = Context("GET", "/app/console", "abc123==");

        await SpaShell.WriteAsync(context, Template);

        context.Response.ContentType.Should().Be("text/html; charset=utf-8");
        Body(context).Should().Be("<head><meta name=\"csp-nonce\" nonce=\"abc123==\" /></head>");
    }

    [Fact]
    public async Task WriteAsync_answers_404_to_other_methods()
    {
        var context = Context("POST", "/app/console");

        await SpaShell.WriteAsync(context, Template);

        context.Response.StatusCode.Should().Be(StatusCodes.Status404NotFound);
        Body(context).Should().BeEmpty();
    }

    [Fact]
    public async Task InvokeAsync_serves_the_root_without_calling_the_next_middleware()
    {
        var context = Context("GET", "/");
        var nextCalled = false;

        await SpaShell.InvokeAsync(context, _ => { nextCalled = true; return Task.CompletedTask; }, Template);

        nextCalled.Should().BeFalse();
        Body(context).Should().Contain("nonce=\"n0nce\"");
    }

    [Fact]
    public async Task InvokeAsync_passes_other_requests_on()
    {
        var context = Context("GET", "/assets/index.js");
        var nextCalled = false;

        await SpaShell.InvokeAsync(context, _ => { nextCalled = true; return Task.CompletedTask; }, Template);

        nextCalled.Should().BeTrue();
        Body(context).Should().BeEmpty();
    }

    [Fact]
    public async Task ReadTemplateAsync_reads_index_html_from_the_web_root()
    {
        var root = Directory.CreateTempSubdirectory("spa-shell-");
        try
        {
            await File.WriteAllTextAsync(Path.Combine(root.FullName, "index.html"), Template);

            (await SpaShell.ReadTemplateAsync(root.FullName)).Should().Be(Template);
        }
        finally
        {
            root.Delete(recursive: true);
        }
    }

    [Fact]
    public async Task ReadTemplateAsync_returns_null_without_a_built_client()
    {
        var root = Directory.CreateTempSubdirectory("spa-shell-");
        try
        {
            (await SpaShell.ReadTemplateAsync(root.FullName)).Should().BeNull();
        }
        finally
        {
            root.Delete(recursive: true);
        }
    }
}
