using Blocks.Genesis;
using Eurolm.DomainService.Services.UilmStorage;
using MongoDB.Driver;

namespace Eurolm.DomainService.Repositories.UilmStorage
{
    public class UilmStorageSettingsRepository : IUilmStorageSettingsRepository
    {
        public const string CollectionName = "UilmStorageSettings";

        private readonly IDbContextProvider _dbContextProvider;

        public UilmStorageSettingsRepository(IDbContextProvider dbContextProvider)
        {
            _dbContextProvider = dbContextProvider;
        }

        private IMongoCollection<UilmStorageSettings> Collection() =>
            UilmTenantDatabase.Current(_dbContextProvider).GetCollection<UilmStorageSettings>(CollectionName);

        public async Task<UilmStorageMode> GetModeAsync()
        {
            var settings = await Collection().Find(s => s.Id == UilmStorageSettings.DefaultId).FirstOrDefaultAsync();
            return UilmStorageMode.From(settings);
        }

        public async Task SetKeepContentAsync(bool keepContent)
        {
            var filter = Builders<UilmStorageSettings>.Filter.Eq(s => s.Id, UilmStorageSettings.DefaultId);
            var update = Builders<UilmStorageSettings>.Update.Set(s => s.KeepContent, keepContent);
            try
            {
                await Collection().UpdateOneAsync(filter, update, new UpdateOptions { IsUpsert = true });
            }
            catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
            {
                // A concurrent upsert created the document first; it exists now, so a plain update applies.
                await Collection().UpdateOneAsync(filter, update);
            }
        }

        public async Task<bool> TryStartReconcileAsync(DateTime now, TimeSpan interval)
        {
            // Eq(null) also matches a missing field, so the first run on a tenant (or a document without the
            // field) reconciles. The upsert creates the document without the switches, which then read as on (#349 Q1).
            var filter = Builders<UilmStorageSettings>.Filter.Eq(s => s.Id, UilmStorageSettings.DefaultId)
                & (Builders<UilmStorageSettings>.Filter.Eq(s => s.LastReconcileAt, null)
                   | Builders<UilmStorageSettings>.Filter.Lte(s => s.LastReconcileAt, now - interval));
            try
            {
                var result = await Collection().UpdateOneAsync(
                    filter,
                    Builders<UilmStorageSettings>.Update.Set(s => s.LastReconcileAt, now),
                    new UpdateOptions { IsUpsert = true });
                return result.ModifiedCount > 0 || result.UpsertedId != null;
            }
            catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
            {
                // The document exists and was reconciled within the interval.
                return false;
            }
        }
    }
}
