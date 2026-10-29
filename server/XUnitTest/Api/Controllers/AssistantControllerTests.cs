using Api.Controllers;
using BlocksTemplate.Api.Controllers;
using Eurolm.DomainService.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using System.Net;

namespace XUnitTest
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
                .ReturnsAsync(new SuggestionResult { Content = expectedResponse });

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
                .ReturnsAsync(new SuggestionResult { Content = "" });

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
            _assistantServiceMock.Setup(x => x.SuggestTranslation(null)).ReturnsAsync((SuggestionResult)null);
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
            _assistantServiceMock.Setup(x => x.SuggestTranslation(request)).ReturnsAsync(new SuggestionResult());
            var result = await _controller.GetTranslationSuggestion(request);
            result.Should().NotBeNull();
            var objectResult = result as ObjectResult;
            objectResult.Should().NotBeNull();
            objectResult!.StatusCode.Should().Be((int)HttpStatusCode.OK);
        }

        [Fact]
        public async Task GetTranslationSuggestion_ReturnsContentAsAStringWithAppliedTermsAndViolationsAsSiblings()
        {
            var request = new SuggestLanguageRequest { SourceText = "Open your Workspace", DestinationLanguage = "German", CurrentLanguage = "English" };
            _assistantServiceMock.Setup(x => x.SuggestTranslation(request)).ReturnsAsync(new SuggestionResult
            {
                Content = "Öffnen Sie Ihren Arbeitsbereich",
                AppliedTerms = { new AppliedTerm { GlossaryId = "g1", Term = "Workspace", Rule = "translate", Expected = "Arbeitsbereich" } },
                GlossaryViolations = { new GlossaryViolationDto { GlossaryId = "g2", Term = "Portal", Kind = GlossaryViolationKinds.MissingKeep } }
            });

            var result = (ObjectResult)await _controller.GetTranslationSuggestion(request);
            var json = System.Text.Json.JsonSerializer.Serialize(result.Value,
                new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase });
            using var document = System.Text.Json.JsonDocument.Parse(json);
            var root = document.RootElement;

            root.GetProperty("content").GetString().Should().Be("Öffnen Sie Ihren Arbeitsbereich");
            root.GetProperty("appliedTerms")[0].GetProperty("expected").GetString().Should().Be("Arbeitsbereich");
            root.GetProperty("glossaryViolations")[0].GetProperty("kind").GetString().Should().Be("missing-keep");
        }

        [Fact]
        public async Task GetTranslationSuggestion_WithANullResult_ReturnsEmptyArrays()
        {
            var request = new SuggestLanguageRequest { SourceText = "Hi", DestinationLanguage = "fr", CurrentLanguage = "en" };
            _assistantServiceMock.Setup(x => x.SuggestTranslation(request)).ReturnsAsync((SuggestionResult)null!);

            var result = (ObjectResult)await _controller.GetTranslationSuggestion(request);
            var json = System.Text.Json.JsonSerializer.Serialize(result.Value,
                new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase });

            json.Should().Be("{\"content\":null,\"appliedTerms\":[],\"glossaryViolations\":[]}");
        }
    }
}
