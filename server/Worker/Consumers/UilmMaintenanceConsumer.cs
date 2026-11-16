using Blocks.Genesis;
using Eurolm.DomainService.Services.UilmStorage;

namespace Worker.Consumers
{
    /// <summary>
    /// Receives the blocks-logic schedule's <see cref="PublishScheduleCommand"/> (and on-demand runs) from the
    /// maintenance queue. Never throws: a failed run is logged and the next hourly run tries again.
    /// </summary>
    public class UilmMaintenanceConsumer : IConsumer<PublishScheduleCommand>
    {
        private readonly IUilmMaintenanceService _maintenanceService;

        public UilmMaintenanceConsumer(IUilmMaintenanceService maintenanceService)
        {
            _maintenanceService = maintenanceService;
        }

        public Task Consume(PublishScheduleCommand context) => _maintenanceService.RunAsync(context?.Payload);
    }
}
