using BlocksTemplate.Api.Controllers;
using BlocksTemplate.DomainService.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using System.Net;

namespace BlocksTemplate.XUnitTest
{
    public class AssistantControllerTests
    {
        private readonly Mock<IAssistantService> _assistantServiceMock;
        private readonly AssistantController _controller;

        public AssistantControllerTests()
        {
            _assistantServiceMock = new Mock<IAssistantService>();

            // Create a loose mock that allows any method calls without throwing
            _controller = new AssistantController(_assistantServiceMock.Object)
            {
                ControllerContext = new ControllerContext()
            };
        }

        [Fact]
        public async Task GetTranslationSuggestion_WithValidRequest_ReturnsOk()
        {
            // Arrange
            var request = new SuggestLanguageRequest
            {
                SourceText = "Hello",
                DestinationLanguage = "es",
                CurrentLanguage = "en",
                ElementDetailContext = "greeting"
            };
            var expectedResponse = "Hola";

            _assistantServiceMock
                .Setup(x => x.SuggestTranslation(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.GetTranslationSuggestion(request);

            // Assert
            result.Should().NotBeNull();
            var objectResult = result as ObjectResult;
            objectResult.Should().NotBeNull();
            objectResult!.StatusCode.Should().Be((int)HttpStatusCode.OK);
            
            _assistantServiceMock.Verify(x => x.SuggestTranslation(request), Times.Once);
        }

        [Fact]
        public async Task GetTranslationSuggestion_WithEmptySourceText_ReturnsEmpty()
        {
            // Arrange
            var request = new SuggestLanguageRequest
            {
                SourceText = "",
                DestinationLanguage = "es",
                CurrentLanguage = "en"
            };

            _assistantServiceMock
                .Setup(x => x.SuggestTranslation(request))
                .ReturnsAsync("");

            // Act
            var result = await _controller.GetTranslationSuggestion(request);

            // Assert
            result.Should().NotBeNull();
            var objectResult = result as ObjectResult;
            objectResult.Should().NotBeNull();
            objectResult!.StatusCode.Should().Be((int)HttpStatusCode.OK);
        }

        [Fact]
        public async Task GetTranslationSuggestion_WhenServiceThrows_PropagatesException()
        {
            // Arrange
            var request = new SuggestLanguageRequest
            {
                SourceText = "Test",
                DestinationLanguage = "fr",
                CurrentLanguage = "en"
            };

            _assistantServiceMock
                .Setup(x => x.SuggestTranslation(request))
                .ThrowsAsync(new Exception("Translation service error"));

            // Act
            Func<Task> act = async () => await _controller.GetTranslationSuggestion(request);

            // Assert
            await act.Should().ThrowAsync<Exception>();
        }

        [Fact]
        public async Task GetTranslationSuggestion_WithNullRequest_StillReturnsOk()
        {
            _assistantServiceMock.Setup(x => x.SuggestTranslation(null)).ReturnsAsync((string)null);
            var result = await _controller.GetTranslationSuggestion(null);
            result.Should().NotBeNull();
            var objectResult = result as ObjectResult;
            objectResult.Should().NotBeNull();
            objectResult!.StatusCode.Should().Be((int)HttpStatusCode.OK);
        }

        [Fact]
        public async Task GetTranslationSuggestion_WhenServiceReturnsNull_ReturnsOkWithNullContent()
        {
            var request = new SuggestLanguageRequest
            {
                SourceText = "Test",
                DestinationLanguage = "fr",
                CurrentLanguage = "en",
                ElementDetailContext = "context"
            };
            _assistantServiceMock.Setup(x => x.SuggestTranslation(request)).ReturnsAsync((string)null);
            var result = await _controller.GetTranslationSuggestion(request);
            result.Should().NotBeNull();
            var objectResult = result as ObjectResult;
            objectResult.Should().NotBeNull();
            objectResult!.StatusCode.Should().Be((int)HttpStatusCode.OK);
        }
    }
}
