using MongoDB.Driver;

namespace Eurolm.DomainService.Repositories
{
    /// <summary>
    /// Retries a bulk upsert once when the unique key index rejected some of its inserts.
    /// Two writers can both find no row and both try to insert; the loser's retry then matches
    /// the winner's row and updates it instead.
    /// </summary>
    public static class DuplicateKeyRetry
    {
        public static async Task<(long Upserted, long Modified)> BulkWriteAsync<T>(
            IMongoCollection<T> collection, IReadOnlyList<WriteModel<T>> operations)
        {
            try
            {
                var result = await collection.BulkWriteAsync(operations);
                return Counts(result);
            }
            catch (MongoBulkWriteException<T> ex) when (IsOnlyDuplicateKeyErrors(ex))
            {
                // An ordered bulk write stops at its first error, so everything after it is also unprocessed.
                var retry = ex.WriteErrors.Select(error => operations[error.Index])
                    .Concat(ex.UnprocessedRequests)
                    .ToList();

                // A second duplicate-key error, or any other error, propagates to the caller.
                var second = await collection.BulkWriteAsync(retry);
                var (firstUpserted, firstModified) = Counts(ex.Result);
                var (secondUpserted, secondModified) = Counts(second);
                return (firstUpserted + secondUpserted, firstModified + secondModified);
            }
        }

        private static (long Upserted, long Modified) Counts<T>(BulkWriteResult<T>? result) =>
            result is { IsAcknowledged: true }
                ? (result.Upserts?.Count ?? 0, result.IsModifiedCountAvailable ? result.ModifiedCount : 0)
                : (0, 0);

        public static bool IsOnlyDuplicateKeyErrors<T>(MongoBulkWriteException<T> ex) =>
            ex.WriteConcernError == null
            && ex.WriteErrors.Count > 0
            && ex.WriteErrors.All(error => error.Category == ServerErrorCategory.DuplicateKey);

        public static bool IsDuplicateKey(Exception ex) =>
            ex is MongoWriteException { WriteError.Category: ServerErrorCategory.DuplicateKey };
    }
}
