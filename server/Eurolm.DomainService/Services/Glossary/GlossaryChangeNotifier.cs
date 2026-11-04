namespace Eurolm.DomainService.Services
{
    public class GlossaryChangeNotifier : IGlossaryChangeNotifier
    {
        private readonly IGlossaryMatcherCache? _matcherCache;
        private readonly IGlossaryRecheckService? _recheckService;

        public GlossaryChangeNotifier(IGlossaryMatcherCache? matcherCache = null, IGlossaryRecheckService? recheckService = null)
        {
            _matcherCache = matcherCache;
            _recheckService = recheckService;
        }

        public Task NotifyAsync(string tenantId, IReadOnlyCollection<string> changedGlossaryIds) =>
            NotifyAsync(tenantId, changedGlossaryIds, Array.Empty<string>());

        public async Task NotifyAsync(string tenantId, IReadOnlyCollection<string> changedGlossaryIds, IReadOnlyCollection<string> previousModuleIds)
        {
            if (!string.IsNullOrEmpty(tenantId)) _matcherCache?.Invalidate(tenantId);
            if (changedGlossaryIds.Count == 0 || _recheckService == null) return;
            if (previousModuleIds.Count > 0) await _recheckService.TriggerAsync(changedGlossaryIds, previousModuleIds, wholeProject: false);
            else await _recheckService.TriggerAsync(changedGlossaryIds);
        }
    }
}
