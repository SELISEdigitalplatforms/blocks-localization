using Api.Controllers;
using Blocks.Genesis;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace XUnitTest
{
    public class GlossaryControllerTests
    {
        private readonly Mock<IGlossaryManagementService> _glossaryManagementServiceMock;
        private readonly GlossaryController _controller;

        public GlossaryControllerTests()
        {
            _glossaryManagementServiceMock = new Mock<IGlossaryManagementService>();

            var keyManagementServiceMock = new Mock<IKeyManagementService>();

            _controller = new GlossaryController(
                _glossaryManagementServiceMock.Object,
                keyManagementServiceMock.Object
            )
            {
                ControllerContext = new ControllerContext()
            };
        }

        #region Save Tests

        [Fact]
        public async Task Save_WithValidGlossary_ReturnsSuccess()
        {
            // Arrange
            var glossary = new Glossary
            {
                Name = "API",
                Language = "en-US",
                Type = "Acronym",
                ProjectKey = "test-project"
            };

            var expectedResponse = new ApiResponse { Success = true };

            _glossaryManagementServiceMock
                .Setup(x => x.SaveGlossaryAsync(glossary))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Save(glossary);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task Save_WithNullGlossary_ThrowsNullReferenceException()
        {
            // Act & Assert
            await Assert.ThrowsAsync<NullReferenceException>(() => _controller.Save(null));
        }

        [Fact]
        public async Task Save_WithOnlyRequiredFields_ReturnsSuccess()
        {
            // Arrange
            var glossary = new Glossary
            {
                Name = "Term",
                ProjectKey = "test-project"
            };

            var expectedResponse = new ApiResponse { Success = true };

            _glossaryManagementServiceMock
                .Setup(x => x.SaveGlossaryAsync(glossary))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Save(glossary);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            _glossaryManagementServiceMock.Verify(x => x.SaveGlossaryAsync(glossary), Times.Once);
        }

        #endregion

        #region Gets Tests

        [Fact]
        public async Task Gets_WithValidRequest_ReturnsGlossaryList()
        {
            // Arrange
            var request = new GetGlossariesRequest { ProjectKey = "project-1", PageNumber = 0, PageSize = 20 };
            var expectedResponse = new GetGlossariesResponse
            {
                Items = new List<Glossary>
                {
                    new Glossary { Name = "API", Type = "Acronym" },
                    new Glossary { Name = "URL", Type = "Abbreviation" }
                },
                TotalCount = 2
            };

            _glossaryManagementServiceMock
                .Setup(x => x.GetGlossariesAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Gets(request);

            // Assert
            result.Should().NotBeNull();
            result.Items.Should().HaveCount(2);
            result.TotalCount.Should().Be(2);
        }

        [Fact]
        public async Task Gets_WithEmptyResult_ReturnsEmptyList()
        {
            // Arrange
            var request = new GetGlossariesRequest { ProjectKey = "project-1" };
            var expectedResponse = new GetGlossariesResponse
            {
                Items = new List<Glossary>(),
                TotalCount = 0
            };

            _glossaryManagementServiceMock
                .Setup(x => x.GetGlossariesAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Gets(request);

            // Assert
            result.Items.Should().BeEmpty();
            result.TotalCount.Should().Be(0);
        }

        [Fact]
        public async Task Gets_WithSearchText_CallsServiceWithRequest()
        {
            // Arrange
            var request = new GetGlossariesRequest
            {
                ProjectKey = "project-1",
                SearchText = "API",
                PageNumber = 0,
                PageSize = 10
            };

            var expectedResponse = new GetGlossariesResponse
            {
                Items = new List<Glossary> { new Glossary { Name = "API" } },
                TotalCount = 1
            };

            _glossaryManagementServiceMock
                .Setup(x => x.GetGlossariesAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Gets(request);

            // Assert
            result.Items.Should().HaveCount(1);
            _glossaryManagementServiceMock.Verify(x => x.GetGlossariesAsync(request), Times.Once);
        }

        #endregion

        #region Delete Tests

        [Fact]
        public async Task Delete_WithValidItemId_ReturnsOk()
        {
            // Arrange
            var request = new DeleteGlossaryRequest { ItemId = "glossary-1", ProjectKey = "project-1" };
            var expectedResponse = new BaseMutationResponse { IsSuccess = true };

            _glossaryManagementServiceMock
                .Setup(x => x.DeleteGlossaryAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Delete(request);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task Delete_WithEmptyItemId_ReturnsBadRequest()
        {
            // Arrange
            var request = new DeleteGlossaryRequest { ItemId = "", ProjectKey = "project-1" };

            // Act
            var result = await _controller.Delete(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task Delete_WithNonExistingItem_ReturnsBadRequest()
        {
            // Arrange
            var request = new DeleteGlossaryRequest { ItemId = "non-existing", ProjectKey = "project-1" };
            var failureResponse = new BaseMutationResponse
            {
                IsSuccess = false,
                Errors = new Dictionary<string, string> { { "itemId", "Glossary item not found" } }
            };

            _glossaryManagementServiceMock
                .Setup(x => x.DeleteGlossaryAsync(request))
                .ReturnsAsync(failureResponse);

            // Act
            var result = await _controller.Delete(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        #endregion
    }
}
