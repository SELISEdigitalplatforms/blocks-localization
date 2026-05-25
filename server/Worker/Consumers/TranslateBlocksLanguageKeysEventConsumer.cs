using Blocks.Genesis;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared.Events;


namespace Worker.Consumers
{
    public class TranslateBlocksLanguageKeysEventConsumer : IConsumer<TranslateBlocksLanguageKeysEvent>
    {
        private readonly IKeyManagementService _keyManagementService;

        public TranslateBlocksLanguageKeysEventConsumer(IKeyManagementService keyManagementService)
        {
            _keyManagementService = keyManagementService;
        }

        public async Task Consume(TranslateBlocksLanguageKeysEvent @event)
        {
            var response = await _keyManagementService.TranslateBlocksLanguageKeys(@event);
            await _keyManagementService.PublishTranslateBlocksLanguageKeyNotification(
                    response: response,
                    messageCoRelationId: @event.MessageCoRelationId
                    );
        }
    }
}
