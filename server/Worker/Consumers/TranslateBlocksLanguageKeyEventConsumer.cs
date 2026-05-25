using Blocks.Genesis;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared.Events;


namespace Worker.Consumers
{
    public class TranslateBlocksLanguageKeyEventConsumer : IConsumer<TranslateBlocksLanguageKeyEvent>
    {
        private readonly IKeyManagementService _keyManagementService;

        public TranslateBlocksLanguageKeyEventConsumer(IKeyManagementService keyManagementService)
        {
            _keyManagementService = keyManagementService;
        }

        public async Task Consume(TranslateBlocksLanguageKeyEvent @event)
        {
            var response = await _keyManagementService.TranslateBlocksLanguageKey(@event);
            await _keyManagementService.PublishTranslateBlocksLanguageKeyNotification(
                    response: response,
                    messageCoRelationId: @event.MessageCoRelationId
                    );
        }
    }
}