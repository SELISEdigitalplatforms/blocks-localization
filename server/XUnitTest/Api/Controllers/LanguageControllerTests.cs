using Api.Controllers;
using Blocks.Genesis;
using BlocksTemplate.DomainService.Services;
using BlocksTemplate.DomainService.Shared;
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

            var changeControllerContext = TestChangeControllerContextFactory.Create();

            _controller = new LanguageController(
                _languageManagementServiceMock.Object,
                changeControllerContext
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
        public async Task Save_WithNullLanguage_ThrowsNullReferenceException()
        {
            // Act & Assert
            await Assert.ThrowsAsync<NullReferenceException>(() => _controller.Save(null));
        }

        #endregion

        #region Gets Tests

        [Fact]
        public async Task Gets_WithValidRequest_ReturnsLanguageList()
        {
            // Arrange
            var request = new GetLanguagesRequest { ProjectKey = "project-1" };
            var expectedLanguages = new List<Language>
            {
                new Language { LanguageName = "English", LanguageCode = "en" },
                new Language { LanguageName = "Spanish", LanguageCode = "es" }
            };

            _languageManagementServiceMock
                .Setup(x => x.GetLanguagesAsync())
                .ReturnsAsync(expectedLanguages);

            // Act
            var result = await _controller.Gets(request);

            // Assert
            result.Should().NotBeNull();
            result.Should().HaveCount(2);
        }

        [Fact]
        public async Task Gets_WithEmptyLanguageList_ReturnsEmpty()
        {
            // Arrange
            var request = new GetLanguagesRequest { ProjectKey = "project-1" };

            _languageManagementServiceMock
                .Setup(x => x.GetLanguagesAsync())
                .ReturnsAsync(new List<Language>());

            // Act
            var result = await _controller.Gets(request);

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
                .Setup(x => x.DeleteAsysnc(request))
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
        public async Task Gets_WithNullRequest_ThrowsNullReferenceException()
        {
            await Assert.ThrowsAsync<NullReferenceException>(() => _controller.Gets(null));
        }

        [Fact]
        public async Task Delete_WithNullRequest_ThrowsNullReferenceException()
        {
            await Assert.ThrowsAsync<NullReferenceException>(() => _controller.Delete(null));
        }
    }
}
