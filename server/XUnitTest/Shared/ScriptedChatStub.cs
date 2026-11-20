using System.Net;
using System.Text;
using System.Text.Json;

namespace XUnitTest.Shared;

/// <summary>
/// A local HTTP stub that answers like the OpenAI Chat Completions API and Azure OpenAI, with scripted replies
/// (rule 13: no real model). It listens on a loopback port, records every request (path, headers, body) and answers
/// with the next scripted reply; the last reply repeats once the script runs out.
/// </summary>
public sealed class ScriptedChatStub : IDisposable
{
    public sealed record Reply(int Status, string Body, IReadOnlyDictionary<string, string>? Headers = null);

    public sealed record Recorded(string Path, string Query, IReadOnlyDictionary<string, string> Headers, string Body)
    {
        public JsonElement Json => JsonDocument.Parse(Body).RootElement.Clone();
    }

    private readonly HttpListener _listener = new();
    private readonly Queue<Reply> _script = new();
    private readonly object _gate = new();
    private readonly Task _loop;
    private Reply? _last;

    public ScriptedChatStub(params Reply[] replies)
    {
        foreach (var reply in replies)
            _script.Enqueue(reply);

        var port = FreePort();
        BaseUrl = $"http://127.0.0.1:{port}";
        _listener.Prefixes.Add(BaseUrl + "/");
        _listener.Start();
        _loop = Task.Run(Serve);
    }

    public string BaseUrl { get; }

    public List<Recorded> Requests { get; } = new();

    /// <summary>A 200 reply in the Chat Completions format, with the token usage block.</summary>
    public static Reply Completion(string text, int promptTokens = 11, int completionTokens = 7, string model = "stub-model") =>
        new(200, JsonSerializer.Serialize(new
        {
            id = "chatcmpl-stub",
            @object = "chat.completion",
            model,
            choices = new[] { new { index = 0, finish_reason = "stop", message = new { role = "assistant", content = text } } },
            usage = new { prompt_tokens = promptTokens, completion_tokens = completionTokens, total_tokens = promptTokens + completionTokens }
        }));

    /// <summary>A 200 reply that answers with a tool call and no text, for code paths that use tools.</summary>
    public static Reply ToolCall(string name, string argumentsJson) =>
        new(200, JsonSerializer.Serialize(new
        {
            model = "stub-model",
            choices = new[]
            {
                new
                {
                    index = 0,
                    finish_reason = "tool_calls",
                    message = new
                    {
                        role = "assistant",
                        content = (string?)null,
                        tool_calls = new[] { new { id = "call_1", type = "function", function = new { name, arguments = argumentsJson } } }
                    }
                }
            },
            usage = new { prompt_tokens = 5, completion_tokens = 3, total_tokens = 8 }
        }));

    public static Reply Error(int status, string message = "stub error", IReadOnlyDictionary<string, string>? headers = null) =>
        new(status, JsonSerializer.Serialize(new { error = new { message, type = "stub_error" } }), headers);

    private static int FreePort()
    {
        var probe = new System.Net.Sockets.TcpListener(IPAddress.Loopback, 0);
        probe.Start();
        var port = ((IPEndPoint)probe.LocalEndpoint).Port;
        probe.Stop();
        return port;
    }

    private async Task Serve()
    {
        while (_listener.IsListening)
        {
            HttpListenerContext context;
            try
            {
                context = await _listener.GetContextAsync();
            }
            catch (Exception) when (!_listener.IsListening)
            {
                return;
            }

            string body;
            using (var reader = new StreamReader(context.Request.InputStream, Encoding.UTF8))
                body = await reader.ReadToEndAsync();

            var headers = context.Request.Headers.AllKeys
                .Where(k => k != null)
                .ToDictionary(k => k!.ToLowerInvariant(), k => context.Request.Headers[k]!);

            Reply reply;
            lock (_gate)
            {
                Requests.Add(new Recorded(context.Request.Url!.AbsolutePath, context.Request.Url.Query, headers, body));
                reply = _script.Count > 0 ? _script.Dequeue() : _last ?? Error(500, "script is empty");
                _last = reply;
            }

            context.Response.StatusCode = reply.Status;
            context.Response.ContentType = "application/json";
            foreach (var header in reply.Headers ?? new Dictionary<string, string>())
                context.Response.AddHeader(header.Key, header.Value);
            var bytes = Encoding.UTF8.GetBytes(reply.Body);
            await context.Response.OutputStream.WriteAsync(bytes);
            context.Response.Close();
        }
    }

    public void Dispose()
    {
        _listener.Close();
        try { _loop.Wait(TimeSpan.FromSeconds(2)); } catch (AggregateException) { }
    }
}
