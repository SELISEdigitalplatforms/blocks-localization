using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Eurolm.DomainService.Repositories;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using Xunit;
using XUnitTest.Shared;

namespace XUnitTest.Repositories
{
    /// <summary>
    /// Two imports can both find no row for a new key and both try to insert it. Once the unique
    /// index exists, the loser gets a duplicate-key error; retrying its operations once makes them
    /// match the winner's row. These tests check the retry decision, not MongoDB itself (spec A10).
    /// </summary>
    public class DuplicateKeyRetryTests
    {
        private readonly Mock<IMongoCollection<BsonDocument>> _collection = new();
        private readonly List<List<WriteModel<BsonDocument>>> _calls = new();

        private static List<WriteModel<BsonDocument>> Operations(int count) =>
            Enumerable.Range(0, count)
                .Select(i => (WriteModel<BsonDocument>)new UpdateOneModel<BsonDocument>(
                    new BsonDocument("KeyName", $"k{i}"), new BsonDocument("$set", new BsonDocument("v", i))) { IsUpsert = true })
                .ToList();

        private void Respond(params System.Func<List<WriteModel<BsonDocument>>, BulkWriteResult<BsonDocument>>[] answers)
        {
            var queue = new Queue<System.Func<List<WriteModel<BsonDocument>>, BulkWriteResult<BsonDocument>>>(answers);
            _collection.Setup(x => x.BulkWriteAsync(It.IsAny<IEnumerable<WriteModel<BsonDocument>>>(), It.IsAny<BulkWriteOptions>(), It.IsAny<CancellationToken>()))
                .Returns<IEnumerable<WriteModel<BsonDocument>>, BulkWriteOptions, CancellationToken>((ops, _, _) =>
                {
                    var list = ops.ToList();
                    _calls.Add(list);
                    return Task.FromResult(queue.Dequeue()(list));
                });
        }

        private static BulkWriteResult<BsonDocument> Ok(List<WriteModel<BsonDocument>> ops) =>
            new BulkWriteResult<BsonDocument>.Acknowledged(ops.Count, 0, 0, 0, 0, ops, new List<BulkWriteUpsert>());

        [Fact]
        public async Task A_bulk_write_without_errors_runs_once()
        {
            Respond(Ok);

            await DuplicateKeyRetry.BulkWriteAsync(_collection.Object, Operations(3));

            _calls.Should().ContainSingle().Which.Should().HaveCount(3);
        }

        [Fact]
        public async Task Only_duplicate_key_errors_retry_the_failed_and_unprocessed_operations_once()
        {
            var ops = Operations(4);
            // Ordered write: op 0 succeeded, op 1 hit the index, ops 2 and 3 never ran.
            Respond(_ => throw MongoExceptionFactory.BulkWrite(ops.Take(1).ToList(), new[] { MongoExceptionFactory.BulkError(1) }, ops.Skip(2)), Ok);

            await DuplicateKeyRetry.BulkWriteAsync(_collection.Object, ops);

            _calls.Should().HaveCount(2);
            _calls[1].Should().Equal(ops[1], ops[2], ops[3]);
        }

        [Fact]
        public async Task A_second_duplicate_key_error_propagates()
        {
            var ops = Operations(2);
            Respond(
                _ => throw MongoExceptionFactory.BulkWrite(new List<WriteModel<BsonDocument>>(), new[] { MongoExceptionFactory.BulkError(0) }, ops.Skip(1)),
                _ => throw MongoExceptionFactory.BulkWrite(new List<WriteModel<BsonDocument>>(), new[] { MongoExceptionFactory.BulkError(0) }, ops.Skip(1)));

            var act = () => DuplicateKeyRetry.BulkWriteAsync(_collection.Object, ops);

            await act.Should().ThrowAsync<MongoBulkWriteException<BsonDocument>>();
            _calls.Should().HaveCount(2);
        }

        [Fact]
        public async Task Any_other_error_propagates_without_a_retry()
        {
            var ops = Operations(2);
            Respond(_ => throw MongoExceptionFactory.BulkWrite(new List<WriteModel<BsonDocument>>(),
                new[] { MongoExceptionFactory.BulkError(0), MongoExceptionFactory.BulkError(1, code: 2) }, Enumerable.Empty<WriteModel<BsonDocument>>()));

            var act = () => DuplicateKeyRetry.BulkWriteAsync(_collection.Object, ops);

            await act.Should().ThrowAsync<MongoBulkWriteException<BsonDocument>>();
            _calls.Should().ContainSingle();
        }

        [Fact]
        public void A_single_write_duplicate_key_error_is_recognised()
        {
            DuplicateKeyRetry.IsDuplicateKey(MongoExceptionFactory.DuplicateKeyWrite()).Should().BeTrue();
            DuplicateKeyRetry.IsDuplicateKey(MongoExceptionFactory.Command(11000)).Should().BeFalse();
        }

        [Fact]
        public void An_immutable_id_conflict_from_mongos_own_upsert_retry_counts_as_a_concurrent_insert()
        {
            DuplicateKeyRetry.IsDuplicateKey(MongoExceptionFactory.ImmutableIdWrite()).Should().BeTrue();
            DuplicateKeyRetry.IsDuplicateKey(MongoExceptionFactory.Write(ServerErrorCategory.Uncategorized, 2, "bad value")).Should().BeFalse();
        }

        [Fact]
        public async Task Immutable_id_conflicts_are_retried_like_duplicate_key_errors()
        {
            var ops = Operations(1);
            Respond(_ => throw MongoExceptionFactory.BulkWrite(new List<WriteModel<BsonDocument>>(), new[] { MongoExceptionFactory.BulkError(0, code: 66) }, Enumerable.Empty<WriteModel<BsonDocument>>()), Ok);

            await DuplicateKeyRetry.BulkWriteAsync(_collection.Object, ops);

            _calls.Should().HaveCount(2);
        }

        [Fact]
        public async Task The_retry_can_be_adjusted_before_it_runs()
        {
            var ops = Operations(2);
            var adjusted = Operations(1);
            Respond(_ => throw MongoExceptionFactory.BulkWrite(new List<WriteModel<BsonDocument>>(), new[] { MongoExceptionFactory.BulkError(0) }, ops.Skip(1)), Ok);
            IReadOnlyList<WriteModel<BsonDocument>>? seen = null;

            await DuplicateKeyRetry.BulkWriteAsync(_collection.Object, ops, retry =>
            {
                seen = retry;
                return Task.FromResult<IReadOnlyList<WriteModel<BsonDocument>>>(adjusted);
            });

            seen.Should().Equal(ops[0], ops[1]);
            _calls[1].Should().Equal(adjusted);
        }
    }
}
