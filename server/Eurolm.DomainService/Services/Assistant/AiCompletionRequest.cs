using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class AiCompletionRequest
    {
        public string Message { get; set; }
        public double Temperature { get; set; }
        public CancellationToken CancellationToken { get; set; }

        /// <summary>Set by AiCompletion on a 429: how long Azure asked to wait before the retry.</summary>
        public TimeSpan? RetryAfter { get; set; }

        public AiCompletionRequest(string message, double temperature) 
        { 
            Message = message;
            Temperature = temperature;
        }
    }
}
