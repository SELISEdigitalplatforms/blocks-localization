using BlocksTemplate.Api.Security;

namespace BlocksTemplate.Api.Middleware;

/// <summary>
/// Serves the SPA shell (index.html) with the response's CSP style nonce (meta[name=csp-nonce]).
/// The shell is rendered from a template read once at startup instead of being sent verbatim by
/// the static file middleware, so it carries the same nonce as the response's header
/// (<see cref="SecurityHeadersMiddleware.StyleNonceItemKey"/>).
/// </summary>
public static class SpaShell
{
    /// <summary>
    /// The shell template from the web root, or null when there is no built client. Read after
    /// the frontend runtime settings were applied to the web root.
    /// </summary>
    public static async Task<string?> ReadTemplateAsync(string? webRootPath)
    {
        var indexHtml = Path.Combine(webRootPath ?? "", "index.html");
        return File.Exists(indexHtml) ? await File.ReadAllTextAsync(indexHtml).ConfigureAwait(false) : null;
    }

    /// <summary>
    /// True for a GET or HEAD of "/" or "/index.html", which the static file middleware would
    /// otherwise answer verbatim, with the nonce placeholder still in it.
    /// </summary>
    public static bool IsRootRequest(HttpRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (!HttpMethods.IsGet(request.Method) && !HttpMethods.IsHead(request.Method)) return false;
        var path = request.Path.Value;
        return path is "/" or "" || string.Equals(path, "/index.html", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Answers root requests with the rendered shell; passes everything else on.</summary>
    public static async Task InvokeAsync(HttpContext context, RequestDelegate next, string template)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(next);
        if (IsRootRequest(context.Request))
        {
            await WriteAsync(context, template).ConfigureAwait(false);
            return;
        }

        await next(context).ConfigureAwait(false);
    }

    /// <summary>
    /// Writes the shell with the response's style nonce. Only GET and HEAD are pages, as with the
    /// static file fallback before; any other method gets 404.
    /// </summary>
    public static async Task WriteAsync(HttpContext context, string template)
    {
        ArgumentNullException.ThrowIfNull(context);
        if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        var nonce = (string)context.Items[SecurityHeadersMiddleware.StyleNonceItemKey]!;
        context.Response.ContentType = "text/html; charset=utf-8";
        await context.Response.WriteAsync(ContentSecurityPolicy.RenderIndex(template, nonce)).ConfigureAwait(false);
    }
}
