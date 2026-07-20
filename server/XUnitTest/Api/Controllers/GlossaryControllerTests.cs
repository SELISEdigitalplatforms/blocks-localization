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
        private readonly Mock<IKeyManagementService> _keyManagementServiceMock;
        private readonly GlossaryController _controller;

        public GlossaryControllerTests()
        {
            _glossaryManagementServiceMock = new Mock<IGlossaryManagementService>();
            _keyManagementServiceMock = new Mock<IKeyManagementService>();

            _controller = new GlossaryController(
                _glossaryManagementServiceMock.Object,
                _keyManagementServiceMock.Object
            )
            {
                ControllerContext = new ControllerContext()
            };
        }

        [Fact]
        public async Task Get_WithEmptyItemId_ReturnsBadRequest()
        {
            var result = await _controller.Get("");
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task Get_WithValidItemId_Found_ReturnsOk()
        {
            var glossary = new Glossary { ItemId = "g1", Name = "API" };
            _glossaryManagementServiceMock.Setup(x => x.GetGlossaryByIdAsync("g1")).ReturnsAsync(glossary);

            var result = await _controller.Get("g1");

            result.Should().BeOfType<OkObjectResult>();
            ((OkObjectResult)result).Value.Should().BeSameAs(glossary);
        }

        [Fact]
        public async Task Get_WithValidItemId_NotFound_ReturnsNotFound()
        {
            _glossaryManagementServiceMock.Setup(x => x.GetGlossaryByIdAsync("missing")).ReturnsAsync((Glossary)null);

            var result = await _controller.Get("missing");

            result.Should().BeOfType<NotFoundObjectResult>();
        }

        [Fact]
        public async Task GetSuggestedGlossaries_DelegatesToKeyManagementService()
        {
            var request = new GetSuggestedGlossariesRequest { ItemId = "m1" };
            var response = new GetSuggestedGlossariesResponse();
            _keyManagementServiceMock.Setup(x => x.GetSuggestedGlossariesAsync(request)).ReturnsAsync(response);

            var result = await _controller.GetSuggestedGlossaries(request);

            result.Should().BeSameAs(response);
        }

        [Fact]
        public async Task GetSuggestedGlossaries_WithNullRequest_ReturnsEmptyWithoutCallingService()
        {
            var result = await _controller.GetSuggestedGlossaries(null);

            result.Should().NotBeNull();
            result.SuggestedGlossaries.Should().BeEmpty();
            _keyManagementServiceMock.Verify(x => x.GetSuggestedGlossariesAsync(It.IsAny<GetSuggestedGlossariesRequest>()), Times.Never);
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
                Type = "Acronym"
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
        public async Task Save_WithNullGlossary_ReturnsFailureWithoutCallingService()
        {
            var result = await _controller.Save(null);

            result.Should().NotBeNull();
            result.Success.Should().BeFalse();
            result.ErrorMessage.Should().Be("Glossary cannot be null.");
            _glossaryManagementServiceMock.Verify(x => x.SaveGlossaryAsync(It.IsAny<Glossary>()), Times.Never);
        }

        [Fact]
        public async Task Save_WithOnlyRequiredFields_ReturnsSuccess()
        {
            // Arrange
            var glossary = new Glossary
            {
                Name = "Term"
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
            var request = new GetGlossariesRequest {  PageNumber = 0, PageSize = 20 };
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
            var request = new GetGlossariesRequest {  };
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
        public async Task Gets_WithNullRequest_ReturnsEmptyWithoutCallingService()
        {
            var result = await _controller.Gets(null);

            result.Should().NotBeNull();
            result.Items.Should().BeEmpty();
            result.TotalCount.Should().Be(0);
            _glossaryManagementServiceMock.Verify(x => x.GetGlossariesAsync(It.IsAny<GetGlossariesRequest>()), Times.Never);
        }

        [Fact]
        public async Task Gets_WithSearchText_CallsServiceWithRequest()
        {
            // Arrange
            var request = new GetGlossariesRequest
            {
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
            var request = new DeleteGlossaryRequest { ItemId = "glossary-1" };
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
            var request = new DeleteGlossaryRequest { ItemId = "" };

            // Act
            var result = await _controller.Delete(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task Delete_WithNonExistingItem_ReturnsBadRequest()
        {
            // Arrange
            var request = new DeleteGlossaryRequest { ItemId = "non-existing" };
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
