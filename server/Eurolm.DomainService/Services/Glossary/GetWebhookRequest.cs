using Blocks.Genesis;

namespace Eurolm.DomainService.Services
{
    public class GetWebhookRequest : IProjectKey
    {
        public required string ProjectKey { get; set; }
    }
}
