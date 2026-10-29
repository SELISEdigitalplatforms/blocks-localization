using Eurolm.DomainService.Shared.Events;

namespace Eurolm.DomainService.Services
{
    public interface IGlossaryRecheckService
    {
        /// <summary>
        /// Queues a re-check of the glossary's keys (null = the whole project). False when the flag is off or a job
        /// for the tenant is already queued; the request's scope is then merged into that job.
        /// </summary>
        Task<bool> QueueAsync(string? glossaryId);

        /// <summary>
        /// The automatic trigger after a glossary write: queues (coalesced) only with the flag on, and never throws.
        /// An empty <paramref name="glossaryIds"/> means the whole project.
        /// </summary>
        Task TriggerAsync(IReadOnlyCollection<string> glossaryIds);

        /// <summary>The worker job: recomputes and stores the violations of the affected keys. No AI call.</summary>
        Task<GlossaryRecheckResult> RecheckAsync(RecheckGlossaryViolationsEvent @event);
    }

    public class GlossaryRecheckResult
    {
        /// <summary>False when the flag is off or the project has no default language.</summary>
        public bool Ran { get; set; }
        public int Checked { get; set; }
        public int Updated { get; set; }
        public int Failed { get; set; }
    }
}
