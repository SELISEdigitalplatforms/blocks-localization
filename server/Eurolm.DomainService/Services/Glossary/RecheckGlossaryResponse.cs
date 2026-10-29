namespace Eurolm.DomainService.Services
{
    public class RecheckGlossaryResponse
    {
        /// <summary>False when the server flag is off or a re-check for the tenant is already queued (coalesced).</summary>
        public bool Queued { get; set; }
    }
}
