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

        public async Task NotifyAsync(string tenantId, IReadOnlyCollection<string> changedGlossaryIds)
        {
            if (!string.IsNullOrEmpty(tenantId)) _matcherCache?.Invalidate(tenantId);
            if (changedGlossaryIds.Count > 0 && _recheckService != null) await _recheckService.TriggerAsync(changedGlossaryIds);
        }
    }
}
