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
        public bool WholeProject { get; set; }
        public List<string> GlossaryIds { get; set; } = new();
    }
}
