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
            if (@event.BatchCount > 1)
            {
                // A split request notifies once, when its last batch finishes.
                var allBatches = await _keyManagementService.CompleteTranslateBlocksLanguageKeysBatchAsync(@event, response);
                if (allBatches == null) return;
                response = allBatches.Value;
            }
            await _keyManagementService.PublishTranslateBlocksLanguageKeyNotification(
                    response: response,
                    messageCoRelationId: @event.MessageCoRelationId
                    );
        }
    }
}
