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
    public class GlossaryRepositoryTests
    {
        private readonly Mock<IDbContextProvider> _dbContextProvider = new();
        private readonly Mock<IMongoDatabase> _database = new();
        private readonly Mock<IMongoCollection<BlocksGlossary>> _blocksGlossaryCollection = new();
        private readonly GlossaryRepository _repo;

        public GlossaryRepositoryTests()
        {
            TestBlocksContext.Set("glossary-tenant");
            _dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(_database.Object);
            _database.Setup(x => x.GetCollection<BlocksGlossary>(It.IsAny<string>(), null)).Returns(_blocksGlossaryCollection.Object);

            _repo = new GlossaryRepository(_dbContextProvider.Object);
        }

        [Fact]
        public async Task GetAllAsync_WithNoFilters_ReturnsItemsAndCount()
        {
            var items = new List<BlocksGlossary>
            {
                new BlocksGlossary { ItemId = "g1", Name = "API" },
                new BlocksGlossary { ItemId = "g2", Name = "SDK" }
            };
            MockCursorHelper.SetupFindAsync(_blocksGlossaryCollection, items);
            MockCursorHelper.SetupCountDocuments(_blocksGlossaryCollection, 2);

            var result = await _repo.GetAllAsync(new GetGlossariesRequest { PageNumber = 0, PageSize = 10 });

            result.Items.Should().HaveCount(2);
            result.TotalCount.Should().Be(2);
            _dbContextProvider.Verify(x => x.GetDatabase("glossary-tenant"), Times.Once);
        }

        [Fact]
        public async Task GetAllAsync_WithAllFilters_AppliesFiltersAndReturns()
        {
            var items = new List<BlocksGlossary> { new BlocksGlossary { ItemId = "g1", Name = "API", IsGlobal = true } };
            MockCursorHelper.SetupFindAsync(_blocksGlossaryCollection, items);
            MockCursorHelper.SetupCountDocuments(_blocksGlossaryCollection, 1);

            var request = new GetGlossariesRequest
            {
                PageNumber = 0,
                PageSize = 5,
                SearchText = "AP",
                IsGlobal = true,
                ModuleId = "mod-1"
            };
            var result = await _repo.GetAllAsync(request);

            result.Items.Should().HaveCount(1);
            result.TotalCount.Should().Be(1);
        }

        [Fact]
        public async Task GetByIdAsync_WhenFound_ReturnsGlossary()
        {
            MockCursorHelper.SetupFindAsync(_blocksGlossaryCollection, new List<BlocksGlossary> { new BlocksGlossary { ItemId = "g1", Name = "API" } });

            var result = await _repo.GetByIdAsync("g1");

            result.Should().NotBeNull();
            result!.ItemId.Should().Be("g1");
        }

        [Fact]
        public async Task GetByIdAsync_WhenNotFound_ReturnsNull()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_blocksGlossaryCollection);

            var result = await _repo.GetByIdAsync("missing");

            result.Should().BeNull();
        }

        private static BsonDocument RenderFilter<T>(FilterDefinition<T> filter) =>
            filter.Render(new RenderArgs<T>(BsonSerializer.SerializerRegistry.GetSerializer<T>(), BsonSerializer.SerializerRegistry));

        private static BsonDocument RenderSort<T>(SortDefinition<T> sort) =>
            sort.Render(new RenderArgs<T>(BsonSerializer.SerializerRegistry.GetSerializer<T>(), BsonSerializer.SerializerRegistry));

        private static BsonDocument RenderUpdate<T>(UpdateDefinition<T> update) =>
            update.Render(new RenderArgs<T>(BsonSerializer.SerializerRegistry.GetSerializer<T>(), BsonSerializer.SerializerRegistry)).AsBsonDocument;

        private (Func<FilterDefinition<BlocksGlossary>?> Filter, Func<FindOptions<BlocksGlossary, BlocksGlossary>?> Options) CaptureFind(List<BlocksGlossary> items)
        {
            FilterDefinition<BlocksGlossary>? filter = null;
            FindOptions<BlocksGlossary, BlocksGlossary>? options = null;
            var cursor = MockCursorHelper.CreateCursor(items);
            _blocksGlossaryCollection.Setup(x => x.FindAsync(
                    It.IsAny<FilterDefinition<BlocksGlossary>>(),
                    It.IsAny<FindOptions<BlocksGlossary, BlocksGlossary>>(),
                    It.IsAny<CancellationToken>()))
                .Callback<FilterDefinition<BlocksGlossary>, FindOptions<BlocksGlossary, BlocksGlossary>, CancellationToken>((f, o, _) => { filter = f; options = o; })
                .ReturnsAsync(cursor.Object);
            return (() => filter, () => options);
        }

        [Theory]
        [InlineData("C++ (beta)", @"C\+\+\ \(beta\)")]
        [InlineData(".*", @"\.\*")]
        public async Task GetAllAsync_SearchText_IsEscapedAndCaseInsensitive(string searchText, string escaped)
        {
            var (filter, _) = CaptureFind(new List<BlocksGlossary>());
            MockCursorHelper.SetupCountDocuments(_blocksGlossaryCollection, 0);

            await _repo.GetAllAsync(new GetGlossariesRequest { PageNumber = 0, PageSize = 10, SearchText = searchText });

            var regex = RenderFilter(filter()!)["$or"][0]["Name"].AsBsonRegularExpression;
            regex.Pattern.Should().Be($".*{escaped}.*");
            regex.Options.Should().Be("i");
        }

        [Fact]
        public async Task GetAllAsync_SearchText_MatchesLiterally()
        {
            var (filter, _) = CaptureFind(new List<BlocksGlossary>());
            MockCursorHelper.SetupCountDocuments(_blocksGlossaryCollection, 0);

            await _repo.GetAllAsync(new GetGlossariesRequest { PageNumber = 0, PageSize = 10, SearchText = "C++ (beta)" });

            var regex = RenderFilter(filter()!)["$or"][0]["Name"].AsBsonRegularExpression;
            var dotnet = new System.Text.RegularExpressions.Regex(regex.Pattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            dotnet.IsMatch("my c++ (BETA) term").Should().BeTrue();
            dotnet.IsMatch("c (beta)").Should().BeFalse();
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public async Task GetAllAsync_EmptySearchText_AppliesNoNameFilter(string? searchText)
        {
            var (filter, _) = CaptureFind(new List<BlocksGlossary>());
            MockCursorHelper.SetupCountDocuments(_blocksGlossaryCollection, 0);

            await _repo.GetAllAsync(new GetGlossariesRequest { PageNumber = 0, PageSize = 10, SearchText = searchText });

            RenderFilter(filter()!).ToJson().Should().NotContain("Name");
        }

        [Fact]
        public async Task GetAllAsync_SortsByCreateDateThenItemIdDescending()
        {
            var (_, options) = CaptureFind(new List<BlocksGlossary>());
            MockCursorHelper.SetupCountDocuments(_blocksGlossaryCollection, 0);

            await _repo.GetAllAsync(new GetGlossariesRequest { PageNumber = 1, PageSize = 2 });

            RenderSort(options()!.Sort).ToJson().Should().Be(BsonDocument.Parse("{ CreateDate: -1, _id: -1 }").ToJson());
            options()!.Skip.Should().Be(2);
            options()!.Limit.Should().Be(2);
        }

        [Fact]
        public async Task GetByNameInsensitiveAsync_QueriesCaseInsensitiveRegexForNfcAndNfd()
        {
            var (filter, _) = CaptureFind(new List<BlocksGlossary>());

            await _repo.GetByNameInsensitiveAsync("  Café ");

            // Legacy documents (no NormalizedName) are matched by the Phase 5 regex.
            var regex = RenderFilter(filter()!)["$or"][1]["Name"].AsBsonRegularExpression;
            regex.Options.Should().Be("i");
            regex.Pattern.Should().StartWith(@"^\s*(?:").And.EndWith(@")\s*$");
            regex.Pattern.Should().Contain("Caf\u00e9").And.Contain("Cafe\u0301");
        }

        [Fact]
        public async Task GetByNameInsensitiveAsync_ConfirmsCandidatesInMemory()
        {
            CaptureFind(new List<BlocksGlossary>
            {
                new BlocksGlossary { ItemId = "nfd", Name = "Cafe\u0301" },
                new BlocksGlossary { ItemId = "upper", Name = " CAFÉ " },
                new BlocksGlossary { ItemId = "other", Name = "Cafe" }
            });

            var result = await _repo.GetByNameInsensitiveAsync("café");

            result.Select(g => g.ItemId).Should().BeEquivalentTo(new[] { "nfd", "upper" });
        }

        [Fact]
        public async Task GetByNameInsensitiveAsync_BlankName_ReturnsEmptyWithoutQuerying()
        {
            var result = await _repo.GetByNameInsensitiveAsync("   ");

            result.Should().BeEmpty();
            _dbContextProvider.Verify(x => x.GetDatabase(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task GetStoredByIdAsync_ReturnsStoredEntity()
        {
            MockCursorHelper.SetupFindAsync(_blocksGlossaryCollection, new List<BlocksGlossary> { new BlocksGlossary { ItemId = "g1", CreatedBy = "a", Version = 3 } });

            var result = await _repo.GetStoredByIdAsync("g1");

            result!.CreatedBy.Should().Be("a");
            result.Version.Should().Be(3);
        }

        [Fact]
        public async Task GetByIdsAsync_WithNullList_ReturnsEmptyWithoutQuerying()
        {
            var result = await _repo.GetByIdsAsync(null);

            result.Should().BeEmpty();
            _dbContextProvider.Verify(x => x.GetDatabase(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task GetByIdsAsync_WithEmptyList_ReturnsEmptyWithoutQuerying()
        {
            var result = await _repo.GetByIdsAsync(new List<string>());

            result.Should().BeEmpty();
            _dbContextProvider.Verify(x => x.GetDatabase(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task GetByIdsAsync_WithIds_ReturnsMatches()
        {
            var items = new List<BlocksGlossary> { new BlocksGlossary { ItemId = "g1", Name = "API" }, new BlocksGlossary { ItemId = "g2", Name = "SDK" } };
            MockCursorHelper.SetupFindAsync(_blocksGlossaryCollection, items);

            var result = await _repo.GetByIdsAsync(new List<string> { "g1", "g2" });

            result.Should().HaveCount(2);
        }

        [Fact]
        public async Task InsertAsync_InsertsGlossary()
        {
            var glossary = new BlocksGlossary { ItemId = "g1", Name = "API", Version = 1 };

            await _repo.InsertAsync(glossary);

            _blocksGlossaryCollection.Verify(x => x.InsertOneAsync(glossary, It.IsAny<InsertOneOptions>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        private Func<(FilterDefinition<BlocksGlossary>? Filter, ReplaceOptions? Options)> CaptureReplace(long matched)
        {
            FilterDefinition<BlocksGlossary>? filter = null;
            ReplaceOptions? options = null;
            _blocksGlossaryCollection.Setup(x => x.ReplaceOneAsync(
                    It.IsAny<FilterDefinition<BlocksGlossary>>(),
                    It.IsAny<BlocksGlossary>(),
                    It.IsAny<ReplaceOptions>(),
                    It.IsAny<CancellationToken>()))
                .Callback<FilterDefinition<BlocksGlossary>, BlocksGlossary, ReplaceOptions, CancellationToken>((f, _, o, _) => { filter = f; options = o; })
                .ReturnsAsync(new ReplaceOneResult.Acknowledged(matched, matched, null));
            return () => (filter, options);
        }

        [Fact]
        public async Task ReplaceAsync_WithoutVersion_FiltersByIdOnlyAndNeverUpserts()
        {
            var captured = CaptureReplace(1);

            var matched = await _repo.ReplaceAsync(new BlocksGlossary { ItemId = "g1", Name = "API" }, null);

            matched.Should().BeTrue();
            captured().Options!.IsUpsert.Should().BeFalse();
            RenderFilter(captured().Filter!).ToJson().Should().Be(BsonDocument.Parse("{ _id: 'g1' }").ToJson());
        }

        [Fact]
        public async Task ReplaceAsync_WithVersion_FiltersByIdAndVersionAndNeverUpserts()
        {
            var captured = CaptureReplace(1);

            await _repo.ReplaceAsync(new BlocksGlossary { ItemId = "g1", Name = "API", Version = 5 }, 4);

            captured().Options!.IsUpsert.Should().BeFalse();
            RenderFilter(captured().Filter!).ToJson().Should().Be(BsonDocument.Parse("{ _id: 'g1', Version: 4 }").ToJson());
        }

        [Fact]
        public async Task ReplaceAsync_WithVersionZero_AlsoMatchesDocumentsWithoutVersion()
        {
            var captured = CaptureReplace(1);

            await _repo.ReplaceAsync(new BlocksGlossary { ItemId = "g1", Name = "API", Version = 1 }, 0);

            captured().Options!.IsUpsert.Should().BeFalse();
            var rendered = RenderFilter(captured().Filter!).ToJson();
            rendered.Should().Contain("\"_id\" : \"g1\"");
            rendered.Should().Contain("\"Version\" : 0").And.Contain("\"Version\" : { \"$exists\" : false }").And.Contain("$or");
        }

        [Fact]
        public async Task ReplaceAsync_WhenNothingMatched_ReturnsFalse()
        {
            CaptureReplace(0);

            var matched = await _repo.ReplaceAsync(new BlocksGlossary { ItemId = "g1", Name = "API" }, 2);

            matched.Should().BeFalse();
        }

        private Func<(FilterDefinition<BlocksGlossary>? Filter, UpdateDefinition<BlocksGlossary>? Update)> CaptureUpdateOne()
        {
            FilterDefinition<BlocksGlossary>? filter = null;
            UpdateDefinition<BlocksGlossary>? update = null;
            _blocksGlossaryCollection.Setup(x => x.UpdateOneAsync(
                    It.IsAny<FilterDefinition<BlocksGlossary>>(),
                    It.IsAny<UpdateDefinition<BlocksGlossary>>(),
                    It.IsAny<UpdateOptions>(),
                    It.IsAny<CancellationToken>()))
                .Callback<FilterDefinition<BlocksGlossary>, UpdateDefinition<BlocksGlossary>, UpdateOptions, CancellationToken>((f, u, _, _) => { filter = f; update = u; })
                .ReturnsAsync(new UpdateResult.Acknowledged(1, 1, null));
            return () => (filter, update);
        }

        [Theory]
        [InlineData(true, "$addToSet")]
        [InlineData(false, "$pull")]
        public async Task AddRemoveModuleAsync_ChangeOnlyModuleIdsVersionAndLastUpdate(bool add, string moduleOperator)
        {
            var captured = CaptureUpdateOne();

            if (add) await _repo.AddModuleAsync("g1", "mod-1");
            else await _repo.RemoveModuleAsync("g1", "mod-1");

            RenderFilter(captured().Filter!).ToJson().Should().Be(BsonDocument.Parse("{ _id: 'g1' }").ToJson());
            var update = RenderUpdate(captured().Update!);
            update.Names.Should().BeEquivalentTo(new[] { moduleOperator, "$inc", "$set" });
            update[moduleOperator].AsBsonDocument.ToJson().Should().Be(BsonDocument.Parse("{ ModuleIds: 'mod-1' }").ToJson());
            update["$inc"].AsBsonDocument.ToJson().Should().Be(BsonDocument.Parse("{ Version: 1 }").ToJson());
            update["$set"].AsBsonDocument.Names.Should().BeEquivalentTo(new[] { "LastUpdateDate", "LastUpdatedBy" });
            update["$set"]["LastUpdatedBy"].AsString.Should().Be("test-user");
            _blocksGlossaryCollection.Verify(x => x.ReplaceOneAsync(
                It.IsAny<FilterDefinition<BlocksGlossary>>(), It.IsAny<BlocksGlossary>(), It.IsAny<ReplaceOptions>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public void Version_MissingInStoredDocument_DeserializesAsZero()
        {
            var doc = new BsonDocument { { "_id", "g1" }, { "Name", "API" }, { "IsGlobal", true } };

            BsonSerializer.Deserialize<Glossary>(doc).Version.Should().Be(0);
            BsonSerializer.Deserialize<BlocksGlossary>(doc).Version.Should().Be(0);
        }

        [Fact]
        public void Version_StoredInDocument_IsReturned()
        {
            var doc = new BsonDocument { { "_id", "g1" }, { "Name", "API" }, { "Version", 7 } };

            BsonSerializer.Deserialize<Glossary>(doc).Version.Should().Be(7);
        }

        [Fact]
        public async Task GetGlobalAsync_UsesProjectKeyAndReturnsGlobals()
        {
            var items = new List<BlocksGlossary> { new BlocksGlossary { ItemId = "g1", Name = "API", IsGlobal = true } };
            MockCursorHelper.SetupFindAsync(_blocksGlossaryCollection, items);

            var result = await _repo.GetGlobalAsync("proj-x");

            result.Should().HaveCount(1);
            _dbContextProvider.Verify(x => x.GetDatabase("proj-x"), Times.Once);
        }

        [Fact]
        public async Task GetByModuleIdAsync_UsesProjectKeyAndReturnsMatches()
        {
            var items = new List<BlocksGlossary> { new BlocksGlossary { ItemId = "g1", Name = "API", ModuleIds = new List<string> { "mod-1" } } };
            MockCursorHelper.SetupFindAsync(_blocksGlossaryCollection, items);

            var result = await _repo.GetByModuleIdAsync("proj-x", "mod-1");

            result.Should().HaveCount(1);
            _dbContextProvider.Verify(x => x.GetDatabase("proj-x"), Times.Once);
        }

        [Fact]
        public async Task DeleteAsync_CallsDeleteOneAsync()
        {
            _blocksGlossaryCollection.Setup(x => x.DeleteOneAsync(
                It.IsAny<FilterDefinition<BlocksGlossary>>(),
                It.IsAny<CancellationToken>())).ReturnsAsync(Mock.Of<DeleteResult>());

            await _repo.DeleteAsync("g1");

            _blocksGlossaryCollection.Verify(x => x.DeleteOneAsync(
                It.IsAny<FilterDefinition<BlocksGlossary>>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        #region Phase 6

        private async Task<BsonDocument> RenderGetsFilter(GetGlossariesRequest request)
        {
            var (filter, _) = CaptureFind(new List<BlocksGlossary>());
            MockCursorHelper.SetupCountDocuments(_blocksGlossaryCollection, 0);
            await _repo.GetAllAsync(request);
            return RenderFilter(filter()!);
        }

        [Fact]
        public async Task GetByIdAsync_LegacyTrackADocument_ResolvesStructuredFieldsAndKeepsRawText()
        {
            var note = "@@glossary-meta:v1@@{\"rule\":\"translate\",\"variants\":[\"workspaces\"],\"translations\":{\"de-DE\":\"Arbeitsbereich\"},\"forbidden\":{\"de-DE\":[\"Werkbereich\"]},\"note\":\"n\"}";
            var context = "A shared space ⟦rule: de-DE→Arbeitsbereich⟧";
            MockCursorHelper.SetupFindAsync(_blocksGlossaryCollection, new List<BlocksGlossary>
            {
                new BlocksGlossary { ItemId = "g1", Name = "Workspace", Context = context, AdditionalNote = note }
            });

            var result = await _repo.GetByIdAsync("g1");

            result.Rule.Should().Be("translate");
            result.Variants.Should().Equal("workspaces");
            result.Translations.Should().ContainSingle(t => t.Language == "de-DE" && t.Value == "Arbeitsbereich" && t.ForbiddenValues.SequenceEqual(new[] { "Werkbereich" }));
            result.Status.Should().Be("approved");
            result.SchemaVersion.Should().Be(0);
            // context and additionalNote are returned exactly as stored until migration.
            result.Context.Should().Be(context);
            result.AdditionalNote.Should().Be(note);
        }

        [Fact]
        public async Task GetAllAsync_StructuredDocument_ReturnsStoredFieldsIncludingInactiveValues()
        {
            MockCursorHelper.SetupFindAsync(_blocksGlossaryCollection, new List<BlocksGlossary>
            {
                new BlocksGlossary
                {
                    ItemId = "g7", Name = "SELISE", SchemaVersion = 2, Rule = GlossaryRule.Keep, Status = GlossaryStatus.Draft,
                    Translations = new List<GlossaryTranslation> { new() { Language = "de-DE", Value = "Selise GmbH" } }
                }
            });
            MockCursorHelper.SetupCountDocuments(_blocksGlossaryCollection, 1);

            var result = await _repo.GetAllAsync(new GetGlossariesRequest { PageSize = 10 });

            var item = result.Items.Single();
            item.Rule.Should().Be("keep");
            item.Status.Should().Be("draft");
            item.SchemaVersion.Should().Be(2);
            item.Translations.Should().ContainSingle(t => t.Value == "Selise GmbH");
        }

        [Fact]
        public async Task GetAllAsync_SearchText_MatchesNameVariantsAndTranslationValues()
        {
            var rendered = await RenderGetsFilter(new GetGlossariesRequest { PageSize = 10, SearchText = "Arbeits" });

            var or = rendered["$or"].AsBsonArray.Select(c => c.AsBsonDocument.Names.Single()).ToList();
            or.Should().Equal("Name", "Variants", "Translations.Value");
            rendered["$or"][2]["Translations.Value"].AsBsonRegularExpression.Options.Should().Be("i");
        }

        [Fact]
        public async Task GetAllAsync_StatusApproved_IncludesDocumentsWithoutStatus()
        {
            var rendered = (await RenderGetsFilter(new GetGlossariesRequest { PageSize = 10, Status = "approved" })).ToJson();

            rendered.Should().Contain("\"Status\" : \"Approved\"").And.Contain("\"Status\" : null");
        }

        [Theory]
        [InlineData("draft", "Draft")]
        [InlineData("deprecated", "Deprecated")]
        public async Task GetAllAsync_StatusDraftOrDeprecated_MatchesStoredValueOnly(string status, string stored)
        {
            var rendered = await RenderGetsFilter(new GetGlossariesRequest { PageSize = 10, Status = status });

            rendered.ToJson().Should().Be(new BsonDocument("Status", stored).ToJson());
        }

        [Fact]
        public async Task GetAllAsync_RuleFilter_AppliesToStructuredDocumentsOnly()
        {
            var rendered = (await RenderGetsFilter(new GetGlossariesRequest { PageSize = 10, Rule = "keep" })).ToJson();

            rendered.Should().Contain("\"SchemaVersion\" : { \"$gte\" : 2 }").And.Contain("\"Rule\" : \"Keep\"");
        }

        [Fact]
        public async Task GetAllAsync_MissingTranslation_StructuredTranslateTermsWithoutAValue()
        {
            var rendered = (await RenderGetsFilter(new GetGlossariesRequest { PageSize = 10, MissingTranslation = "de-DE" })).ToJson();

            rendered.Should().Contain("\"SchemaVersion\" : { \"$gte\" : 2 }");
            rendered.Should().Contain("$not").And.Contain("\"Language\" : \"de-DE\"");
        }

        [Fact]
        public async Task GetAllAsync_WithoutNewParameters_KeepsTheDefaultFilter()
        {
            var rendered = await RenderGetsFilter(new GetGlossariesRequest { PageSize = 10 });

            rendered.ElementCount.Should().Be(0);
        }

        [Fact]
        public async Task GetByNameInsensitiveAsync_UsesNormalizedNameEqualityWhenStored()
        {
            var (filter, _) = CaptureFind(new List<BlocksGlossary>
            {
                new BlocksGlossary { ItemId = "n1", Name = "Workspace", NormalizedName = "workspace" },
                new BlocksGlossary { ItemId = "n2", Name = "Workspace", NormalizedName = "other" }
            });

            var result = await _repo.GetByNameInsensitiveAsync(" WORKSPACE ");

            RenderFilter(filter()!)["$or"][0].ToJson().Should().Be(new BsonDocument("NormalizedName", "workspace").ToJson());
            result.Select(g => g.ItemId).Should().Equal("n1");
        }

        [Fact]
        public async Task GetStoredByIdsAsync_DeduplicatesAndRunsOneQuery()
        {
            MockCursorHelper.SetupFindAsync(_blocksGlossaryCollection, new List<BlocksGlossary> { new BlocksGlossary { ItemId = "g1" } });

            var result = await _repo.GetStoredByIdsAsync(new[] { "g1", "g1", "" });

            result.Should().HaveCount(1);
            _blocksGlossaryCollection.Verify(x => x.FindAsync(
                It.IsAny<FilterDefinition<BlocksGlossary>>(), It.IsAny<FindOptions<BlocksGlossary, BlocksGlossary>>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task ReplaceManyAsync_FiltersOnTheReadVersionAndNeverUpserts()
        {
            IEnumerable<WriteModel<BlocksGlossary>>? models = null;
            _blocksGlossaryCollection.Setup(x => x.BulkWriteAsync(It.IsAny<IEnumerable<WriteModel<BlocksGlossary>>>(), It.IsAny<BulkWriteOptions>(), It.IsAny<CancellationToken>()))
                .Callback<IEnumerable<WriteModel<BlocksGlossary>>, BulkWriteOptions, CancellationToken>((m, _, _) => models = m.ToList())
                .ReturnsAsync(new BulkWriteResult<BlocksGlossary>.Acknowledged(2, 2, 0, 0, 2, new List<WriteModel<BlocksGlossary>>(), new List<BulkWriteUpsert>()));

            var modified = await _repo.ReplaceManyAsync(new List<(BlocksGlossary, int)>
            {
                (new BlocksGlossary { ItemId = "a" }, 3),
                (new BlocksGlossary { ItemId = "b" }, 0)
            });

            modified.Should().Be(2);
            var replaces = models!.Cast<ReplaceOneModel<BlocksGlossary>>().ToList();
            replaces.Should().OnlyContain(m => !m.IsUpsert);
            RenderFilter(replaces[0].Filter).ToJson().Should().Be(BsonDocument.Parse("{ _id: 'a', Version: 3 }").ToJson());
            RenderFilter(replaces[1].Filter).ToJson().Should().Contain("$exists");
        }

        [Fact]
        public async Task CreateNormalizedNameUniqueIndexAsync_CreatesUniqueNamedIndex()
        {
            var indexes = new Mock<IMongoIndexManager<BlocksGlossary>>();
            CreateIndexModel<BlocksGlossary>? created = null;
            indexes.Setup(x => x.CreateOneAsync(It.IsAny<CreateIndexModel<BlocksGlossary>>(), It.IsAny<CreateOneIndexOptions>(), It.IsAny<CancellationToken>()))
                .Callback<CreateIndexModel<BlocksGlossary>, CreateOneIndexOptions, CancellationToken>((m, _, _) => created = m)
                .ReturnsAsync("ux_normalizedname");
            _blocksGlossaryCollection.Setup(x => x.Indexes).Returns(indexes.Object);

            await _repo.CreateNormalizedNameUniqueIndexAsync();

            created!.Options.Name.Should().Be("ux_normalizedname");
            created.Options.Unique.Should().BeTrue();
        }

        #endregion
    }
}
