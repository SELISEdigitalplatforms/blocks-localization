using Blocks.Genesis;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared.Events;


namespace Worker.Consumers
{
    public class GenerateUilmFilesConsumer : IConsumer<GenerateUilmFilesEvent>
    {
        private readonly IKeyManagementService _keyManagementService;
        private readonly IWebHookService _webHookService;

        public GenerateUilmFilesConsumer(IKeyManagementService keyManagementService, IWebHookService webHookService)
        {
            _keyManagementService = keyManagementService;
            _webHookService = webHookService;
        }
        public async Task Consume(GenerateUilmFilesEvent context)
        {
            await _keyManagementService.GenerateAsync(context);
            await _webHookService.CallWebhook(
                    new
                    {
                        GenerateUilmFilesEvent = context
                    }
            );
        }
    }
}
