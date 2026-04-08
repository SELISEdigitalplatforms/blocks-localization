using Blocks.Genesis;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Services.HelperService;
using BlocksTemplate.DomainService.Shared.Events;

namespace BlocksTemplate.Worker.Consumers
{

    public class UilmImportEventConsumer : IConsumer<UilmImportEvent>
    {
        private readonly IKeyManagementService _keyManagementService;
        private readonly IWebHookService _webHookService;

        public UilmImportEventConsumer(IKeyManagementService keyManagementService, IWebHookService webHookService)
        {
            _keyManagementService = keyManagementService;
            _webHookService = webHookService;
        }
        public async Task Consume(UilmImportEvent @event)
        {
            var isSuccess = await _keyManagementService.ImportUilmFile(@event);
            if (isSuccess)
            {
                _webHookService.CallWebhook(new { UilmImportEvent = @event, IsSuccess = isSuccess});
            }

        }
    }
}