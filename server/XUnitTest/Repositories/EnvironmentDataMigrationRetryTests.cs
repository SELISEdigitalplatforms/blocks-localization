using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using FluentAssertions;
using MongoDB.Driver;
using Moq;
using Xunit;
using XUnitTest.Shared;

namespace XUnitTest.Repositories
{
    /// <summary>
    /// When a concurrent writer creates a key between the migration's lookup and its overwrite, the
    /// retried replacement must take over that writer's _id: a replacement can't change _id.
    /// </summary>
    public class EnvironmentDataMigrationRetryTests
    {
        private readonly Mock<IDbContextProvider> _dbContextProvider = new();
        private readonly Mock<IMongoDatabase> _database = new();
        private readonly Mock<IMongoCollection<BlocksLanguageKey>> _keys = new();
        private readonly List<List<WriteModel<BlocksLanguageKey>>> _calls = new();
        private readonly EnvironmentDataMigrationRepository _repo;

        public EnvironmentDataMigrationRetryTests()
        {
            _dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(_database.Object);
            _database.Setup(x => x.GetCollection<BlocksLanguageKey>("BlocksLanguageKeys", null)).Returns(_keys.Object);
            _repo = new EnvironmentDataMigrationRepository(_dbContextProvider.Object);
        }

        [Fact]
        public async Task An_overwrite_that_lost_the_insert_race_replaces_the_winners_row()
        {
            var winner = new BlocksLanguageKey { ItemId = "winner-id", ModuleId = "tm1", KeyName = "save" };
            MockCursorHelper.SetupFindAsync(_keys, new List<BlocksLanguageKey> { winner });
            var attempt = 0;
            _keys.Setup(x => x.BulkWriteAsync(It.IsAny<IEnumerable<WriteModel<BlocksLanguageKey>>>(), It.IsAny<BulkWriteOptions>(), It.IsAny<CancellationToken>()))
                .Returns<IEnumerable<WriteModel<BlocksLanguageKey>>, BulkWriteOptions, CancellationToken>((ops, _, _) =>
                {
                    var list = ops.ToList();
                    _calls.Add(list.Select(op => (WriteModel<BlocksLanguageKey>)new ReplaceOneModel<BlocksLanguageKey>(
                        ((ReplaceOneModel<BlocksLanguageKey>)op).Filter,
                        new BlocksLanguageKey { ItemId = ((ReplaceOneModel<BlocksLanguageKey>)op).Replacement.ItemId })).ToList());
                    if (attempt++ == 0)
                    {
                        throw MongoExceptionFactory.BulkWrite(new List<WriteModel<BlocksLanguageKey>>(), new[] { MongoExceptionFactory.BulkError(0) }, Enumerable.Empty<WriteModel<BlocksLanguageKey>>());
                    }
                    return Task.FromResult<BulkWriteResult<BlocksLanguageKey>>(
                        new BulkWriteResult<BlocksLanguageKey>.Acknowledged(list.Count, 1, 0, 0, 1, list, new List<BulkWriteUpsert>()));
                });

            var migrated = new BlocksLanguageKey { ItemId = "migration-id", ModuleId = "tm1", KeyName = "save" };
            await _repo.BulkUpsertKeysByModuleNameAndKeyNameAsync(
                new List<BlocksLanguageKey> { migrated }, new List<BlocksLanguageKey>(), new Dictionary<string, string>(), "target", shouldOverwrite: true);

            _calls.Should().HaveCount(2);
            ((ReplaceOneModel<BlocksLanguageKey>)_calls[0].Single()).Replacement.ItemId.Should().Be("migration-id");
            ((ReplaceOneModel<BlocksLanguageKey>)_calls[1].Single()).Replacement.ItemId.Should().Be("winner-id");
        }
    }
}
