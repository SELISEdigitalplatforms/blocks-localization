using Eurolm.DomainService.Repositories;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using Xunit;

namespace XUnitTest.Repositories
{
    public class TenantIndexInitializerTests
    {
        public class Doc
        {
            public string Id { get; set; } = "";
            public string KeyName { get; set; } = "";
            public string ItemId { get; set; } = "";
            public string[] GlossaryIds { get; set; } = Array.Empty<string>();
        }

        private static TenantIndexInitializer<Doc> NewInitializer() => new("Docs",
            new CreateIndexModel<Doc>(Builders<Doc>.IndexKeys.Ascending(d => d.GlossaryIds), new CreateIndexOptions { Name = "ix_keys_glossaryids" }),
            new CreateIndexModel<Doc>(Builders<Doc>.IndexKeys.Ascending(d => d.KeyName).Ascending(d => d.ItemId), new CreateIndexOptions { Name = "ix_keys_keyname_id" }));

        /// <summary>A collection whose listIndexes returns <paramref name="existing"/>; created index batches are captured.</summary>
        private static (Mock<IMongoCollection<Doc>> Collection, List<List<CreateIndexModel<Doc>>> Created) NewCollection(params BsonDocument[] existing)
        {
            var cursor = new Mock<IAsyncCursor<BsonDocument>>();
            cursor.SetupSequence(c => c.MoveNextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(true).ReturnsAsync(false);
            cursor.SetupSequence(c => c.MoveNext(It.IsAny<CancellationToken>())).Returns(true).Returns(false);
            cursor.Setup(c => c.Current).Returns(existing);

            var created = new List<List<CreateIndexModel<Doc>>>();
            var indexes = new Mock<IMongoIndexManager<Doc>>();
            indexes.Setup(x => x.ListAsync(It.IsAny<CancellationToken>())).ReturnsAsync(cursor.Object);
            indexes
                .Setup(x => x.CreateManyAsync(It.IsAny<IEnumerable<CreateIndexModel<Doc>>>(), It.IsAny<CancellationToken>()))
                .Callback<IEnumerable<CreateIndexModel<Doc>>, CancellationToken>((models, _) => created.Add(models.ToList()))
                .ReturnsAsync(new List<string>());

            var collection = new Mock<IMongoCollection<Doc>>();
            collection.Setup(x => x.Indexes).Returns(indexes.Object);
            return (collection, created);
        }

        private static BsonDocument Index(string name, BsonDocument key) => new() { { "v", 2 }, { "key", key }, { "name", name } };

        [Fact]
        public async Task Same_fields_under_another_name_is_kept_and_not_recreated()
        {
            // The tenant from the dev logs: a dump-restored index named blk_lkey_glossaryids, stored as 1.0.
            var (collection, created) = NewCollection(
                Index("_id_", new BsonDocument("_id", 1)),
                Index("blk_lkey_glossaryids", new BsonDocument("GlossaryIds", 1.0)));

            var ok = await NewInitializer().EnsureAsync("t", collection.Object, NullLogger.Instance);

            ok.Should().BeTrue();
            created.Should().ContainSingle()
                .Which.Select(m => m.Options.Name).Should().Equal("ix_keys_keyname_id");
        }

        [Fact]
        public async Task Nothing_is_sent_when_every_index_already_exists()
        {
            var (collection, created) = NewCollection(
                Index("blk_lkey_glossaryids", new BsonDocument("GlossaryIds", 1)),
                Index("ix_keys_keyname_id", new BsonDocument { { "KeyName", 1 }, { "ItemId", 1 } }));

            var ok = await NewInitializer().EnsureAsync("t", collection.Object, NullLogger.Instance);

            ok.Should().BeTrue();
            created.Should().BeEmpty();
        }

        [Fact]
        public async Task A_prefix_or_reordered_or_reversed_index_does_not_count_as_existing()
        {
            var (collection, created) = NewCollection(
                Index("blk_lkey_keyname", new BsonDocument("KeyName", 1)),                                  // prefix only
                Index("other_order", new BsonDocument { { "ItemId", 1 }, { "KeyName", 1 } }),              // different order
                Index("glossary_desc", new BsonDocument("GlossaryIds", -1)));                               // other direction

            await NewInitializer().EnsureAsync("t", collection.Object, NullLogger.Instance);

            created.Should().ContainSingle()
                .Which.Select(m => m.Options.Name).Should().BeEquivalentTo("ix_keys_glossaryids", "ix_keys_keyname_id");
        }

        [Fact]
        public async Task A_failing_listIndexes_is_reported_as_failure()
        {
            var indexes = new Mock<IMongoIndexManager<Doc>>();
            indexes.Setup(x => x.ListAsync(It.IsAny<CancellationToken>())).ThrowsAsync(new InvalidOperationException("not authorized"));
            var collection = new Mock<IMongoCollection<Doc>>();
            collection.Setup(x => x.Indexes).Returns(indexes.Object);

            var ok = await NewInitializer().EnsureAsync("t", collection.Object, NullLogger.Instance);

            ok.Should().BeFalse();
            indexes.Verify(x => x.CreateManyAsync(It.IsAny<IEnumerable<CreateIndexModel<Doc>>>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Theory]
        [InlineData("{ GlossaryIds: 1 }", "GlossaryIds:1")]
        [InlineData("{ GlossaryIds: 1.0 }", "GlossaryIds:1")]
        [InlineData("{ GlossaryIds: NumberLong(1) }", "GlossaryIds:1")]
        [InlineData("{ LastUpdateDate: -1 }", "LastUpdateDate:-1")]
        [InlineData("{ KeyName: 1, ItemId: 1 }", "KeyName:1,ItemId:1")]
        [InlineData("{ Name: 'text' }", "Name:text")]
        public void KeySignature_normalises_numeric_directions(string keys, string expected)
        {
            TenantIndexInitializer<Doc>.KeySignature(BsonDocument.Parse(keys)).Should().Be(expected);
        }
    }
}
