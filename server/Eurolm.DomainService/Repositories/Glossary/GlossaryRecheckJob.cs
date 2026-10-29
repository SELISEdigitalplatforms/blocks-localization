using MongoDB.Bson.Serialization.Attributes;

namespace Eurolm.DomainService.Repositories
{
    /// <summary>
    /// The tenant's one pending violation re-check (coalescing marker). While it exists a job is queued; later
    /// requests merge their scope into it instead of queueing another. The worker deletes it when the job starts.
    /// </summary>
    [BsonIgnoreExtraElements]
    public class GlossaryRecheckJob
    {
        public const string MarkerId = "glossary-recheck";

        [BsonId]
        public string Id { get; set; } = MarkerId;
        public DateTime QueuedAt { get; set; }
        /// <summary>True when any request asked for the whole project.</summary>
        public bool WholeProject { get; set; }
        /// <summary>The glossaries the queued requests asked for.</summary>
        public List<string> GlossaryIds { get; set; } = new();
    }
}
