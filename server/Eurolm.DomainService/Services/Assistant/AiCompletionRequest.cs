using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class AiCompletionRequest
    {
        public string Message { get; set; }
        public double Temperature { get; set; }
        public AiCompletionRequest(string message, double temperature) 
        { 
            Message = message;
            Temperature = temperature;
        }
    }
}
