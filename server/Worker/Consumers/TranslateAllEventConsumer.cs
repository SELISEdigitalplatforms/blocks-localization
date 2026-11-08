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
        private readonly IActionPublisher _actionPublisher;

        public TranslateAllEventConsumer(IKeyManagementService keyManagementService, IWebHookService webHookService, IActionPublisher actionPublisher)
        {
            _actionPublisher = actionPublisher;
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
            await _actionPublisher.PublishAsync("localization.translation.completed", new
            {
                moduleId = @event.ModuleId,
                projectKey = @event.ProjectKey,
                defaultLanguage = @event.DefaultLanguage,
                isSuccess = response
            });
        }
    }
}
