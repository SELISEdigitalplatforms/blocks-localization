using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared.Events;
using Microsoft.Extensions.Logging;


namespace Worker.Consumers
{

    public class UilmImportEventConsumer : IConsumer<UilmImportEvent>
    {
        private readonly IKeyManagementService _keyManagementService;
        private readonly IWebHookService _webHookService;
        private readonly ILocalizationUniquenessRepository _uniquenessRepository;
        private readonly ILogger<UilmImportEventConsumer> _logger;
        private readonly IActionPublisher _actionPublisher;

        public UilmImportEventConsumer(
            IKeyManagementService keyManagementService,
            IWebHookService webHookService,
            ILocalizationUniquenessRepository uniquenessRepository,
            ILogger<UilmImportEventConsumer> logger,
            IActionPublisher actionPublisher)
        {
            _actionPublisher = actionPublisher;
            _keyManagementService = keyManagementService;
            _webHookService = webHookService;
            _uniquenessRepository = uniquenessRepository;
            _logger = logger;
        }
        public async Task Consume(UilmImportEvent @event)
        {
            await EnsureUniqueIndexesAsync(@event);

            var isSuccess = await _keyManagementService.ImportUilmFile(@event);
            if (isSuccess)
            {
                _webHookService.CallWebhook(new { UilmImportEvent = @event, IsSuccess = isSuccess});
            }

            await _actionPublisher.PublishAsync("localization.import.completed", new
            {
                fileId = @event.FileId,
                projectKey = @event.ProjectKey,
                isSuccess
            });
        }

        /// <summary>
        /// A clean tenant gets its unique indexes before the import writes keys, so concurrent
        /// imports of the same new key end with one row. Failure here never stops the import.
        /// </summary>
        private async Task EnsureUniqueIndexesAsync(UilmImportEvent @event)
        {
            // The import writes to the tenant in the message context.
            var tenantId = BlocksContext.GetContext()?.TenantId;
            if (string.IsNullOrWhiteSpace(tenantId))
            {
                tenantId = @event.ProjectKey;
            }
            if (string.IsNullOrWhiteSpace(tenantId))
            {
                return;
            }

            try
            {
                await _uniquenessRepository.EnsureUniqueIndexesAsync(tenantId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Could not ensure unique indexes for tenant {TenantId}; continuing the import", tenantId);
            }
        }
    }
}
