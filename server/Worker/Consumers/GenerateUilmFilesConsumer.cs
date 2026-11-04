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
        private readonly IActionPublisher _actionPublisher;

        public GenerateUilmFilesConsumer(IKeyManagementService keyManagementService, IWebHookService webHookService, IActionPublisher actionPublisher)
        {
            _actionPublisher = actionPublisher;
            _keyManagementService = keyManagementService;
            _webHookService = webHookService;
        }
        public async Task Consume(GenerateUilmFilesEvent context)
        {
            var isSuccess = await _keyManagementService.GenerateAsync(context);
            await _webHookService.CallWebhook(
                    new
                    {
                        GenerateUilmFilesEvent = context
                    }
            );
            await _actionPublisher.PublishAsync("localization.files.generated", new
            {
                generationId = context.Guid,
                moduleId = context.ModuleId,
                projectKey = context.ProjectKey,
                isSuccess
            });
        }
    }
}
