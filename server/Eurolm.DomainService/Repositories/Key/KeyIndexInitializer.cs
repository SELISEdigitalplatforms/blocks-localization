using Eurolm.DomainService.Services;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace Eurolm.DomainService.Repositories
{
    /// <summary>
    /// Creates the indexes the Key/Gets sorts and filters rely on, once per tenant per process.
    /// The indexes are a performance aid, not a correctness requirement: creation runs in the
    /// background and a failure is only logged, so the list request is never blocked or failed by it.
    /// A failed attempt drops the tenant's entry, so the next call for that tenant retries.
    /// </summary>
    public static class KeyIndexInitializer
    {
        private static readonly TenantIndexInitializer<Key> _initializer = new("BlocksLanguageKeys",
            Model("ix_keys_keyname_id", Builders<Key>.IndexKeys.Ascending(k => k.KeyName).Ascending(k => k.ItemId)),
            Model("ix_keys_createdate_id", Builders<Key>.IndexKeys.Ascending(k => k.CreateDate).Ascending(k => k.ItemId)),
            Model("ix_keys_lastupdatedate_id", Builders<Key>.IndexKeys.Ascending(k => k.LastUpdateDate).Ascending(k => k.ItemId)),
            Model("ix_keys_moduleid_keyname_id", Builders<Key>.IndexKeys.Ascending(k => k.ModuleId).Ascending(k => k.KeyName).Ascending(k => k.ItemId)),
            Model("ix_keys_glossaryids", Builders<Key>.IndexKeys.Ascending(k => k.GlossaryIds)),
            // Usage, delete and the re-check match keys by a stored violation's glossary as well as by tag.
            Model("ix_keys_glossaryviolations_glossaryid", Builders<Key>.IndexKeys.Ascending("GlossaryViolations.GlossaryId")));

        public static IReadOnlyList<CreateIndexModel<Key>> Indexes => _initializer.Indexes;

        /// <inheritdoc cref="TenantIndexInitializer{TDocument}.EnsureStarted"/>
        public static Task EnsureStarted(string tenantId, IMongoCollection<Key> collection, ILogger logger) =>
            _initializer.EnsureStarted(tenantId, collection, logger);

        /// <inheritdoc cref="TenantIndexInitializer{TDocument}.EnsureAsync"/>
        public static Task<bool> EnsureAsync(string tenantId, IMongoCollection<Key> collection, ILogger logger) =>
            _initializer.EnsureAsync(tenantId, collection, logger);

        private static CreateIndexModel<Key> Model(string name, IndexKeysDefinition<Key> keys) =>
            new(keys, new CreateIndexOptions { Name = name });
    }
}
