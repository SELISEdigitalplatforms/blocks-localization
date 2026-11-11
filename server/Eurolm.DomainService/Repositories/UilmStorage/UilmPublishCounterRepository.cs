using Blocks.Genesis;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver;

namespace Eurolm.DomainService.Repositories.UilmStorage
{
    [BsonIgnoreExtraElements]
    public class UilmPublishCounter
    {
        public const string PublishId = "publish";

        [BsonId]
        public string Id { get; set; } = PublishId;
        public int Value { get; set; }
    }

    public class UilmPublishCounterRepository : IUilmPublishCounterRepository
    {
        public const string CollectionName = "UilmPublishCounters";

        private readonly IDbContextProvider _dbContextProvider;

        public UilmPublishCounterRepository(IDbContextProvider dbContextProvider)
        {
            _dbContextProvider = dbContextProvider;
        }

        public async Task<int> NextVersionAsync(int seed)
        {
            var collection = UilmTenantDatabase.Current(_dbContextProvider).GetCollection<UilmPublishCounter>(CollectionName);
            // One update pipeline, so concurrent publishes never get the same version.
            var stage = new BsonDocument("$set", new BsonDocument("Value", new BsonDocument("$add", new BsonArray
            {
                new BsonDocument("$max", new BsonArray { new BsonDocument("$ifNull", new BsonArray { "$Value", 0 }), seed }),
                1
            })));
            var counter = await collection.FindOneAndUpdateAsync(
                Builders<UilmPublishCounter>.Filter.Eq(c => c.Id, UilmPublishCounter.PublishId),
                new PipelineUpdateDefinition<UilmPublishCounter>(PipelineDefinition<UilmPublishCounter, UilmPublishCounter>.Create(stage)),
                new FindOneAndUpdateOptions<UilmPublishCounter> { IsUpsert = true, ReturnDocument = ReturnDocument.After });
            return counter.Value;
        }
    }
}
