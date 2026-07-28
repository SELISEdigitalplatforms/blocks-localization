using Api.Controllers;
using Blocks.Genesis;
using BlocksTemplate.Api.Controllers;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared;
using Eurolm.DomainService.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace XUnitTest
{
    public class LanguageControllerTests
    {
        private readonly Mock<ILanguageManagementService> _languageManagementServiceMock;
        private readonly LanguageController _controller;

        public LanguageControllerTests()
        {
            _languageManagementServiceMock = new Mock<ILanguageManagementService>();


            _controller = new LanguageController(
                _languageManagementServiceMock.Object
            )
            {
                ControllerContext = new ControllerContext()
            };
        }

        #region Save Tests

        [Fact]
        public async Task Save_WithValidLanguage_ReturnsSuccess()
        {
            // Arrange
            var language = new Language
            {
                LanguageName = "Spanish",
                LanguageCode = "es"
            };

            var expectedResponse = new ApiResponse { Success = true };

            _languageManagementServiceMock
                .Setup(x => x.SaveLanguageAsync(language))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Save(language);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task Save_WithNullLanguage_ReturnsFailureWithoutCallingService()
        {
            var result = await _controller.Save(null);

            result.Should().NotBeNull();
            result.Success.Should().BeFalse();
            result.ErrorMessage.Should().Be("Language cannot be null.");
            _languageManagementServiceMock.Verify(x => x.SaveLanguageAsync(It.IsAny<Language>()), Times.Never);
        }

        #endregion

        #region Gets Tests

        [Fact]
        public async Task Gets_WithValidRequest_ReturnsLanguageList()
        {
            // Arrange
            var request = new GetLanguagesRequest {  };
            var expectedLanguages = new List<Language>
            {
                new Language { LanguageName = "English", LanguageCode = "en" },
                new Language { LanguageName = "Spanish", LanguageCode = "es" }
            };

            _languageManagementServiceMock
                .Setup(x => x.GetLanguagesAsync("test"))
                .ReturnsAsync(expectedLanguages);

            // Act
            var result = await _controller.Gets();

            // Assert
            result.Should().NotBeNull();
            result.Should().HaveCount(2);
        }

        [Fact]
        public async Task Gets_WithEmptyLanguageList_ReturnsEmpty()
        {
            // Arrange
            var request = new GetLanguagesRequest {  };

            _languageManagementServiceMock
                .Setup(x => x.GetLanguagesAsync("test"))
                .ReturnsAsync(new List<Language>());

            // Act
            var result = await _controller.Gets();

            // Assert
            result.Should().BeEmpty();
        }

        #endregion

        #region Delete Tests

        [Fact]
        public async Task Delete_WithValidLanguageName_ReturnsOk()
        {
            // Arrange
            var request = new DeleteLanguageRequest { LanguageName = "Spanish" };
            var expectedResponse = new BaseMutationResponse { IsSuccess = true };

            _languageManagementServiceMock
                .Setup(x => x.DeleteAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Delete(request);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task Delete_WithNullLanguageName_ReturnsBadRequest()
        {
            // Arrange
            var request = new DeleteLanguageRequest { LanguageName = null };

            // Act
            var result = await _controller.Delete(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task Delete_WithEmptyLanguageName_ReturnsBadRequest()
        {
            // Arrange
            var request = new DeleteLanguageRequest { LanguageName = "" };

            // Act
            var result = await _controller.Delete(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        #endregion

        #region SetDefault Tests

        [Fact]
        public async Task SetDefault_WithValidLanguageName_ReturnsOk()
        {
            // Arrange
            var request = new SetDefaultLanguageRequest { LanguageName = "English" };
            var expectedResponse = new BaseMutationResponse { IsSuccess = true };

            _languageManagementServiceMock
                .Setup(x => x.SetDefaultLanguage(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.SetDefault(request);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task SetDefault_WithNullLanguageName_ReturnsBadRequest()
        {
            // Arrange
            var request = new SetDefaultLanguageRequest { LanguageName = null };

            // Act
            var result = await _controller.SetDefault(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task SetDefault_WhenServiceFails_ReturnsBadRequest()
        {
            // Arrange
            var request = new SetDefaultLanguageRequest { LanguageName = "Spanish" };
            var failureResponse = new BaseMutationResponse { IsSuccess = false };

            _languageManagementServiceMock
                .Setup(x => x.SetDefaultLanguage(request))
                .ReturnsAsync(failureResponse);

            // Act
            var result = await _controller.SetDefault(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        #endregion

        [Fact]
        public async Task Gets_WithUnmappedProjectKey_ReturnsNull()
        {
            // No mock set up for this project key -> service returns default (null).
            var result = await _controller.Gets();

            result.Should().BeNull();
        }

        [Fact]
        public async Task Delete_WithNullRequest_ReturnsBadRequest()
        {
            // The null guard now returns BadRequest early instead of discarding it and
            // dereferencing the null request (which used to throw NullReferenceException).
            var result = await _controller.Delete(null);

            result.Should().BeOfType<BadRequestObjectResult>();
            _languageManagementServiceMock.Verify(x => x.DeleteAsync(It.IsAny<DeleteLanguageRequest>()), Times.Never);
        }

        [Fact]
        public async Task SetDefault_WithNullRequest_ReturnsBadRequest()
        {
            var result = await _controller.SetDefault(null);

            result.Should().BeOfType<BadRequestObjectResult>();
            _languageManagementServiceMock.Verify(x => x.SetDefaultLanguage(It.IsAny<SetDefaultLanguageRequest>()), Times.Never);
        }
    }
}
