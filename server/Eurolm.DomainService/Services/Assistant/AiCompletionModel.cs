using System.Net;

namespace Eurolm.DomainService.Services
{
    public class AiCompletionModel
    {
        public string model { get; set; }
        public List<Message> messages { get; set; }
        public double temperature { get; set; }

        public AiCompletionModel ConstructCommand(string content, double temperature)
        {
            return new AiCompletionModel
            {
                model = "gpt-4o-mini",
                messages = new List<Message>
                {
                    new Message { role = "system", 
                                content = "You are a translator for UI text. Output EXACTLY the translated UI text and NOTHING ELSE. No quotes, no explanation, no metadata, no JSON wrappers, no punctuation beyond what belongs to the translated text itself. If the original text is blank, return an empty string. Preserve casing and punctuation only as appropriate for the UI element. Do not include surrounding whitespace or newlines. Keep every placeholder in double curly braces, like {{count}} or {{name}}, exactly as written: never translate, rename, reorder its name, or remove it." },
                    new Message { role = "user", content = content }
                },
                temperature = temperature
            };
        }
    }

    public class Message
    {
        public string role { get; set; }
        public string content { get; set; }
    }

    public class RestResponse
    {
        public HttpStatusCode HttpStatusCode { set; get; }
        public dynamic ResponseData { get; set; }

        /// <summary>How long the server asked the caller to wait (429 Retry-After); null when it did not say.</summary>
        public TimeSpan? RetryAfter { get; set; }
    }
}
