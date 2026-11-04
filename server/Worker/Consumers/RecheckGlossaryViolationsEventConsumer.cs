using Blocks.Genesis;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared.Events;

namespace Worker.Consumers
{
    public class RecheckGlossaryViolationsEventConsumer : IConsumer<RecheckGlossaryViolationsEvent>
    {
        private readonly IGlossaryRecheckService _recheckService;

        public RecheckGlossaryViolationsEventConsumer(IGlossaryRecheckService recheckService)
        {
            _recheckService = recheckService;
        }

        public async Task Consume(RecheckGlossaryViolationsEvent @event)
        {
            await _recheckService.RecheckAsync(@event);
        }
    }
}
