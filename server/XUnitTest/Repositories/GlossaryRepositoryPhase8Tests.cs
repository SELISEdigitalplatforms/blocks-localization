using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using Moq;
using Xunit;
using XUnitTest.Shared;

namespace XUnitTest.Repositories
{
    /// <summary>SPEC8 Part B repository additions: Gets parameters (H16, H17, C18, C19), ix_status (H26), bulk tagging (H30).</summary>
    public class GlossaryRepositoryPhase8Tests
    {
        private readonly Mock<IDbContextProvider> _dbContextProvider = new();
        private readonly Mock<IMongoDatabase> _database = new();
        private readonly Mock<IMongoCollection<BlocksGlossary>> _collection = new();
        private readonly GlossaryRepository _repo;

        public GlossaryRepositoryPhase8Tests()
        {
            TestBlocksContext.Set("glossary-tenant");
            _dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(_database.Object);
            _database.Setup(x => x.GetCollection<BlocksGlossary>(It.IsAny<string>(), null)).Returns(_collection.Object);
            _repo = new GlossaryRepository(_dbContextProvider.Object);
        }

        private static BsonDocument Render<T>(FilterDefinition<T> filter) =>
            filter.Render(new RenderArgs<T>(BsonSerializer.SerializerRegistry.GetSerializer<T>(), BsonSerializer.SerializerRegistry));

        private static string Render<T>(SortDefinition<T> sort) =>
            sort.Render(new RenderArgs<T>(BsonSerializer.SerializerRegistry.GetSerializer<T>(), BsonSerializer.SerializerRegistry)).ToJson();

        private async Task<(BsonDocument Filter, string Sort)> RunGets(GetGlossariesRequest request)
        {
            FilterDefinition<BlocksGlossary>? filter = null;
            FindOptions<BlocksGlossary, BlocksGlossary>? options = null;
            var cursor = MockCursorHelper.CreateCursor(new List<BlocksGlossary>());
            _collection.Setup(x => x.FindAsync(It.IsAny<FilterDefinition<BlocksGlossary>>(), It.IsAny<FindOptions<BlocksGlossary, BlocksGlossary>>(), It.IsAny<CancellationToken>()))
                .Callback<FilterDefinition<BlocksGlossary>, FindOptions<BlocksGlossary, BlocksGlossary>, CancellationToken>((f, o, _) => { filter = f; options = o; })
                .ReturnsAsync(cursor.Object);
            MockCursorHelper.SetupCountDocuments(_collection, 0);

            await _repo.GetAllAsync(request);
            return (Render(filter!), Render(options!.Sort));
        }

        private static string Json(string json) => BsonDocument.Parse(json).ToJson();

        [Fact]
        public async Task Without_the_new_parameters_filter_and_sort_are_unchanged_C18()
        {
            var (filter, sort) = await RunGets(new GetGlossariesRequest { PageSize = 10 });

            filter.ElementCount.Should().Be(0);
            sort.Should().Be(Json("{ CreateDate: -1, _id: -1 }"));
        }

        [Fact]
        public async Task Language_filters_on_equality()
        {
            var (filter, _) = await RunGets(new GetGlossariesRequest { Language = " de-DE " });

            filter.ToJson().Should().Be(Json("{ Language: 'de-DE' }"));
        }

        [Fact]
        public async Task Type_is_an_escaped_exact_case_insensitive_match()
        {
            var (filter, _) = await RunGets(new GetGlossariesRequest { Type = "Product (UI)" });

            var regex = filter["Type"].AsBsonRegularExpression;
            regex.Pattern.Should().Be(@"^Product\ \(UI\)$");
            regex.Options.Should().Be("i");
        }

        [Fact]
        public async Task Scope_project_is_global_only()
        {
            var (filter, _) = await RunGets(new GetGlossariesRequest { Scope = "project" });

            filter.ToJson().Should().Be(Json("{ IsGlobal: true }"));
        }

        [Fact]
        public async Task Scope_modules_is_not_global_with_at_least_one_module()
        {
            var (filter, _) = await RunGets(new GetGlossariesRequest { Scope = "Modules" });

            filter.ToJson().Should().Be(Json("{ IsGlobal: { $ne: true }, 'ModuleIds.0': { $exists: true } }"));
        }

        [Fact]
        public async Task Unknown_scope_and_sort_values_are_ignored()
        {
            var (filter, sort) = await RunGets(new GetGlossariesRequest { Scope = "everything", SortBy = "usage" });

            filter.ElementCount.Should().Be(0);
            sort.Should().Be(Json("{ CreateDate: -1, _id: -1 }"));
        }

        [Theory]
        [InlineData("name", null, "{ NormalizedName: 1, _id: 1 }")]
        [InlineData("name", true, "{ NormalizedName: -1, _id: -1 }")]
        [InlineData("createDate", null, "{ CreateDate: -1, _id: -1 }")]
        [InlineData("createDate", false, "{ CreateDate: 1, _id: 1 }")]
        [InlineData("lastUpdateDate", null, "{ LastUpdateDate: -1, _id: -1 }")]
        [InlineData("LASTUPDATEDATE", false, "{ LastUpdateDate: 1, _id: 1 }")]
        public async Task SortBy_and_SortDescending_always_tie_break_on_ItemId_H17(string sortBy, bool? descending, string expected)
        {
            var (_, sort) = await RunGets(new GetGlossariesRequest { SortBy = sortBy, SortDescending = descending });

            sort.Should().Be(Json(expected));
        }

        [Fact]
        public async Task Name_sort_keeps_unmigrated_documents_C19()
        {
            // Sorting never filters: documents without NormalizedName stay in the result (MongoDB sorts missing first ascending).
            var (filter, sort) = await RunGets(new GetGlossariesRequest { SortBy = "name" });

            filter.ElementCount.Should().Be(0);
            sort.Should().StartWith("{ \"NormalizedName\" : 1");
        }

        [Fact]
        public async Task New_filters_combine_with_the_existing_ones()
        {
            var (filter, _) = await RunGets(new GetGlossariesRequest { Language = "de-DE", Scope = "modules", Status = "draft", SearchText = "Work" });

            filter.Names.Should().Contain(new[] { "Language", "IsGlobal", "ModuleIds.0", "Status", "$or" });
        }

        [Fact]
        public void Status_index_is_named_ix_status_H26()
        {
            var registry = BsonSerializer.SerializerRegistry;
            var args = new RenderArgs<BlocksGlossary>(registry.GetSerializer<BlocksGlossary>(), registry);

            GlossaryIndexInitializer.Indexes.Single(m => m.Options.Name == "ix_status")
                .Keys.Render(args).ToJson().Should().Be(Json("{ Status: 1 }"));
        }

        [Fact]
        public async Task UpdateModuleTagsAsync_uses_one_unordered_bulk_write_H30()
        {
            List<WriteModel<BlocksGlossary>>? models = null;
            BulkWriteOptions? options = null;
            _collection.Setup(x => x.BulkWriteAsync(It.IsAny<IEnumerable<WriteModel<BlocksGlossary>>>(), It.IsAny<BulkWriteOptions>(), It.IsAny<CancellationToken>()))
                .Callback<IEnumerable<WriteModel<BlocksGlossary>>, BulkWriteOptions, CancellationToken>((m, o, _) => { models = m.ToList(); options = o; })
                .ReturnsAsync(new BulkWriteResult<BlocksGlossary>.Acknowledged(3, 0, 0, 3, 3, new List<WriteModel<BlocksGlossary>>(), new List<BulkWriteUpsert>()));

            var modified = await _repo.UpdateModuleTagsAsync("mod-1", new[] { "g-add", "g-add2" }, new[] { "g-old" });

            modified.Should().Be(3);
            options!.IsOrdered.Should().BeFalse();
            _collection.Verify(x => x.BulkWriteAsync(It.IsAny<IEnumerable<WriteModel<BlocksGlossary>>>(), It.IsAny<BulkWriteOptions>(), It.IsAny<CancellationToken>()), Times.Once);
            _collection.Verify(x => x.UpdateOneAsync(It.IsAny<FilterDefinition<BlocksGlossary>>(), It.IsAny<UpdateDefinition<BlocksGlossary>>(), It.IsAny<UpdateOptions>(), It.IsAny<CancellationToken>()), Times.Never);

            var updates = models!.Cast<UpdateOneModel<BlocksGlossary>>().ToList();
            updates.Should().HaveCount(3).And.OnlyContain(u => !u.IsUpsert);
            var serializer = BsonSerializer.SerializerRegistry.GetSerializer<BlocksGlossary>();
            var args = new RenderArgs<BlocksGlossary>(serializer, BsonSerializer.SerializerRegistry);
            var rendered = updates.Select(u => (Filter: Render(u.Filter).ToJson(), Update: u.Update.Render(args).AsBsonDocument)).ToList();

            rendered[0].Filter.Should().Be(Json("{ _id: 'g-old' }"));
            rendered[0].Update["$pull"].ToJson().Should().Be(Json("{ ModuleIds: 'mod-1' }"));
            rendered[1].Update["$addToSet"].ToJson().Should().Be(Json("{ ModuleIds: 'mod-1' }"));
            rendered.Should().OnlyContain(r => r.Update["$inc"].ToJson() == Json("{ Version: 1 }"));
            rendered.Should().OnlyContain(r => r.Update["$set"].AsBsonDocument.Names.SequenceEqual(new[] { "LastUpdateDate", "LastUpdatedBy" }));
        }

        [Fact]
        public async Task UpdateModuleTagsAsync_with_nothing_to_change_writes_nothing()
        {
            var modified = await _repo.UpdateModuleTagsAsync("mod-1", Array.Empty<string>(), Array.Empty<string>());

            modified.Should().Be(0);
            _collection.Verify(x => x.BulkWriteAsync(It.IsAny<IEnumerable<WriteModel<BlocksGlossary>>>(), It.IsAny<BulkWriteOptions>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public void PartOfSpeech_and_UsageExamples_are_returned_by_the_mapper()
        {
            var dto = GlossaryMapper.ToDto(new BlocksGlossary
            {
                ItemId = "g1", Name = "Workspace", PartOfSpeech = "noun", UsageExamples = new List<string> { "Open your workspace." }
            });

            dto.PartOfSpeech.Should().Be("noun");
            dto.UsageExamples.Should().Equal("Open your workspace.");
        }
    }
}
