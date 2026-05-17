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
                ProjectKey = "project-1"
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
        public async Task Save_WithNullModule_ThrowsNullReferenceException()
        {
            // Act & Assert
            await Assert.ThrowsAsync<NullReferenceException>(() => _controller.Save(null));
        }

        [Fact]
        public async Task Save_WhenServiceFails_ReturnsFailure()
        {
            // Arrange 
            var module = new SaveModuleRequest
            {
                ModuleName = "TestModule",
                ProjectKey = "project-1"
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
            var query = new GetModulesQuery { ProjectKey = "project-1" };

            var expectedModules = new List<BlocksLanguageModule>
            {
                new BlocksLanguageModule { ModuleName = "AuthModule" },
                new BlocksLanguageModule { ModuleName = "DashboardModule" }
            };

            _moduleManagementServiceMock
                .Setup(x => x.GetModulesAsync(null))
                .ReturnsAsync(expectedModules);

            // Act
            var result = await _controller.Gets(query);

            // Assert
            result.Should().NotBeNull();
            result.Should().HaveCount(2);
        }

        [Fact]
        public async Task Gets_WithEmptyModuleList_ReturnsEmpty()
        {
            // Arrange
            var query = new GetModulesQuery { ProjectKey = "project-1" };

            _moduleManagementServiceMock
                .Setup(x => x.GetModulesAsync(null))
                .ReturnsAsync(new List<BlocksLanguageModule>());

            // Act
            var result = await _controller.Gets(query);

            // Assert
            result.Should().BeEmpty();
        }

        [Fact]
        public async Task Gets_WhenServiceThrows_PropagatesException()
        {
            // Arrange
            var query = new GetModulesQuery { ProjectKey = "project-1" };

            _moduleManagementServiceMock
                .Setup(x => x.GetModulesAsync(null))
                .ThrowsAsync(new Exception("Database error"));

            // Act
            Func<Task> act = async () => await _controller.Gets(query);

            // Assert
            await act.Should().ThrowAsync<Exception>();
        }

        #endregion

        [Fact]
        public async Task Save_WithNullModule_ThrowsNullReferenceException2()
        {
            await Assert.ThrowsAsync<NullReferenceException>(() => _controller.Save(null));
        }

        [Fact]
        public async Task Gets_WithNullQuery_ThrowsNullReferenceException()
        {
            await Assert.ThrowsAsync<NullReferenceException>(() => _controller.Gets(null));
        }
    }
}

