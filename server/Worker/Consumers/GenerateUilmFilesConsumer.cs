using Blocks.Genesis;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Shared.Events;

namespace BlocksTemplate.Worker.Consumers
{
    public class GenerateUilmFilesConsumer : IConsumer<GenerateUilmFilesEvent>
    {
        private readonly IKeyManagementService _keyManagementService;

        public GenerateUilmFilesConsumer(IKeyManagementService keyManagementService)
        {
            _keyManagementService = keyManagementService;
        }
        public async Task Consume(GenerateUilmFilesEvent context)
        {
            await _keyManagementService.GenerateAsync(context);
        }
    }
}
