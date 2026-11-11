using Blocks.Genesis;
using Eurolm.DomainService.Services.UilmStorage;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Driver;

namespace Eurolm.DomainService.Repositories.UilmStorage
{
    public class UilmStoredFileRepository : IUilmStoredFileRepository
    {
        public const string CollectionName = "UilmStoredFiles";

        private static readonly IReadOnlyList<CreateIndexModel<UilmStoredFile>> Indexes =
        [
            new(Builders<UilmStoredFile>.IndexKeys.Ascending(f => f.State).Ascending(f => f.DeleteAfter),
                new CreateIndexOptions { Name = "State_1_DeleteAfter_1" })
        ];

        private readonly IDbContextProvider _dbContextProvider;
        private readonly ILogger<UilmStoredFileRepository> _logger;

        public UilmStoredFileRepository(IDbContextProvider dbContextProvider, ILogger<UilmStoredFileRepository>? logger = null)
        {
            _dbContextProvider = dbContextProvider;
            _logger = logger ?? NullLogger<UilmStoredFileRepository>.Instance;
        }

        private IMongoCollection<UilmStoredFile> Collection()
        {
            var database = UilmTenantDatabase.Current(_dbContextProvider);
            _ = MongoIndexEnsurer.EnsureAsync(database, CollectionName, Indexes, _logger);
            return database.GetCollection<UilmStoredFile>(CollectionName);
        }

        private static FilterDefinition<UilmStoredFile> ById(IReadOnlyCollection<string> fileIds) =>
            Builders<UilmStoredFile>.Filter.In(f => f.Id, fileIds);

        public Task InsertAsync(UilmStoredFile file) => Collection().InsertOneAsync(file);

        public async Task<bool> ExistsAsync(string fileId) =>
            await Collection().Find(f => f.Id == fileId).Project(f => f.Id).FirstOrDefaultAsync() != null;

        public async Task MarkLiveAsync(IReadOnlyCollection<string> fileIds, string? fromState = null)
        {
            if (fileIds.Count == 0) return;
            var filter = fromState == null ? ById(fileIds) : ById(fileIds) & Builders<UilmStoredFile>.Filter.Eq(f => f.State, fromState);
            await Collection().UpdateManyAsync(filter, Builders<UilmStoredFile>.Update
                .Set(f => f.State, UilmStoredFileState.Live)
                .Set(f => f.DeleteAfter, null)
                .Set(f => f.LeaseUntil, null));
        }

        public async Task RetireAsync(IReadOnlyCollection<string> fileIds, DateTime deleteAfter)
        {
            if (fileIds.Count == 0) return;
            await Collection().UpdateManyAsync(ById(fileIds), Retire(deleteAfter));
        }

        public async Task<long> RetireFromStateAsync(IReadOnlyCollection<string> fileIds, string fromState, DateTime deleteAfter)
        {
            if (fileIds.Count == 0) return 0;
            var filter = ById(fileIds) & Builders<UilmStoredFile>.Filter.Eq(f => f.State, fromState);
            var result = await Collection().UpdateManyAsync(filter, Retire(deleteAfter));
            return result.ModifiedCount;
        }

        private static UpdateDefinition<UilmStoredFile> Retire(DateTime deleteAfter) => Builders<UilmStoredFile>.Update
            .Set(f => f.State, UilmStoredFileState.Retired)
            .Set(f => f.DeleteAfter, deleteAfter)
            .Set(f => f.LeaseUntil, null);

        public Task<UilmStoredFile?> ClaimDueAsync(DateTime now, DateTime leaseUntil)
        {
            var filter = Builders<UilmStoredFile>.Filter.Eq(f => f.State, UilmStoredFileState.Retired)
                & Builders<UilmStoredFile>.Filter.Lte(f => f.DeleteAfter, now)
                & (Builders<UilmStoredFile>.Filter.Eq(f => f.LeaseUntil, null) | Builders<UilmStoredFile>.Filter.Lt(f => f.LeaseUntil, now));
            return Collection().FindOneAndUpdateAsync<UilmStoredFile?>(
                filter,
                Builders<UilmStoredFile>.Update.Set(f => f.LeaseUntil, leaseUntil),
                new FindOneAndUpdateOptions<UilmStoredFile, UilmStoredFile?>
                {
                    Sort = Builders<UilmStoredFile>.Sort.Ascending(f => f.DeleteAfter),
                    ReturnDocument = ReturnDocument.After
                });
        }

        public Task RemoveAsync(string fileId) => Collection().DeleteOneAsync(f => f.Id == fileId);

        public async Task<int> RecordFailedDeleteAsync(string fileId, DateTime runStartedAt)
        {
            var updated = await Collection().FindOneAndUpdateAsync<UilmStoredFile?>(
                Builders<UilmStoredFile>.Filter.Eq(f => f.Id, fileId),
                Builders<UilmStoredFile>.Update.Inc(f => f.Attempts, 1).Set(f => f.LeaseUntil, runStartedAt),
                new FindOneAndUpdateOptions<UilmStoredFile, UilmStoredFile?> { ReturnDocument = ReturnDocument.After });
            return updated?.Attempts ?? 0;
        }

        public Task<List<string>> GetIdsAsync(string state, DateTime createdBefore, string? afterId, int limit)
        {
            var filter = Builders<UilmStoredFile>.Filter.Eq(f => f.State, state)
                & Builders<UilmStoredFile>.Filter.Lt(f => f.CreatedAt, createdBefore);
            if (afterId != null)
            {
                filter &= Builders<UilmStoredFile>.Filter.Gt(f => f.Id, afterId);
            }
            return Collection().Find(filter)
                .Sort(Builders<UilmStoredFile>.Sort.Ascending(f => f.Id))
                .Limit(limit)
                .Project(f => f.Id)
                .ToListAsync();
        }
    }
}
