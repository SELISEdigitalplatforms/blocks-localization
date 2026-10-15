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
        /// <param name="prepareRetry">
        /// Optional: adjusts the operations before the retry, for example to point a replacement at
        /// the row the concurrent writer created.
        /// </param>
        public static async Task<(long Upserted, long Modified)> BulkWriteAsync<T>(
            IMongoCollection<T> collection, IReadOnlyList<WriteModel<T>> operations,
            Func<IReadOnlyList<WriteModel<T>>, Task<IReadOnlyList<WriteModel<T>>>>? prepareRetry = null)
        {
            try
            {
                var result = await collection.BulkWriteAsync(operations);
                return Counts(result);
            }
            catch (MongoBulkWriteException<T> ex) when (IsOnlyDuplicateKeyErrors(ex))
            {
                // An ordered bulk write stops at its first error, so everything after it is also unprocessed.
                IReadOnlyList<WriteModel<T>> retry = ex.WriteErrors.Select(error => operations[error.Index])
                    .Concat(ex.UnprocessedRequests)
                    .ToList();
                if (prepareRetry != null)
                {
                    retry = await prepareRetry(retry);
                }

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

        // MongoDB retries an upsert itself when its filter matches the unique index fields. If the
        // concurrent writer's row then has a different _id than the replacement, the conflict
        // surfaces as ImmutableField (66) instead of DuplicateKey (11000). Both mean "someone else
        // created this key first".
        private const int ImmutableFieldCode = 66;

        private static bool IsConcurrentInsertConflict(ServerErrorCategory category, int code) =>
            category == ServerErrorCategory.DuplicateKey || code == ImmutableFieldCode;

        public static bool IsOnlyDuplicateKeyErrors<T>(MongoBulkWriteException<T> ex) =>
            ex.WriteConcernError == null
            && ex.WriteErrors.Count > 0
            && ex.WriteErrors.All(error => IsConcurrentInsertConflict(error.Category, error.Code));

        public static bool IsDuplicateKey(Exception ex) =>
            ex is MongoWriteException { WriteError: { } error } && IsConcurrentInsertConflict(error.Category, error.Code);
    }
}
