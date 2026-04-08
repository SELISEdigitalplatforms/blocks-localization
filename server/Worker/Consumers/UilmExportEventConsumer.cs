using Blocks.Genesis;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Shared.Events;

namespace BlocksTemplate.Worker.Consumers
{
    public class UilmExportEventConsumer : IConsumer<UilmExportEvent>
    {
        private readonly IKeyManagementService _keyManagementService;

        public UilmExportEventConsumer(IKeyManagementService keyManagementService)
        {
            _keyManagementService = keyManagementService;
        }
        public async Task Consume(UilmExportEvent @event)
        {
            var isSuccess = await _keyManagementService.ExportUilmFile(@event);

            await _keyManagementService.PublishUilmExportNotification(
                    response: isSuccess,
                    fileId: @event.FileId,
                    messageCoRelationId: @event.MessageCoRelationId,
                    tenantId: @event.CallerTenantId);
        }
    }
}