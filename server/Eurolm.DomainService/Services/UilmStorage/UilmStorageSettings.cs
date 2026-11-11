using MongoDB.Bson.Serialization.Attributes;

namespace Eurolm.DomainService.Services.UilmStorage
{
    /// <summary>
    /// The tenant's single <c>UilmStorageSettings</c> document, set by operations. A missing document or field means
    /// on: only an explicit <c>PublishToStorage: false</c> opts a tenant out, and only an explicit
    /// <c>KeepContent: false</c> stops writing <c>Content</c> (#349 §6.1, Q1).
    /// </summary>
    [BsonIgnoreExtraElements]
    public class UilmStorageSettings
    {
        public const string DefaultId = "default";

        [BsonId]
        public string Id { get; set; } = DefaultId;

        /// <summary>False opts the tenant out of Storage publishing, backfill and content removal.</summary>
        public bool? PublishToStorage { get; set; }

        /// <summary>
        /// False stops writing <c>Content</c> on pointer rows with a file, and lets maintenance remove it from rows whose
        /// file is verified. Set it per tenant only after that tenant has no legacy rows left.
        /// </summary>
        public bool? KeepContent { get; set; }

        /// <summary>When maintenance last reconciled the ledger with the pointers (at most once per interval).</summary>
        public DateTime? LastReconcileAt { get; set; }
    }

    /// <summary>The tenant's effective switches, with the defaults of a missing document or field applied.</summary>
    public readonly record struct UilmStorageMode(bool PublishToStorage, bool KeepContent)
    {
        public static UilmStorageMode From(UilmStorageSettings? settings) =>
            new(settings?.PublishToStorage != false, settings?.KeepContent != false);
    }
}
