using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Shared.Entities;
using FluentAssertions;
using Moq;
using MongoDB.Driver;
using Xunit;
using BlocksTemplate.XUnitTest.Shared;

namespace BlocksTemplate.XUnitTest.Repositories
{
    public class ModuleRepositoryTests
    {
        private readonly Mock<IDbContextProvider> _dbContextProvider;
        private readonly Mock<IMongoDatabase> _database;
        private readonly Mock<IMongoCollection<BlocksLanguageModule>> _collection;
        private readonly ModuleRepository _repo;

        public ModuleRepositoryTests()
        {
            _dbContextProvider = new Mock<IDbContextProvider>();
            _database = new Mock<IMongoDatabase>();
            _collection = new Mock<IMongoCollection<BlocksLanguageModule>>();

            _dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(_database.Object);
            _database.Setup(x => x.GetCollection<BlocksLanguageModule>(It.IsAny<string>(), null)).Returns(_collection.Object);
            // GetAllAsync uses _dbContextProvider.GetCollection directly
            _dbContextProvider.Setup(x => x.GetCollection<BlocksLanguageModule>(It.IsAny<string>())).Returns(_collection.Object);

            _repo = new ModuleRepository(_dbContextProvider.Object);
        }

        #region SaveAsync

        [Fact]
        public async Task SaveAsync_UpsertsModule()
        {
            _collection.Setup(x => x.ReplaceOneAsync(
                It.IsAny<FilterDefinition<BlocksLanguageModule>>(),
                It.IsAny<BlocksLanguageModule>(),
                It.IsAny<ReplaceOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync(Mock.Of<ReplaceOneResult>());

            var module = new BlocksLanguageModule { ItemId = "m1", ModuleName = "mod", Name = "Module" };
            await _repo.SaveAsync(module);

            _collection.Verify(x => x.ReplaceOneAsync(
                It.IsAny<FilterDefinition<BlocksLanguageModule>>(),
                module,
                It.Is<ReplaceOptions>(o => o.IsUpsert),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        #endregion

        #region GetByNameAsync

        [Fact]
        public async Task GetByNameAsync_ReturnsModule_WhenFound()
        {
            var module = new BlocksLanguageModule { ItemId = "m1", ModuleName = "mod1", Name = "Module1" };
            MockCursorHelper.SetupFindAsync(_collection, new List<BlocksLanguageModule> { module });

            var result = await _repo.GetByNameAsync("mod1");

            result.Should().NotBeNull();
            result.ModuleName.Should().Be("mod1");
        }

        [Fact]
        public async Task GetByNameAsync_ReturnsNull_WhenNotFound()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_collection);

            var result = await _repo.GetByNameAsync("nonexistent");

            result.Should().BeNull();
        }

        #endregion

        #region GetByIdAsync

        [Fact]
        public async Task GetByIdAsync_ReturnsModule_WhenFound()
        {
            var module = new BlocksLanguageModule { ItemId = "m1", ModuleName = "mod1", Name = "Module1" };
            MockCursorHelper.SetupFindAsync(_collection, new List<BlocksLanguageModule> { module });

            var result = await _repo.GetByIdAsync("m1");

            result.Should().NotBeNull();
            result.ItemId.Should().Be("m1");
        }

        [Fact]
        public async Task GetByIdAsync_ReturnsNull_WhenNotFound()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_collection);

            var result = await _repo.GetByIdAsync("nonexistent");

            result.Should().BeNull();
        }

        #endregion

        #region GetAllAsync

        [Fact]
        public async Task GetAllAsync_ReturnsAllModules()
        {
            var modules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ItemId = "m1", ModuleName = "mod1", Name = "Module1" },
                new BlocksLanguageModule { ItemId = "m2", ModuleName = "mod2", Name = "Module2" }
            };
            MockCursorHelper.SetupFindAsync(_collection, modules);

            var result = await _repo.GetAllAsync();

            result.Should().HaveCount(2);
        }

        [Fact]
        public async Task GetAllAsync_ReturnsEmpty_WhenNoModules()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_collection);

            var result = await _repo.GetAllAsync();

            result.Should().BeEmpty();
        }

        #endregion
    }
}
