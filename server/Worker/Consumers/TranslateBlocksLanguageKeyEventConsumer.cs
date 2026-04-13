using Blocks.Genesis;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Shared.Events;

namespace BlocksTemplate.Worker.Consumers
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