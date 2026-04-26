using Blocks.Genesis;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared.Events;


namespace Worker.Consumers
{
    public class TranslateAllEventConsumer : IConsumer<TranslateAllEvent>
    {
        private readonly IKeyManagementService _keyManagementService;
        private readonly IWebHookService _webHookService;

        public TranslateAllEventConsumer(IKeyManagementService keyManagementService, IWebHookService webHookService)
        {
            _keyManagementService = keyManagementService;
            _webHookService = webHookService;
        }
        public async Task Consume(TranslateAllEvent @event)
        {
            var response = await _keyManagementService.ChangeAll(@event);
            await _keyManagementService.PublishTranslateAllNotification(
                    response: response,
                    messageCoRelationId: @event.MessageCoRelationId
                    );
            await _webHookService.CallWebhook(
                    new
                    {
                        TranslateAllEvent = @event,
                        Response = response
                    }
                    );
        }
    }
}
