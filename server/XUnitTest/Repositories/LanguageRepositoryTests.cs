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
    public class LanguageRepositoryTests
    {
        private readonly Mock<IDbContextProvider> _dbContextProvider;
        private readonly Mock<IMongoDatabase> _database;
        private readonly Mock<IMongoCollection<BlocksLanguage>> _collection;
        private readonly Mock<IMongoCollection<Language>> _languageCollection;
        private readonly LanguageRepository _repo;

        public LanguageRepositoryTests()
        {
            _dbContextProvider = new Mock<IDbContextProvider>();
            _database = new Mock<IMongoDatabase>();
            _collection = new Mock<IMongoCollection<BlocksLanguage>>();
            _languageCollection = new Mock<IMongoCollection<Language>>();

            _dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(_database.Object);
            _database.Setup(x => x.GetCollection<BlocksLanguage>(It.IsAny<string>(), null)).Returns(_collection.Object);
            _database.Setup(x => x.GetCollection<Language>(It.IsAny<string>(), null)).Returns(_languageCollection.Object);

            _repo = new LanguageRepository(_dbContextProvider.Object);
        }

        #region SaveAsync

        [Fact]
        public async Task SaveAsync_UpsertsLanguage()
        {
            _collection.Setup(x => x.ReplaceOneAsync(
                It.IsAny<FilterDefinition<BlocksLanguage>>(),
                It.IsAny<BlocksLanguage>(),
                It.IsAny<ReplaceOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync(Mock.Of<ReplaceOneResult>());

            var language = new BlocksLanguage { ItemId = "l1", LanguageName = "English", LanguageCode = "en" };
            await _repo.SaveAsync(language);

            _collection.Verify(x => x.ReplaceOneAsync(
                It.IsAny<FilterDefinition<BlocksLanguage>>(),
                language,
                It.Is<ReplaceOptions>(o => o.IsUpsert),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        #endregion

        #region DeleteAsync

        [Fact]
        public async Task DeleteAsync_CallsDeleteOneAsync()
        {
            _collection.Setup(x => x.DeleteOneAsync(
                It.IsAny<FilterDefinition<BlocksLanguage>>(),
                It.IsAny<CancellationToken>())).ReturnsAsync(Mock.Of<DeleteResult>());

            await _repo.DeleteAsync("English");

            _collection.Verify(x => x.DeleteOneAsync(
                It.IsAny<FilterDefinition<BlocksLanguage>>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        #endregion

        #region RemoveDefault

        [Fact]
        public async Task RemoveDefault_CallsUpdateManyAsync()
        {
            _collection.Setup(x => x.UpdateManyAsync(
                It.IsAny<FilterDefinition<BlocksLanguage>>(),
                It.IsAny<UpdateDefinition<BlocksLanguage>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>())).ReturnsAsync(Mock.Of<UpdateResult>());

            var language = new BlocksLanguage { ItemId = "l1", LanguageName = "English", LanguageCode = "en" };
            await _repo.RemoveDefault(language);

            _collection.Verify(x => x.UpdateManyAsync(
                It.IsAny<FilterDefinition<BlocksLanguage>>(),
                It.IsAny<UpdateDefinition<BlocksLanguage>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        #endregion

        #region GetAllLanguagesAsync

        [Fact]
        public async Task GetAllLanguagesAsync_ReturnsAllLanguages()
        {
            var languages = new List<Language>
            {
                new Language { ItemId = "l1", LanguageName = "English", LanguageCode = "en", IsDefault = true },
                new Language { ItemId = "l2", LanguageName = "German", LanguageCode = "de", IsDefault = false }
            };
            MockCursorHelper.SetupFindAsync(_languageCollection, languages);

            var result = await _repo.GetAllLanguagesAsync();

            result.Should().HaveCount(2);
            result[0].LanguageName.Should().Be("English");
            result[1].LanguageName.Should().Be("German");
        }

        [Fact]
        public async Task GetAllLanguagesAsync_ReturnsEmpty_WhenNoLanguages()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_languageCollection);

            var result = await _repo.GetAllLanguagesAsync();

            result.Should().BeEmpty();
        }

        #endregion

        #region GetLanguageByNameAsync

        [Fact]
        public async Task GetLanguageByNameAsync_ReturnsLanguage_WhenFound()
        {
            var lang = new BlocksLanguage { ItemId = "l1", LanguageName = "English", LanguageCode = "en" };
            MockCursorHelper.SetupFindAsync(_collection, new List<BlocksLanguage> { lang });

            var result = await _repo.GetLanguageByNameAsync("English");

            result.Should().NotBeNull();
            result.LanguageName.Should().Be("English");
        }

        [Fact]
        public async Task GetLanguageByNameAsync_ReturnsNull_WhenNotFound()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_collection);

            var result = await _repo.GetLanguageByNameAsync("NonExistent");

            result.Should().BeNull();
        }

        #endregion
    }
}
