using Api.Controllers;
using Blocks.Genesis;
using BlocksTemplate.Api.Controllers;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared;
using Eurolm.DomainService.Shared.Entities;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace XUnitTest
{
    public class ConfigControllerTests
    {
        private readonly Mock<IWebHookService> _webHookServiceMock;
        private readonly ConfigController _controller;

        public ConfigControllerTests()
        {
            _webHookServiceMock = new Mock<IWebHookService>();

            var changeControllerContext = TestChangeControllerContextFactory.Create();
            
            _controller = new ConfigController(
                changeControllerContext,
                _webHookServiceMock.Object
            )
            {
                ControllerContext = new ControllerContext()
            };
        }

        [Fact]
        public async Task SaveWebHook_WithValidWebhook_ReturnsSuccess()
        {
            // Arrange
            var webhook = new BlocksWebhook
            {
                Url = "https://example.com/webhook",
                ContentType = "application/json",
                ProjectKey = "project-1",
                BlocksWebhookSecret = new BlocksWebhookSecret
                {
                    Secret = "secret-123",
                    HeaderKey = "X-Webhook-Secret"
                }
            };

            var expectedResponse = new ApiResponse
            {
                Success = true,
                ErrorMessage = null
            };

            _webHookServiceMock
                .Setup(x => x.SaveWebhookAsync(webhook))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.SaveWebHook(webhook);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            _webHookServiceMock.Verify(x => x.SaveWebhookAsync(webhook), Times.Once);
        }

        [Fact]
        public async Task SaveWebHook_WhenServiceFails_ReturnsFailure()
        {
            // Arrange
            var webhook = new BlocksWebhook
            {
                Url = "https://example.com/webhook",
                ContentType = "application/json",
                ProjectKey = "project-1",
                BlocksWebhookSecret = new BlocksWebhookSecret
                {
                    Secret = "secret-456",
                    HeaderKey = "X-Webhook-Secret"
                }
            };

            var failureResponse = new ApiResponse
            {
                Success = false,
                ErrorMessage = "Failed to save webhook"
            };

            _webHookServiceMock
                .Setup(x => x.SaveWebhookAsync(webhook))
                .ReturnsAsync(failureResponse);

            // Act
            var result = await _controller.SaveWebHook(webhook);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeFalse();
        }

        [Fact]
        public async Task SaveWebHook_WhenServiceThrows_PropagatesException()
        {
            // Arrange
            var webhook = new BlocksWebhook
            {
                Url = "https://example.com/webhook",
                ContentType = "application/json",
                ProjectKey = "project-1",
                BlocksWebhookSecret = new BlocksWebhookSecret
                {
                    Secret = "secret-789",
                    HeaderKey = "X-Webhook-Secret"
                }
            };

            _webHookServiceMock
                .Setup(x => x.SaveWebhookAsync(webhook))
                .ThrowsAsync(new Exception("Database error"));

            // Act
            Func<Task> act = async () => await _controller.SaveWebHook(webhook);

            // Assert
            await act.Should().ThrowAsync<Exception>();
        }

        [Fact]
        public async Task SaveWebHook_WithMultipleWebhooks_CallsServiceMultipleTimes()
        {
            // Arrange
            var webhook1 = new BlocksWebhook
            {
                Url = "https://example1.com/webhook",
                ContentType = "application/json",
                ProjectKey = "project-1",
                BlocksWebhookSecret = new BlocksWebhookSecret { Secret = "sec1", HeaderKey = "X-Key1" }
            };

            var webhook2 = new BlocksWebhook
            {
                Url = "https://example2.com/webhook",
                ContentType = "application/json",
                ProjectKey = "project-1",
                BlocksWebhookSecret = new BlocksWebhookSecret { Secret = "sec2", HeaderKey = "X-Key2" }
            };

            var response = new ApiResponse { Success = true };

            _webHookServiceMock
                .Setup(x => x.SaveWebhookAsync(It.IsAny<BlocksWebhook>()))
                .ReturnsAsync(response);

            // Act
            var result1 = await _controller.SaveWebHook(webhook1);
            var result2 = await _controller.SaveWebHook(webhook2);

            //Assert
            result1.Success.Should().BeTrue();
            result2.Success.Should().BeTrue();
            _webHookServiceMock.Verify(x => x.SaveWebhookAsync(It.IsAny<BlocksWebhook>()), Times.Exactly(2));
        }

        [Fact]
        public async Task SaveWebHook_WithNullWebhook_ThrowsNullReferenceException()
        {
            await Assert.ThrowsAsync<NullReferenceException>(() => _controller.SaveWebHook(null));
        }
    }
}
