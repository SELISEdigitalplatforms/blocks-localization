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

        public async Task<bool> TryEnqueueAsync(string tenantId, IReadOnlyCollection<string>? glossaryIds, DateTime now, TimeSpan staleAfter)
        {
            var collection = Collection(tenantId);
            var update = Builders<GlossaryRecheckJob>.Update.Combine(
                Builders<GlossaryRecheckJob>.Update.SetOnInsert(j => j.QueuedAt, now),
                glossaryIds == null
                    ? Builders<GlossaryRecheckJob>.Update.Set(j => j.WholeProject, true)
                    : Builders<GlossaryRecheckJob>.Update.AddToSetEach(j => j.GlossaryIds, glossaryIds));

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

        public Task ReleaseAsync(string tenantId) => Collection(tenantId).DeleteOneAsync(MarkerFilter);
    }
}
