using MongoDB.Bson.Serialization.Attributes;

namespace Eurolm.DomainService.Services.UilmStorage
{
    /// <summary>
    /// The tenant's single <c>UilmStorageSettings</c> document. Operations set <see cref="PublishToStorage"/>;
    /// a missing document means the switch is off.
    /// </summary>
    [BsonIgnoreExtraElements]
    public class UilmStorageSettings
    {
        public const string DefaultId = "default";

        [BsonId]
        public string Id { get; set; } = DefaultId;
        public bool PublishToStorage { get; set; }

        /// <summary>When maintenance last reconciled the ledger with the pointers (at most once per interval).</summary>
        public DateTime? LastReconcileAt { get; set; }
    }
}
