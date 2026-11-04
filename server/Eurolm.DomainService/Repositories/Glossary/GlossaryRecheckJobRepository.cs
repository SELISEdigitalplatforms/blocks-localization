using Blocks.Genesis;
using MongoDB.Driver;

namespace Eurolm.DomainService.Repositories
{
    /// <summary>One marker document per tenant database; every operation is a single atomic Mongo call.</summary>
    public class GlossaryRecheckJobRepository : IGlossaryRecheckJobRepository
    {
        public const string CollectionName = "BlocksGlossaryRecheckJobs";

        private readonly IDbContextProvider _dbContextProvider;

        public GlossaryRecheckJobRepository(IDbContextProvider dbContextProvider)
        {
            _dbContextProvider = dbContextProvider;
        }

        private IMongoCollection<GlossaryRecheckJob> Collection(string tenantId) =>
            _dbContextProvider.GetDatabase(tenantId).GetCollection<GlossaryRecheckJob>(CollectionName);

        private static FilterDefinition<GlossaryRecheckJob> MarkerFilter =>
            Builders<GlossaryRecheckJob>.Filter.Eq(j => j.Id, GlossaryRecheckJob.MarkerId);

        public async Task<bool> TryEnqueueAsync(string tenantId, IReadOnlyCollection<string>? glossaryIds, IReadOnlyCollection<string>? moduleIds, DateTime now, TimeSpan staleAfter)
        {
            var collection = Collection(tenantId);
            var updates = new List<UpdateDefinition<GlossaryRecheckJob>> { Builders<GlossaryRecheckJob>.Update.SetOnInsert(j => j.QueuedAt, now) };
            if (glossaryIds == null)
            {
                updates.Add(Builders<GlossaryRecheckJob>.Update.Set(j => j.WholeProject, true));
            }
            else
            {
                updates.Add(Builders<GlossaryRecheckJob>.Update.AddToSetEach(j => j.GlossaryIds, glossaryIds));
                if (moduleIds is { Count: > 0 }) updates.Add(Builders<GlossaryRecheckJob>.Update.AddToSetEach(j => j.ModuleIds, moduleIds));
            }
            var update = Builders<GlossaryRecheckJob>.Update.Combine(updates);

            try
            {
                var upsert = await collection.UpdateOneAsync(MarkerFilter, update, new UpdateOptions { IsUpsert = true });
                if (upsert.UpsertedId != null) return true;
            }
            catch (Exception ex) when (DuplicateKeyRetry.IsDuplicateKey(ex))
            {
                // A concurrent request created the marker first: merge into it.
                await collection.UpdateOneAsync(MarkerFilter, update);
            }

            // A marker this old means its message was lost (or its worker died): take it over and publish again.
            var stale = Builders<GlossaryRecheckJob>.Filter.And(
                MarkerFilter,
                Builders<GlossaryRecheckJob>.Filter.Lt(j => j.QueuedAt, now - staleAfter));
            var takenOver = await collection.UpdateOneAsync(stale, Builders<GlossaryRecheckJob>.Update.Set(j => j.QueuedAt, now));
            return takenOver.ModifiedCount > 0;
        }

        public async Task<GlossaryRecheckJob?> ClaimAsync(string tenantId) =>
            await Collection(tenantId).FindOneAndDeleteAsync(MarkerFilter);

        public async Task<bool> HasQueuedAsync(string tenantId) =>
            await Collection(tenantId).CountDocumentsAsync(MarkerFilter, new CountOptions { Limit = 1 }) > 0;

        public Task ReleaseAsync(string tenantId) => Collection(tenantId).DeleteOneAsync(MarkerFilter);

        private IMongoCollection<GlossaryRecheckLease> LeaseCollection(string tenantId) =>
            _dbContextProvider.GetDatabase(tenantId).GetCollection<GlossaryRecheckLease>(CollectionName);

        public async Task<bool> TryAcquireLeaseAsync(string tenantId, string owner, DateTime now, TimeSpan leaseFor)
        {
            var filterBuilder = Builders<GlossaryRecheckLease>.Filter;
            var filter = filterBuilder.And(
                filterBuilder.Eq(l => l.Id, GlossaryRecheckLease.LeaseId),
                filterBuilder.Or(filterBuilder.Eq(l => l.Owner, owner), filterBuilder.Lt(l => l.LeaseUntil, now)));
            var update = Builders<GlossaryRecheckLease>.Update
                .Set(l => l.Owner, owner)
                .Set(l => l.LeaseUntil, now + leaseFor);

            try
            {
                await LeaseCollection(tenantId).UpdateOneAsync(filter, update, new UpdateOptions { IsUpsert = true });
                return true;
            }
            catch (Exception ex) when (DuplicateKeyRetry.IsDuplicateKey(ex))
            {
                // Another owner holds a live lease, so the upsert tried to insert a second lease document.
                return false;
            }
        }

        public Task ReleaseLeaseAsync(string tenantId, string owner) =>
            LeaseCollection(tenantId).DeleteOneAsync(Builders<GlossaryRecheckLease>.Filter.And(
                Builders<GlossaryRecheckLease>.Filter.Eq(l => l.Id, GlossaryRecheckLease.LeaseId),
                Builders<GlossaryRecheckLease>.Filter.Eq(l => l.Owner, owner)));
    }
}
