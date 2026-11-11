using Blocks.Genesis;
using Eurolm.DomainService.Utilities;
using System.Text.Json;

namespace Eurolm.DomainService.Services.UilmStorage
{
    public class UilmMaintenanceQueue : IUilmMaintenanceQueue
    {
        private readonly IMessageClient _messageClient;

        public UilmMaintenanceQueue(IMessageClient messageClient)
        {
            _messageClient = messageClient;
        }

        public async Task QueueForCurrentTenantAsync()
        {
            var tenantId = BlocksContext.GetContext()?.TenantId;
            if (string.IsNullOrWhiteSpace(tenantId))
            {
                throw new InvalidOperationException("A tenant context is required to queue UILM maintenance.");
            }
            await _messageClient.SendToConsumerAsync(new ConsumerMessage<PublishScheduleCommand>
            {
                ConsumerName = Constants.UilmMaintenanceQueue,
                Payload = new PublishScheduleCommand
                {
                    Payload = JsonSerializer.Serialize(new Dictionary<string, string>
                    {
                        ["task"] = UilmMaintenanceService.TaskName,
                        ["tenantId"] = tenantId
                    })
                }
            });
        }
    }
}
