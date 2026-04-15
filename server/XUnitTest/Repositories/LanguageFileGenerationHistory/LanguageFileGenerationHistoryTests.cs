using Blocks.Genesis;
using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Services;
using FluentAssertions;
using Moq;
using MongoDB.Driver;
using Xunit;
using XUnitTest.Shared;

namespace XUnitTest
{
    public class LanguageFileGenerationHistoryRepositoryTests
    {
        private readonly Mock<IDbContextProvider> _dbContextProvider;
        private readonly Mock<IMongoDatabase> _database;
        private readonly Mock<IMongoCollection<LanguageFileGenerationHistory>> _collection;
        private readonly LanguageFileGenerationHistoryRepository _repo;

        public LanguageFileGenerationHistoryRepositoryTests()
        {
            _dbContextProvider = new Mock<IDbContextProvider>();
            _database = new Mock<IMongoDatabase>();
            _collection = new Mock<IMongoCollection<LanguageFileGenerationHistory>>();

            _dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(_database.Object);
            _database.Setup(x => x.GetCollection<LanguageFileGenerationHistory>(It.IsAny<string>(), null)).Returns(_collection.Object);

            _repo = new LanguageFileGenerationHistoryRepository(_dbContextProvider.Object);
        }

        [Fact]
        public async Task SaveAsync_CallsInsertOneAsync()
        {
            _collection.Setup(x => x.InsertOneAsync(
                It.IsAny<LanguageFileGenerationHistory>(),
                It.IsAny<InsertOneOptions>(),
                It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var history = new LanguageFileGenerationHistory
            {
                ItemId = "h1",
                ProjectKey = "proj-1",
                Version = 1,
                CreateDate = DateTime.UtcNow
            };

            await _repo.SaveAsync(history);

            _collection.Verify(x => x.InsertOneAsync(
                history,
                It.IsAny<InsertOneOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
            _dbContextProvider.Verify(x => x.GetDatabase("proj-1"), Times.Once);
        }

        [Fact]
        public async Task SaveAsync_UsesProjectKeyAsDatabase()
        {
            _collection.Setup(x => x.InsertOneAsync(
                It.IsAny<LanguageFileGenerationHistory>(),
                It.IsAny<InsertOneOptions>(),
                It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var history = new LanguageFileGenerationHistory
            {
                ItemId = "h2",
                ProjectKey = "custom-project",
                Version = 5,
                CreateDate = DateTime.UtcNow
            };

            await _repo.SaveAsync(history);

            _dbContextProvider.Verify(x => x.GetDatabase("custom-project"), Times.Once);
        }

        [Fact]
        public async Task GetLatestLanguageFileGenerationHistory_ReturnsLatest()
        {
            var history = new LanguageFileGenerationHistory
            {
                ItemId = "h1",
                ProjectKey = "proj-1",
                Version = 3,
                CreateDate = DateTime.UtcNow
            };
            MockCursorHelper.SetupFindAsync(_collection, new List<LanguageFileGenerationHistory> { history });

            var result = await _repo.GetLatestLanguageFileGenerationHistory("proj-1");

            result.Should().NotBeNull();
            result!.Version.Should().Be(3);
            _dbContextProvider.Verify(x => x.GetDatabase("proj-1"), Times.Once);
        }

        [Fact]
        public async Task GetLatestLanguageFileGenerationHistory_ReturnsNull_WhenNoHistory()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_collection);

            var result = await _repo.GetLatestLanguageFileGenerationHistory("proj-1");

            result.Should().BeNull();
        }

        [Fact]
        public async Task GetPaginatedAsync_ReturnsItemsAndCount()
        {
            var items = new List<LanguageFileGenerationHistory>
            {
                new LanguageFileGenerationHistory { ItemId = "h1", ProjectKey = "proj-1", Version = 1, CreateDate = DateTime.UtcNow },
                new LanguageFileGenerationHistory { ItemId = "h2", ProjectKey = "proj-1", Version = 2, CreateDate = DateTime.UtcNow }
            };
            MockCursorHelper.SetupFindAsync(_collection, items);
            MockCursorHelper.SetupCountDocuments(_collection, 2);

            var request = new GetLanguageFileGenerationHistoryRequest
            {
                ProjectKey = "proj-1",
                PageNumber = 0,
                PageSize = 10
            };
            var result = await _repo.GetPaginatedAsync(request);

            result.Should().NotBeNull();
            result.Items.Should().HaveCount(2);
            result.TotalCount.Should().Be(2);
        }

        [Fact]
        public async Task GetPaginatedAsync_ReturnsEmpty_WhenNoItems()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_collection);
            MockCursorHelper.SetupCountDocuments(_collection, 0);

            var request = new GetLanguageFileGenerationHistoryRequest
            {
                ProjectKey = "proj-1",
                PageNumber = 0,
                PageSize = 10
            };
            var result = await _repo.GetPaginatedAsync(request);

            result.Should().NotBeNull();
            result.Items.Should().BeEmpty();
            result.TotalCount.Should().Be(0);
        }

        [Fact]
        public async Task GetPaginatedAsync_UsesCorrectProjectKey()
        {
            MockCursorHelper.SetupFindAsyncEmpty(_collection);
            MockCursorHelper.SetupCountDocuments(_collection, 0);

            var request = new GetLanguageFileGenerationHistoryRequest
            {
                ProjectKey = "my-project",
                PageNumber = 1,
                PageSize = 5
            };
            await _repo.GetPaginatedAsync(request);

            _dbContextProvider.Verify(x => x.GetDatabase("my-project"), Times.Once);
        }
    }

    public class LanguageFileGenerationHistoryTests
    {
        private readonly Mock<ILanguageFileGenerationHistoryRepository> _repositoryMock;

        public LanguageFileGenerationHistoryTests()
        {
            _repositoryMock = new Mock<ILanguageFileGenerationHistoryRepository>();
        }

        #region GetLanguageFileGenerationHistoryAsync Tests

        [Fact]
        public async Task GetLanguageFileGenerationHistoryAsync_WithValidRequest_ReturnsExpectedResponse()
        {
            // Arrange
            var request = new GetLanguageFileGenerationHistoryRequest
            {
                ProjectKey = "test-project",
                PageNumber = 0,
                PageSize = 10
            };

            var expectedResponse = new GetLanguageFileGenerationHistoryResponse
            {
                TotalCount = 2,
                Items = new List<LanguageFileGenerationHistory>
                {
                    new LanguageFileGenerationHistory
                    {
                        ItemId = "history-1",
                        CreateDate = DateTime.UtcNow.AddDays(-1),
                        Version = 2,
                        ModuleId = "module-1",
                        ProjectKey = "test-project"
                    },
                    new LanguageFileGenerationHistory
                    {
                        ItemId = "history-2",
                        CreateDate = DateTime.UtcNow.AddDays(-2),
                        Version = 1,
                        ModuleId = "module-2",
                        ProjectKey = "test-project"
                    }
                }
            };

            _repositoryMock.Setup(r => r.GetPaginatedAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _repositoryMock.Object.GetPaginatedAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.TotalCount.Should().Be(2);
            result.Items.Should().HaveCount(2);
            result.Items[0].ItemId.Should().Be("history-1");
            result.Items[0].Version.Should().Be(2);
            result.Items[1].ItemId.Should().Be("history-2");
            result.Items[1].Version.Should().Be(1);
            _repositoryMock.Verify(r => r.GetPaginatedAsync(request), Times.Once);
        }

        [Fact]
        public async Task GetLanguageFileGenerationHistoryAsync_WithEmptyResults_ReturnsEmptyList()
        {
            // Arrange
            var request = new GetLanguageFileGenerationHistoryRequest
            {
                ProjectKey = "empty-project",
                PageNumber = 0,
                PageSize = 10
            };

            var expectedResponse = new GetLanguageFileGenerationHistoryResponse
            {
                TotalCount = 0,
                Items = new List<LanguageFileGenerationHistory>()
            };

            _repositoryMock.Setup(r => r.GetPaginatedAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _repositoryMock.Object.GetPaginatedAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.TotalCount.Should().Be(0);
            result.Items.Should().BeEmpty();
            _repositoryMock.Verify(r => r.GetPaginatedAsync(request), Times.Once);
        }

        [Fact]
        public async Task GetLanguageFileGenerationHistoryAsync_WithPagination_ReturnsCorrectPage()
        {
            // Arrange
            var request = new GetLanguageFileGenerationHistoryRequest
            {
                ProjectKey = "test-project",
                PageNumber = 1,
                PageSize = 5
            };

            var expectedResponse = new GetLanguageFileGenerationHistoryResponse
            {
                TotalCount = 15,
                Items = new List<LanguageFileGenerationHistory>
                {
                    new LanguageFileGenerationHistory
                    {
                        ItemId = "history-6",
                        CreateDate = DateTime.UtcNow.AddDays(-6),
                        Version = 6,
                        ModuleId = "module-1",
                        ProjectKey = "test-project"
                    },
                    new LanguageFileGenerationHistory
                    {
                        ItemId = "history-7",
                        CreateDate = DateTime.UtcNow.AddDays(-7),
                        Version = 7,
                        ModuleId = "module-1",
                        ProjectKey = "test-project"
                    }
                }
            };

            _repositoryMock.Setup(r => r.GetPaginatedAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _repositoryMock.Object.GetPaginatedAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.TotalCount.Should().Be(15);
            result.Items.Should().HaveCount(2);
            _repositoryMock.Verify(r => r.GetPaginatedAsync(request), Times.Once);
        }

        [Fact]
        public async Task GetLanguageFileGenerationHistoryAsync_WithCustomPageSize_ReturnsCorrectNumberOfItems()
        {
            // Arrange
            var request = new GetLanguageFileGenerationHistoryRequest
            {
                ProjectKey = "test-project",
                PageNumber = 0,
                PageSize = 3
            };

            var expectedResponse = new GetLanguageFileGenerationHistoryResponse
            {
                TotalCount = 10,
                Items = new List<LanguageFileGenerationHistory>
                {
                    new LanguageFileGenerationHistory
                    {
                        ItemId = "history-1",
                        CreateDate = DateTime.UtcNow,
                        Version = 1,
                        ModuleId = "module-1",
                        ProjectKey = "test-project"
                    },
                    new LanguageFileGenerationHistory
                    {
                        ItemId = "history-2",
                        CreateDate = DateTime.UtcNow.AddHours(-1),
                        Version = 2,
                        ModuleId = "module-1",
                        ProjectKey = "test-project"
                    },
                    new LanguageFileGenerationHistory
                    {
                        ItemId = "history-3",
                        CreateDate = DateTime.UtcNow.AddHours(-2),
                        Version = 3,
                        ModuleId = "module-1",
                        ProjectKey = "test-project"
                    }
                }
            };

            _repositoryMock.Setup(r => r.GetPaginatedAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _repositoryMock.Object.GetPaginatedAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.Items.Should().HaveCount(3);
            result.TotalCount.Should().Be(10);
            _repositoryMock.Verify(r => r.GetPaginatedAsync(request), Times.Once);
        }

        [Fact]
        public async Task GetLanguageFileGenerationHistoryAsync_WithDifferentModuleIds_ReturnsAllHistories()
        {
            // Arrange
            var request = new GetLanguageFileGenerationHistoryRequest
            {
                ProjectKey = "test-project",
                PageNumber = 0,
                PageSize = 10
            };

            var expectedResponse = new GetLanguageFileGenerationHistoryResponse
            {
                TotalCount = 3,
                Items = new List<LanguageFileGenerationHistory>
                {
                    new LanguageFileGenerationHistory
                    {
                        ItemId = "history-1",
                        CreateDate = DateTime.UtcNow,
                        Version = 1,
                        ModuleId = "auth-module",
                        ProjectKey = "test-project"
                    },
                    new LanguageFileGenerationHistory
                    {
                        ItemId = "history-2",
                        CreateDate = DateTime.UtcNow.AddHours(-1),
                        Version = 2,
                        ModuleId = "user-module",
                        ProjectKey = "test-project"
                    },
                    new LanguageFileGenerationHistory
                    {
                        ItemId = "history-3",
                        CreateDate = DateTime.UtcNow.AddHours(-2),
                        Version = 3,
                        ModuleId = null,
                        ProjectKey = "test-project"
                    }
                }
            };

            _repositoryMock.Setup(r => r.GetPaginatedAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _repositoryMock.Object.GetPaginatedAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.Items.Should().HaveCount(3);
            result.Items[0].ModuleId.Should().Be("auth-module");
            result.Items[1].ModuleId.Should().Be("user-module");
            result.Items[2].ModuleId.Should().BeNull();
            _repositoryMock.Verify(r => r.GetPaginatedAsync(request), Times.Once);
        }

        #endregion

        #region SaveAsync Tests

        [Fact]
        public async Task SaveAsync_WithValidHistory_SavesSuccessfully()
        {
            // Arrange
            var history = new LanguageFileGenerationHistory
            {
                ItemId = "history-123",
                CreateDate = DateTime.UtcNow,
                Version = 1,
                ModuleId = "test-module",
                ProjectKey = "test-project"
            };

            _repositoryMock.Setup(r => r.SaveAsync(history))
                .Returns(Task.CompletedTask);

            // Act
            await _repositoryMock.Object.SaveAsync(history);

            // Assert
            _repositoryMock.Verify(r => r.SaveAsync(history), Times.Once);
        }

        [Fact]
        public async Task SaveAsync_WithNullModuleId_SavesSuccessfully()
        {
            // Arrange
            var history = new LanguageFileGenerationHistory
            {
                ItemId = "history-456",
                CreateDate = DateTime.UtcNow,
                Version = 2,
                ModuleId = null,
                ProjectKey = "test-project"
            };

            _repositoryMock.Setup(r => r.SaveAsync(history))
                .Returns(Task.CompletedTask);

            // Act
            await _repositoryMock.Object.SaveAsync(history);

            // Assert
            _repositoryMock.Verify(r => r.SaveAsync(history), Times.Once);
        }

        [Fact]
        public async Task SaveAsync_WithMultipleHistories_SavesAll()
        {
            // Arrange
            var history1 = new LanguageFileGenerationHistory
            {
                ItemId = "history-1",
                CreateDate = DateTime.UtcNow,
                Version = 1,
                ModuleId = "module-1",
                ProjectKey = "test-project"
            };

            var history2 = new LanguageFileGenerationHistory
            {
                ItemId = "history-2",
                CreateDate = DateTime.UtcNow.AddMinutes(5),
                Version = 2,
                ModuleId = "module-2",
                ProjectKey = "test-project"
            };

            _repositoryMock.Setup(r => r.SaveAsync(It.IsAny<LanguageFileGenerationHistory>()))
                .Returns(Task.CompletedTask);

            // Act
            await _repositoryMock.Object.SaveAsync(history1);
            await _repositoryMock.Object.SaveAsync(history2);

            // Assert
            _repositoryMock.Verify(r => r.SaveAsync(It.IsAny<LanguageFileGenerationHistory>()), Times.Exactly(2));
        }

        #endregion

        #region GetLatestLanguageFileGenerationHistory Tests

        [Fact]
        public async Task GetLatestLanguageFileGenerationHistory_WithExistingHistory_ReturnsLatest()
        {
            // Arrange
            var projectKey = "test-project";
            var latestHistory = new LanguageFileGenerationHistory
            {
                ItemId = "latest-history",
                CreateDate = DateTime.UtcNow,
                Version = 5,
                ModuleId = "current-module",
                ProjectKey = projectKey
            };

            _repositoryMock.Setup(r => r.GetLatestLanguageFileGenerationHistory(projectKey))
                .ReturnsAsync(latestHistory);

            // Act
            var result = await _repositoryMock.Object.GetLatestLanguageFileGenerationHistory(projectKey);

            // Assert
            result.Should().NotBeNull();
            result!.ItemId.Should().Be("latest-history");
            result.Version.Should().Be(5);
            result.ProjectKey.Should().Be(projectKey);
            _repositoryMock.Verify(r => r.GetLatestLanguageFileGenerationHistory(projectKey), Times.Once);
        }

        [Fact]
        public async Task GetLatestLanguageFileGenerationHistory_WithNoHistory_ReturnsNull()
        {
            // Arrange
            var projectKey = "empty-project";

            _repositoryMock.Setup(r => r.GetLatestLanguageFileGenerationHistory(projectKey))
                .ReturnsAsync((LanguageFileGenerationHistory?)null);

            // Act
            var result = await _repositoryMock.Object.GetLatestLanguageFileGenerationHistory(projectKey);

            // Assert
            result.Should().BeNull();
            _repositoryMock.Verify(r => r.GetLatestLanguageFileGenerationHistory(projectKey), Times.Once);
        }

        [Fact]
        public async Task GetLatestLanguageFileGenerationHistory_WithMultipleHistories_ReturnsNewest()
        {
            // Arrange
            var projectKey = "test-project";
            var newestHistory = new LanguageFileGenerationHistory
            {
                ItemId = "newest-history",
                CreateDate = DateTime.UtcNow,
                Version = 10,
                ModuleId = "module-1",
                ProjectKey = projectKey
            };

            _repositoryMock.Setup(r => r.GetLatestLanguageFileGenerationHistory(projectKey))
                .ReturnsAsync(newestHistory);

            // Act
            var result = await _repositoryMock.Object.GetLatestLanguageFileGenerationHistory(projectKey);

            // Assert
            result.Should().NotBeNull();
            result!.Version.Should().Be(10);
            result.CreateDate.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
            _repositoryMock.Verify(r => r.GetLatestLanguageFileGenerationHistory(projectKey), Times.Once);
        }

        [Fact]
        public async Task GetLatestLanguageFileGenerationHistory_WithNullModuleId_ReturnsHistory()
        {
            // Arrange
            var projectKey = "test-project";
            var history = new LanguageFileGenerationHistory
            {
                ItemId = "history-no-module",
                CreateDate = DateTime.UtcNow,
                Version = 3,
                ModuleId = null,
                ProjectKey = projectKey
            };

            _repositoryMock.Setup(r => r.GetLatestLanguageFileGenerationHistory(projectKey))
                .ReturnsAsync(history);

            // Act
            var result = await _repositoryMock.Object.GetLatestLanguageFileGenerationHistory(projectKey);

            // Assert
            result.Should().NotBeNull();
            result!.ModuleId.Should().BeNull();
            result.Version.Should().Be(3);
            _repositoryMock.Verify(r => r.GetLatestLanguageFileGenerationHistory(projectKey), Times.Once);
        }

        #endregion

        #region Request Model Tests

        [Fact]
        public void GetLanguageFileGenerationHistoryRequest_DefaultValues_AreCorrect()
        {
            // Arrange & Act
            var request = new GetLanguageFileGenerationHistoryRequest();

            // Assert
            request.PageSize.Should().Be(10);
            request.PageNumber.Should().Be(0);
            request.ProjectKey.Should().BeNull();
        }

        [Fact]
        public void GetLanguageFileGenerationHistoryRequest_WithCustomValues_SetsCorrectly()
        {
            // Arrange & Act
            var request = new GetLanguageFileGenerationHistoryRequest
            {
                PageSize = 25,
                PageNumber = 3,
                ProjectKey = "custom-project"
            };

            // Assert
            request.PageSize.Should().Be(25);
            request.PageNumber.Should().Be(3);
            request.ProjectKey.Should().Be("custom-project");
        }

        #endregion

        #region Response Model Tests

        [Fact]
        public void GetLanguageFileGenerationHistoryResponse_DefaultValues_AreCorrect()
        {
            // Arrange & Act
            var response = new GetLanguageFileGenerationHistoryResponse();

            // Assert
            response.TotalCount.Should().Be(0);
            response.Items.Should().NotBeNull();
            response.Items.Should().BeEmpty();
        }

        [Fact]
        public void GetLanguageFileGenerationHistoryResponse_WithItems_SetsCorrectly()
        {
            // Arrange
            var items = new List<LanguageFileGenerationHistory>
            {
                new LanguageFileGenerationHistory
                {
                    ItemId = "item-1",
                    CreateDate = DateTime.UtcNow,
                    Version = 1,
                    ModuleId = "module-1",
                    ProjectKey = "test-project"
                }
            };

            // Act
            var response = new GetLanguageFileGenerationHistoryResponse
            {
                TotalCount = 1,
                Items = items
            };

            // Assert
            response.TotalCount.Should().Be(1);
            response.Items.Should().HaveCount(1);
            response.Items[0].ItemId.Should().Be("item-1");
        }

        #endregion

        #region History Model Tests

        [Fact]
        public void LanguageFileGenerationHistory_WithAllProperties_SetsCorrectly()
        {
            // Arrange
            var createDate = DateTime.UtcNow;

            // Act
            var history = new LanguageFileGenerationHistory
            {
                ItemId = "history-id",
                CreateDate = createDate,
                Version = 5,
                ModuleId = "test-module",
                ProjectKey = "test-project"
            };

            // Assert
            history.ItemId.Should().Be("history-id");
            history.CreateDate.Should().Be(createDate);
            history.Version.Should().Be(5);
            history.ModuleId.Should().Be("test-module");
            history.ProjectKey.Should().Be("test-project");
        }

        [Fact]
        public void LanguageFileGenerationHistory_WithNullModuleId_IsValid()
        {
            // Arrange & Act
            var history = new LanguageFileGenerationHistory
            {
                ItemId = "history-id",
                CreateDate = DateTime.UtcNow,
                Version = 1,
                ModuleId = null,
                ProjectKey = "test-project"
            };

            // Assert
            history.ModuleId.Should().BeNull();
            history.ItemId.Should().NotBeNullOrEmpty();
            history.ProjectKey.Should().NotBeNullOrEmpty();
        }

        #endregion

        #region Edge Case Tests

        [Fact]
        public async Task GetLanguageFileGenerationHistoryAsync_WithLargePageSize_HandlesCorrectly()
        {
            // Arrange
            var request = new GetLanguageFileGenerationHistoryRequest
            {
                ProjectKey = "test-project",
                PageNumber = 0,
                PageSize = 1000
            };

            var expectedResponse = new GetLanguageFileGenerationHistoryResponse
            {
                TotalCount = 50,
                Items = new List<LanguageFileGenerationHistory>()
            };

            _repositoryMock.Setup(r => r.GetPaginatedAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _repositoryMock.Object.GetPaginatedAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.TotalCount.Should().Be(50);
            _repositoryMock.Verify(r => r.GetPaginatedAsync(request), Times.Once);
        }

        [Fact]
        public async Task GetLanguageFileGenerationHistoryAsync_WithPageBeyondRange_ReturnsEmpty()
        {
            // Arrange
            var request = new GetLanguageFileGenerationHistoryRequest
            {
                ProjectKey = "test-project",
                PageNumber = 100,
                PageSize = 10
            };

            var expectedResponse = new GetLanguageFileGenerationHistoryResponse
            {
                TotalCount = 25,
                Items = new List<LanguageFileGenerationHistory>()
            };

            _repositoryMock.Setup(r => r.GetPaginatedAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _repositoryMock.Object.GetPaginatedAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.TotalCount.Should().Be(25);
            result.Items.Should().BeEmpty();
            _repositoryMock.Verify(r => r.GetPaginatedAsync(request), Times.Once);
        }

        [Fact]
        public async Task GetLanguageFileGenerationHistoryAsync_VerifiesSortingByCreateDateDescending()
        {
            // Arrange
            var request = new GetLanguageFileGenerationHistoryRequest
            {
                ProjectKey = "test-project",
                PageNumber = 0,
                PageSize = 3
            };

            var now = DateTime.UtcNow;
            var expectedResponse = new GetLanguageFileGenerationHistoryResponse
            {
                TotalCount = 3,
                Items = new List<LanguageFileGenerationHistory>
                {
                    new LanguageFileGenerationHistory
                    {
                        ItemId = "history-1",
                        CreateDate = now,
                        Version = 3,
                        ModuleId = "module-1",
                        ProjectKey = "test-project"
                    },
                    new LanguageFileGenerationHistory
                    {
                        ItemId = "history-2",
                        CreateDate = now.AddMinutes(-5),
                        Version = 2,
                        ModuleId = "module-1",
                        ProjectKey = "test-project"
                    },
                    new LanguageFileGenerationHistory
                    {
                        ItemId = "history-3",
                        CreateDate = now.AddMinutes(-10),
                        Version = 1,
                        ModuleId = "module-1",
                        ProjectKey = "test-project"
                    }
                }
            };

            _repositoryMock.Setup(r => r.GetPaginatedAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _repositoryMock.Object.GetPaginatedAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.Items.Should().HaveCount(3);
            // Verify descending order
            result.Items[0].CreateDate.Should().BeAfter(result.Items[1].CreateDate);
            result.Items[1].CreateDate.Should().BeAfter(result.Items[2].CreateDate);
            result.Items[0].Version.Should().Be(3);
            result.Items[2].Version.Should().Be(1);
        }

        #endregion
    }
}
