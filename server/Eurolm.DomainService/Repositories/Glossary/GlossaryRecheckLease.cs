using MongoDB.Bson.Serialization.Attributes;

namespace Eurolm.DomainService.Repositories
{
    /// <summary>
    /// The tenant's running re-check. Only the owner writes violations; it renews the lease per page, and a
    /// lease that ran out (its worker died) can be taken over.
    /// </summary>
    [BsonIgnoreExtraElements]
    public class GlossaryRecheckLease
    {
        public const string LeaseId = "glossary-recheck-lease";

        [BsonId]
        public string Id { get; set; } = LeaseId;
        public string Owner { get; set; } = "";
        public DateTime LeaseUntil { get; set; }
    }
}
