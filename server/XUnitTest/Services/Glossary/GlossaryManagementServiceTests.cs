using BlocksTemplate.DomainService.Repositories;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Shared;
using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using BlocksGlossary = BlocksTemplate.DomainService.Repositories.BlocksGlossary;
using GlossaryModel = BlocksTemplate.DomainService.Services.Glossary;

namespace XUnitTest
{
    public class GlossaryManagementServiceTests
    {
        private readonly Mock<ILogger<GlossaryManagementService>> _loggerMock;
        private readonly Mock<IGlossaryRepository> _glossaryRepositoryMock;
        private readonly Mock<IValidator<GlossaryModel>> _validatorMock;
        private readonly GlossaryManagementService _service;

        public GlossaryManagementServiceTests()
        {
            _loggerMock = new Mock<ILogger<GlossaryManagementService>>();
            _glossaryRepositoryMock = new Mock<IGlossaryRepository>();
            _validatorMock = new Mock<IValidator<GlossaryModel>>();

            _service = new GlossaryManagementService(
                _validatorMock.Object,
                _loggerMock.Object,
                _glossaryRepositoryMock.Object
            );
        }

        #region SaveGlossaryAsync Tests

        [Fact]
        public async Task SaveGlossaryAsync_ValidGlossary_ReturnsSuccess()
        {
            // Arrange
            var glossary = new GlossaryModel
            {
                Name = "API",
                Language = "en-US",
                Type = "Acronym",
                ProjectKey = "test-project"
            };

            var validationResult = new FluentValidation.Results.ValidationResult();
            _validatorMock.Setup(v => v.ValidateAsync(glossary, default))
                .ReturnsAsync(validationResult);

            _glossaryRepositoryMock.Setup(r => r.GetByIdAsync(It.IsAny<string>()))
                .ReturnsAsync((GlossaryModel)null);

            _glossaryRepositoryMock.Setup(r => r.SaveAsync(It.IsAny<BlocksGlossary>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.SaveGlossaryAsync(glossary);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            _glossaryRepositoryMock.Verify(r => r.SaveAsync(It.IsAny<BlocksGlossary>()), Times.Once);
        }

        [Fact]
        public async Task SaveGlossaryAsync_InvalidGlossary_ReturnsValidationError()
        {
            // Arrange
            var glossary = new GlossaryModel
            {
                Name = "",
                ProjectKey = "test-project"
            };

            var validationResult = new FluentValidation.Results.ValidationResult();
            validationResult.Errors.Add(new FluentValidation.Results.ValidationFailure("Name", "Name is required."));

            _validatorMock.Setup(v => v.ValidateAsync(glossary, default))
                .ReturnsAsync(validationResult);

            // Act
            var result = await _service.SaveGlossaryAsync(glossary);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeFalse();
            _glossaryRepositoryMock.Verify(r => r.SaveAsync(It.IsAny<BlocksGlossary>()), Times.Never);
        }

        [Fact]
        public async Task SaveGlossaryAsync_ExistingGlossary_UpdatesGlossary()
        {
            // Arrange
            var glossary = new GlossaryModel
            {
                ItemId = "existing-id",
                Name = "API Updated",
                Language = "en-US",
                Type = "Acronym",
                ProjectKey = "test-project"
            };

            var existingGlossary = new GlossaryModel
            {
                ItemId = "existing-id",
                Name = "API",
                CreateDate = DateTime.UtcNow.AddDays(-1)
            };

            var validationResult = new FluentValidation.Results.ValidationResult();
            _validatorMock.Setup(v => v.ValidateAsync(glossary, default))
                .ReturnsAsync(validationResult);

            _glossaryRepositoryMock.Setup(r => r.GetByIdAsync("existing-id"))
                .ReturnsAsync(existingGlossary);

            _glossaryRepositoryMock.Setup(r => r.SaveAsync(It.IsAny<BlocksGlossary>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.SaveGlossaryAsync(glossary);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            _glossaryRepositoryMock.Verify(r => r.SaveAsync(It.Is<BlocksGlossary>(g =>
                g.ItemId == "existing-id" && g.Name == "API Updated"
            )), Times.Once);
        }

        [Fact]
        public async Task SaveGlossaryAsync_RepositoryThrows_ReturnsError()
        {
            // Arrange
            var glossary = new GlossaryModel
            {
                Name = "API",
                ProjectKey = "test-project"
            };

            var validationResult = new FluentValidation.Results.ValidationResult();
            _validatorMock.Setup(v => v.ValidateAsync(glossary, default))
                .ReturnsAsync(validationResult);

            _glossaryRepositoryMock.Setup(r => r.SaveAsync(It.IsAny<BlocksGlossary>()))
                .ThrowsAsync(new Exception("Database error"));

            // Act
            var result = await _service.SaveGlossaryAsync(glossary);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeFalse();
            result.ErrorMessage.Should().Be("Database error");
        }

        #endregion

        #region DeleteGlossaryAsync Tests

        [Fact]
        public async Task DeleteGlossaryAsync_ExistingItem_ReturnsSuccess()
        {
            // Arrange
            var request = new DeleteGlossaryRequest { ItemId = "glossary-1", ProjectKey = "test-project" };
            var existingGlossary = new GlossaryModel { ItemId = "glossary-1", Name = "API" };

            _glossaryRepositoryMock.Setup(r => r.GetByIdAsync("glossary-1"))
                .ReturnsAsync(existingGlossary);

            _glossaryRepositoryMock.Setup(r => r.DeleteAsync("glossary-1"))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.DeleteGlossaryAsync(request);

            // Assert
            result.IsSuccess.Should().BeTrue();
            _glossaryRepositoryMock.Verify(r => r.DeleteAsync("glossary-1"), Times.Once);
        }

        [Fact]
        public async Task DeleteGlossaryAsync_NonExistingItem_ReturnsNotFound()
        {
            // Arrange
            var request = new DeleteGlossaryRequest { ItemId = "non-existing", ProjectKey = "test-project" };

            _glossaryRepositoryMock.Setup(r => r.GetByIdAsync("non-existing"))
                .ReturnsAsync((GlossaryModel)null);

            // Act
            var result = await _service.DeleteGlossaryAsync(request);

            // Assert
            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("itemId");
            _glossaryRepositoryMock.Verify(r => r.DeleteAsync(It.IsAny<string>()), Times.Never);
        }

        #endregion

        #region GetGlossariesAsync Tests

        [Fact]
        public async Task GetGlossariesAsync_ReturnsResults()
        {
            // Arrange
            var request = new GetGlossariesRequest { ProjectKey = "test-project", PageNumber = 0, PageSize = 20 };
            var expectedResponse = new GetGlossariesResponse
            {
                Items = new List<GlossaryModel>
                {
                    new GlossaryModel { Name = "API", Type = "Acronym" },
                    new GlossaryModel { Name = "URL", Type = "Abbreviation" }
                },
                TotalCount = 2
            };

            _glossaryRepositoryMock.Setup(r => r.GetAllAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _service.GetGlossariesAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.Items.Should().HaveCount(2);
            result.TotalCount.Should().Be(2);
        }

        [Fact]
        public async Task GetGlossariesAsync_EmptyResult_ReturnsEmptyList()
        {
            // Arrange
            var request = new GetGlossariesRequest { ProjectKey = "test-project" };
            var expectedResponse = new GetGlossariesResponse
            {
                Items = new List<GlossaryModel>(),
                TotalCount = 0
            };

            _glossaryRepositoryMock.Setup(r => r.GetAllAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _service.GetGlossariesAsync(request);

            // Assert
            result.Items.Should().BeEmpty();
            result.TotalCount.Should().Be(0);
        }

        #endregion
    }
}
