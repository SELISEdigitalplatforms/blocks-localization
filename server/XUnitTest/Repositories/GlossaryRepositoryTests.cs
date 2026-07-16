using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
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
        private readonly Mock<IMongoCollection<Glossary>> _glossaryCollection = new();
        private readonly Mock<IMongoCollection<BlocksGlossary>> _blocksGlossaryCollection = new();
        private readonly GlossaryRepository _repo;

        public GlossaryRepositoryTests()
        {
            TestBlocksContext.Set("glossary-tenant");
            _dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(_database.Object);
            _database.Setup(x => x.GetCollection<Glossary>(It.IsAny<string>(), null)).Returns(_glossaryCollection.Object);
            _database.Setup(x => x.GetCollection<BlocksGlossary>(It.IsAny<string>(), null)).Returns(_blocksGlossaryCollection.Object);

            _repo = new GlossaryRepository(_dbContextProvider.Object);
        }

        [Fact]
        public async Task GetAllAsync_WithNoFilters_ReturnsItemsAndCount()
        {
            var items = new List<Glossary>
            {
                new Glossary { ItemId = "g1", Name = "API" },
                new Glossary { ItemId = "g2", Name = "SDK" }
            };
            MockCursorHelper.SetupFindAsync(_glossaryCollection, items);
            MockCursorHelper.SetupCountDocuments(_glossaryCollection, 2);

            var result = await _repo.GetAllAsync(new GetGlossariesRequest { PageNumber = 0, PageSize = 10 });

            result.Items.Should().HaveCount(2);
            result.TotalCount.Should().Be(2);
            _dbContextProvider.Verify(x => x.GetDatabase("glossary-tenant"), Times.Once);
        }

        [Fact]
        public async Task GetAllAsync_WithAllFilters_AppliesFiltersAndReturns()
        {
            var items = new List<Glossary> { new Glossary { ItemId = "g1", Name = "API", IsGlobal = true } };
            MockCursorHelper.SetupFindAsync(_glossaryCollection, items);
            MockCursorHelper.SetupCountDocuments(_glossaryCollection, 1);

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
            MockCursorHelper.SetupFindAsync(_glossaryCollection, new List<Glossary> { new Glossary { ItemId = "g1", Name = "API" } });

            var result = await _repo.GetByIdAsync("g1");

            result.Should().NotBeNull();
            result!.ItemId.Should().Be("g1");
        }

        [Fact]
        public async Task GetByIdAsync_WhenNotFound_ReturnsNull()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_glossaryCollection);

            var result = await _repo.GetByIdAsync("missing");

            result.Should().BeNull();
        }

        [Fact]
        public async Task GetByNameAsync_WhenFound_ReturnsGlossary()
        {
            MockCursorHelper.SetupFindAsync(_glossaryCollection, new List<Glossary> { new Glossary { ItemId = "g1", Name = "API" } });

            var result = await _repo.GetByNameAsync("API");

            result.Should().NotBeNull();
            result!.Name.Should().Be("API");
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
            var items = new List<Glossary> { new Glossary { ItemId = "g1", Name = "API" }, new Glossary { ItemId = "g2", Name = "SDK" } };
            MockCursorHelper.SetupFindAsync(_glossaryCollection, items);

            var result = await _repo.GetByIdsAsync(new List<string> { "g1", "g2" });

            result.Should().HaveCount(2);
        }

        [Fact]
        public async Task SaveAsync_UpsertsGlossary()
        {
            _blocksGlossaryCollection.Setup(x => x.ReplaceOneAsync(
                It.IsAny<FilterDefinition<BlocksGlossary>>(),
                It.IsAny<BlocksGlossary>(),
                It.IsAny<ReplaceOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync(Mock.Of<ReplaceOneResult>());

            var glossary = new BlocksGlossary { ItemId = "g1", Name = "API" };
            await _repo.SaveAsync(glossary);

            _blocksGlossaryCollection.Verify(x => x.ReplaceOneAsync(
                It.IsAny<FilterDefinition<BlocksGlossary>>(),
                glossary,
                It.Is<ReplaceOptions>(o => o.IsUpsert),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task GetGlobalAsync_UsesProjectKeyAndReturnsGlobals()
        {
            var items = new List<Glossary> { new Glossary { ItemId = "g1", Name = "API", IsGlobal = true } };
            MockCursorHelper.SetupFindAsync(_glossaryCollection, items);

            var result = await _repo.GetGlobalAsync("proj-x");

            result.Should().HaveCount(1);
            _dbContextProvider.Verify(x => x.GetDatabase("proj-x"), Times.Once);
        }

        [Fact]
        public async Task GetByModuleIdAsync_UsesProjectKeyAndReturnsMatches()
        {
            var items = new List<Glossary> { new Glossary { ItemId = "g1", Name = "API", ModuleIds = new List<string> { "mod-1" } } };
            MockCursorHelper.SetupFindAsync(_glossaryCollection, items);

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
    }
}
