using Blocks.Genesis;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared.Events;
using FluentAssertions;
using Moq;
using Worker.Consumers;

namespace XUnitTest.Worker
{
    /// <summary>Q1: A. The tenant webhook body keeps exactly its original fields; ForceUpload stays internal.</summary>
    public class GenerateUilmFilesWebhookBodyTests
    {
        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public async Task WebhookBody_IsUnchanged_WhateverForceUploadIs(bool forceUpload)
        {
            object? body = null;
            var webhooks = new Mock<IWebHookService>();
            webhooks.Setup(w => w.CallWebhook(It.IsAny<object>())).Callback<object>(b => body = b);
            var keys = new Mock<IKeyManagementService>();
            keys.Setup(k => k.GenerateAsync(It.IsAny<GenerateUilmFilesEvent>())).ReturnsAsync(true);

            await new GenerateUilmFilesConsumer(keys.Object, webhooks.Object, Mock.Of<IActionPublisher>())
                .Consume(new GenerateUilmFilesEvent { Guid = "g1", ModuleId = null, ProjectKey = "p1", ForceUpload = forceUpload });

            const string expected = "{\"GenerateUilmFilesEvent\":{\"Guid\":\"g1\",\"ModuleId\":null,\"ProjectKey\":\"p1\"}}";
            Newtonsoft.Json.JsonConvert.SerializeObject(body).Should().Be(expected);
            System.Text.Json.JsonSerializer.Serialize(body).Should().Be(expected);
        }
    }
}
