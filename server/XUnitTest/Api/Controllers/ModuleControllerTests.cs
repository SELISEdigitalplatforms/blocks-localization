using Api.Controllers;
using Blocks.Genesis;
using BlocksTemplate.Api.Controllers;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace XUnitTest
{
    public class ModuleControllerTests
    {
        private readonly Mock<IModuleManagementService> _moduleManagementServiceMock;
        private readonly ModuleController _controller;

        public ModuleControllerTests()
        {
            _moduleManagementServiceMock = new Mock<IModuleManagementService>();

            
            _controller = new ModuleController(
                _moduleManagementServiceMock.Object
            )
            {
                ControllerContext = new ControllerContext()
            };
        }

        #region Save Tests

        [Fact]
        public async Task Save_WithValidModuleRequest_ReturnsSuccess()
        {
            // Arrange
            var module = new SaveModuleRequest
            {
                ModuleName = "AuthModule",
                
            };

            var expectedResponse = new ApiResponse { Success = true };

            _moduleManagementServiceMock
                .Setup(x => x.SaveModuleAsync(module))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Save(module);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            _moduleManagementServiceMock.Verify(x => x.SaveModuleAsync(module), Times.Once);
        }

        [Fact]
        public async Task Save_WithNullModule_ReturnsFailureWithoutCallingService()
        {
            // The null guard now returns a failed ApiResponse early instead of
            // discarding BadRequest and delegating the null argument to the service.
            var result = await _controller.Save(null);

            result.Should().NotBeNull();
            result.Success.Should().BeFalse();
            result.ErrorMessage.Should().Be("Module cannot be null.");
            _moduleManagementServiceMock.Verify(x => x.SaveModuleAsync(It.IsAny<SaveModuleRequest>()), Times.Never);
        }

        [Fact]
        public async Task Save_WhenServiceFails_ReturnsFailure()
        {
            // Arrange 
            var module = new SaveModuleRequest
            {
                ModuleName = "TestModule",
                
            };

            var failureResponse = new ApiResponse { Success = false, ErrorMessage = "Save failed" };

            _moduleManagementServiceMock
                .Setup(x => x.SaveModuleAsync(module))
                .ReturnsAsync(failureResponse);

            // Act
            var result = await _controller.Save(module);

            // Assert
            result.Success.Should().BeFalse();
        }

        #endregion

        #region Gets Tests

        [Fact]
        public async Task Gets_WithValidQuery_ReturnsModuleList()
        {
            // Arrange
            var query = new GetModulesQuery { };

            var expectedModules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ModuleName = "AuthModule" },
                new BlocksLanguageModule { ModuleName = "DashboardModule" }
            };

            _moduleManagementServiceMock
                .Setup(x => x.GetModulesAsync("test"))
                .ReturnsAsync(expectedModules);

            // Act
            var result = await _controller.Gets("test");

            // Assert
            result.Should().NotBeNull();
            result.Should().HaveCount(2);
        }

        [Fact]
        public async Task Gets_WithEmptyModuleList_ReturnsEmpty()
        {
            // Arrange
            var query = new GetModulesQuery { };

            _moduleManagementServiceMock
                .Setup(x => x.GetModulesAsync("test"))
                .ReturnsAsync(new List<BlocksLanguageModule>());

            // Act
            var result = await _controller.Gets("test");

            // Assert
            result.Should().BeEmpty();
        }

        [Fact]
        public async Task Gets_WhenServiceThrows_PropagatesException()
        {
            // Arrange
            var query = new GetModulesQuery { };

            _moduleManagementServiceMock
                .Setup(x => x.GetModulesAsync("test"))
                .ThrowsAsync(new Exception("Database error"));

            // Act
            Func<Task> act = async () => await _controller.Gets("test");

            // Assert
            await act.Should().ThrowAsync<Exception>();
        }

        #endregion

        [Fact]
        public async Task Gets_WithUnmappedProjectKey_ReturnsNull()
        {
            // No mock set up for the given project key -> service returns default (null).
            var result = await _controller.Gets("unmapped");

            result.Should().BeNull();
        }

        [Fact]
        public async Task GetCloudsModules_ReturnsAllModules()
        {
            var modules = new List<BlocksLanguageModule> { new BlocksLanguageModule { ModuleName = "auth" } };
            _moduleManagementServiceMock.Setup(x => x.GetModulesAsync((string?)null)).ReturnsAsync(modules);

            var result = await _controller.GetCloudsModules();

            result.Should().HaveCount(1);
        }

        [Fact]
        public async Task TagGlossary_WithValidRequest_ReturnsServiceResult()
        {
            var request = new TagGlossaryRequest { ModuleId = "m1", GlossaryIds = new List<string> { "g1" } };
            var response = new BaseMutationResponse { IsSuccess = true };
            _moduleManagementServiceMock.Setup(x => x.TagGlossaryAsync(request)).ReturnsAsync(response);

            var result = await _controller.TagGlossary(request);

            result.Should().BeSameAs(response);
        }

        [Fact]
        public async Task TagGlossary_WithNullRequest_ReturnsFailure()
        {
            var result = await _controller.TagGlossary(null);

            result.IsSuccess.Should().BeFalse();
            _moduleManagementServiceMock.Verify(x => x.TagGlossaryAsync(It.IsAny<TagGlossaryRequest>()), Times.Never);
        }
    }
}

