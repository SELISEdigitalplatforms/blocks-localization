using Api.Controllers;
using Blocks.Genesis;
using BlocksTemplate.Api.Controllers;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared;
using FluentAssertions;
using FluentValidation;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace XUnitTest
{
    public class KeyControllerTests
    {
        private readonly Mock<IKeyManagementService> _keyManagementServiceMock;
        private readonly Mock<IValidator<TranslateBlocksLanguageKeyRequest>> _validatorMock;
        private readonly Mock<IValidator<TranslateBlocksLanguageKeysRequest>> _validatorsMock;
        private readonly KeyController _controller;

        public KeyControllerTests()
        {
            _keyManagementServiceMock = new Mock<IKeyManagementService>();
            _validatorMock = new Mock<IValidator<TranslateBlocksLanguageKeyRequest>>();
            _validatorsMock = new Mock<IValidator<TranslateBlocksLanguageKeysRequest>>();

            
            var httpContext = new DefaultHttpContext();
            _controller = new KeyController(_keyManagementServiceMock.Object, _validatorMock.Object, _validatorsMock.Object)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = httpContext
                }
            };
        }

        #region Save Tests

        [Fact]
        public async Task Save_WithValidKey_ReturnsSuccess()
        {
            // Arrange
            var key = new Key { KeyName = "TestKey", ModuleId = "module-1" };
            var expectedResponse = new ApiResponse { Success = true };

            _keyManagementServiceMock
                .Setup(x => x.SaveKeyAsync(key))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Save(key);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            _keyManagementServiceMock.Verify(x => x.SaveKeyAsync(key), Times.Once);
        }

        [Fact]
        public async Task Save_WithNullKey_ReturnsFailureWithoutCallingService()
        {
            var result = await _controller.Save(null);

            result.Should().NotBeNull();
            result.Success.Should().BeFalse();
            result.ErrorMessage.Should().Be("Key cannot be null.");
            _keyManagementServiceMock.Verify(x => x.SaveKeyAsync(It.IsAny<Key>()), Times.Never);
        }

        #endregion

        #region SaveKeys Tests

        [Fact]
        public async Task SaveKeys_WithValidKeyList_ReturnsSuccess()
        {
            // Arrange
            var keys = new List<Key> { new Key { KeyName = "Key1" }, new Key { KeyName = "Key2" } };
            var expectedResponse = new ApiResponse { Success = true };

            _keyManagementServiceMock
                .Setup(x => x.SaveKeysAsync(keys))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.SaveKeys(keys);

            // Assert
            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task SaveKeys_WithEmptyList_ReturnsFalse()
        {
            // Arrange
            var keys = new List<Key>();

            // Act
            var result = await _controller.SaveKeys(keys);

            // Assert
            result.Success.Should().BeFalse();
        }

        #endregion

        #region Gets Tests

        [Fact]
        public async Task Gets_WithValidQuery_ReturnsKeyList()
        {
            // Arrange
            var query = new GetKeysRequest {  PageSize = 10 };
            var expectedResponse = new GetKeysQueryResponse { Keys = new List<Key> { new Key { KeyName = "Key1" } } };

            _keyManagementServiceMock
                .Setup(x => x.GetKeysAsync(query))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Gets(query);

            // Assert
            result.Keys.Should().HaveCount(1);
        }

        [Fact]
        public async Task Gets_WithKeySearchText_ReturnsFilteredKeys()
        {
            // Arrange
            var query = new GetKeysRequest {  PageSize = 10, KeySearchText = "welcome" };
            var expectedResponse = new GetKeysQueryResponse { Keys = new List<Key> { new Key { KeyName = "WELCOME_MESSAGE" } } };

            _keyManagementServiceMock
                .Setup(x => x.GetKeysAsync(query))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Gets(query);

            // Assert
            result.Keys.Should().HaveCount(1);
            result.Keys[0].KeyName.Should().Contain("WELCOME");
        }

        [Fact]
        public async Task Gets_WithResourceSearchFilters_ReturnsFilteredKeys()
        {
            // Arrange
            var query = new GetKeysRequest
            {
                
                PageSize = 10,
                ResourceSearchFilters = new[]
                {
                    new ResourceSearchFilter { Culture = "en", SearchText = "hello" },
                    new ResourceSearchFilter { Culture = "fr", SearchText = "bonjour" }
                }
            };
            var expectedResponse = new GetKeysQueryResponse
            {
                Keys = new List<Key>
                {
                    new Key
                    {
                        KeyName = "GREETING",
                        Resources = new[]
                        {
                            new Resource { Culture = "en", Value = "Hello World" },
                            new Resource { Culture = "fr", Value = "Bonjour le monde" }
                        }
                    }
                }
            };

            _keyManagementServiceMock
                .Setup(x => x.GetKeysAsync(query))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Gets(query);

            // Assert
            result.Keys.Should().HaveCount(1);
            result.Keys[0].KeyName.Should().Be("GREETING");
        }

        [Fact]
        public async Task Gets_WithKeySearchTextAndResourceSearchFilters_ReturnsFilteredKeys()
        {
            // Arrange
            var query = new GetKeysRequest
            {
         
                PageSize = 10,
                KeySearchText = "GREET",
                ResourceSearchFilters = new[]
                {
                    new ResourceSearchFilter { Culture = "en", SearchText = "hello" }
                }
            };
            var expectedResponse = new GetKeysQueryResponse
            {
                Keys = new List<Key>
                {
                    new Key
                    {
                        KeyName = "GREETING",
                        Resources = new[] { new Resource { Culture = "en", Value = "Hello" } }
                    }
                }
            };

            _keyManagementServiceMock
                .Setup(x => x.GetKeysAsync(query))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Gets(query);

            // Assert
            result.Keys.Should().HaveCount(1);
            _keyManagementServiceMock.Verify(x => x.GetKeysAsync(It.Is<GetKeysRequest>(
                r => r.KeySearchText == "GREET" && r.ResourceSearchFilters!.Length == 1)), Times.Once);
        }

        [Fact]
        public async Task Gets_WithEmptyResourceSearchFilters_ReturnsAllKeys()
        {
            // Arrange
            var query = new GetKeysRequest
            {
               
                PageSize = 10,
                ResourceSearchFilters = Array.Empty<ResourceSearchFilter>()
            };
            var expectedResponse = new GetKeysQueryResponse
            {
                Keys = new List<Key>
                {
                    new Key { KeyName = "Key1" },
                    new Key { KeyName = "Key2" }
                },
                TotalCount = 2
            };

            _keyManagementServiceMock
                .Setup(x => x.GetKeysAsync(query))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Gets(query);

            // Assert
            result.Keys.Should().HaveCount(2);
            result.TotalCount.Should().Be(2);
        }

        [Fact]
        public async Task Gets_WithNullResourceSearchFilters_ReturnsKeys()
        {
            // Arrange
            var query = new GetKeysRequest
            {
                
                PageSize = 10,
                ResourceSearchFilters = null
            };
            var expectedResponse = new GetKeysQueryResponse
            {
                Keys = new List<Key> { new Key { KeyName = "Key1" } },
                TotalCount = 1
            };

            _keyManagementServiceMock
                .Setup(x => x.GetKeysAsync(query))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Gets(query);

            // Assert
            result.Keys.Should().HaveCount(1);
        }

        [Fact]
        public async Task Gets_WithSearchKey_ReturnsFilteredKeys()
        {
            // Arrange
            var query = new GetKeysRequest {  PageSize = 10, SearchKey = "welcome" };
            var expectedResponse = new GetKeysQueryResponse { Keys = new List<Key> { new Key { KeyName = "WELCOME_MESSAGE" } } };

            _keyManagementServiceMock
                .Setup(x => x.GetKeysAsync(query))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Gets(query);

            // Assert
            result.Keys.Should().HaveCount(1);
            result.Keys[0].KeyName.Should().Contain("WELCOME");
        }

        [Fact]
        public async Task Gets_WithSearchKeyAndResourceSearchFilters_ReturnsFilteredKeys()
        {
            // Arrange
            var query = new GetKeysRequest
            {
                
                PageSize = 10,
                SearchKey = "GREET",
                ResourceSearchFilters = new[]
                {
                    new ResourceSearchFilter { Culture = "en", SearchText = "hello" }
                }
            };
            var expectedResponse = new GetKeysQueryResponse
            {
                Keys = new List<Key>
                {
                    new Key
                    {
                        KeyName = "GREETING",
                        Resources = new[] { new Resource { Culture = "en", Value = "Hello" } }
                    }
                }
            };

            _keyManagementServiceMock
                .Setup(x => x.GetKeysAsync(query))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Gets(query);

            // Assert
            result.Keys.Should().HaveCount(1);
            _keyManagementServiceMock.Verify(x => x.GetKeysAsync(It.Is<GetKeysRequest>(
                r => r.SearchKey == "GREET" && r.ResourceSearchFilters!.Length == 1)), Times.Once);
        }

        [Fact]
        public async Task Gets_WithLastUpdateDateRange_ReturnsFilteredKeys()
        {
            // Arrange
            var query = new GetKeysRequest
            {
                
                PageSize = 10,
                LastUpdateDateRange = new DateRange
                {
                    StartDate = new DateTime(2025, 1, 1),
                    EndDate = new DateTime(2025, 12, 31)
                }
            };
            var expectedResponse = new GetKeysQueryResponse
            {
                Keys = new List<Key> { new Key { KeyName = "Key1" } },
                TotalCount = 1
            };

            _keyManagementServiceMock
                .Setup(x => x.GetKeysAsync(query))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Gets(query);

            // Assert
            result.Keys.Should().HaveCount(1);
            _keyManagementServiceMock.Verify(x => x.GetKeysAsync(It.Is<GetKeysRequest>(
                r => r.LastUpdateDateRange != null
                    && r.LastUpdateDateRange.StartDate == new DateTime(2025, 1, 1)
                    && r.LastUpdateDateRange.EndDate == new DateTime(2025, 12, 31))), Times.Once);
        }

        [Fact]
        public async Task Gets_WithLastUpdateDateRangeStartDateOnly_ReturnsFilteredKeys()
        {
            // Arrange
            var query = new GetKeysRequest
            {
                
                PageSize = 10,
                LastUpdateDateRange = new DateRange
                {
                    StartDate = new DateTime(2025, 6, 1)
                }
            };
            var expectedResponse = new GetKeysQueryResponse
            {
                Keys = new List<Key> { new Key { KeyName = "Key1" }, new Key { KeyName = "Key2" } },
                TotalCount = 2
            };

            _keyManagementServiceMock
                .Setup(x => x.GetKeysAsync(query))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Gets(query);

            // Assert
            result.Keys.Should().HaveCount(2);
        }

        [Fact]
        public async Task Gets_WithBothDateRanges_ReturnsFilteredKeys()
        {
            // Arrange
            var query = new GetKeysRequest
            {
                
                PageSize = 10,
                CreateDateRange = new DateRange
                {
                    StartDate = new DateTime(2024, 1, 1),
                    EndDate = new DateTime(2024, 12, 31)
                },
                LastUpdateDateRange = new DateRange
                {
                    StartDate = new DateTime(2025, 1, 1),
                    EndDate = new DateTime(2025, 6, 30)
                }
            };
            var expectedResponse = new GetKeysQueryResponse
            {
                Keys = new List<Key> { new Key { KeyName = "Key1" } },
                TotalCount = 1
            };

            _keyManagementServiceMock
                .Setup(x => x.GetKeysAsync(query))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Gets(query);

            // Assert
            result.Keys.Should().HaveCount(1);
            _keyManagementServiceMock.Verify(x => x.GetKeysAsync(It.Is<GetKeysRequest>(
                r => r.CreateDateRange != null && r.LastUpdateDateRange != null)), Times.Once);
        }

        #endregion

        #region Get Tests

        [Fact]
        public async Task Get_WithValidRequest_ReturnsKey()
        {
            // Arrange
            var request = new GetKeyRequest { };
            var expectedKey = new Key { KeyName = "TestKey" };

            _keyManagementServiceMock
                .Setup(x => x.GetAsync(request))
                .ReturnsAsync(expectedKey);

            // Act
            var result = await _controller.Get(request);

            // Assert
            result.Should().NotBeNull();
            result.KeyName.Should().Be("TestKey");
        }

        [Fact]
        public async Task Get_WhenKeyNotFound_ReturnsNull()
        {
            // Arrange
            var request = new GetKeyRequest { };

            _keyManagementServiceMock
                .Setup(x => x.GetAsync(request))
                .ReturnsAsync((Key)null);

            // Act
            var result = await _controller.Get(request);

            // Assert
            result.Should().BeNull();
        }

        #endregion

        #region Delete Tests

        [Fact]
        public async Task Delete_WithValidItemId_ReturnsOk()
        {
            // Arrange
            var request = new DeleteKeyRequest { ItemId = "key-1" };
            var expectedResponse = new BaseMutationResponse { IsSuccess = true };

            _keyManagementServiceMock
                .Setup(x => x.DeleteAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Delete(request);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task Delete_WithNullItemId_ReturnsBadRequest()
        {
            // Arrange
            var request = new DeleteKeyRequest { ItemId = null };

            // Act
            var result = await _controller.Delete(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task Delete_WithEmptyItemId_ReturnsBadRequest()
        {
            // Arrange
            var request = new DeleteKeyRequest { ItemId = "" };

            // Act
            var result = await _controller.Delete(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task Delete_WhenServiceFails_ReturnsBadRequest()
        {
            // Arrange
            var request = new DeleteKeyRequest { ItemId = "key-1" };
            var failureResponse = new BaseMutationResponse { IsSuccess = false };

            _keyManagementServiceMock
                .Setup(x => x.DeleteAsync(request))
                .ReturnsAsync(failureResponse);

            // Act
            var result = await _controller.Delete(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        #endregion

        #region GenerateUilmFile Tests

        [Fact]
        public async Task GenerateUilmFile_WithValidRequest_ReturnsOk()
        {
            // Arrange
            var request = new GenerateUilmRequest {  Guid = Guid.NewGuid().ToString() };

            // Act
            var result = await _controller.GenerateUilmFile(request);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task GenerateUilmFile_WithNullRequest_ReturnsBadRequest()
        {
            // Act
            var result = await _controller.GenerateUilmFile(null);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        #endregion

        #region TranslateAll Tests

        [Fact]
        public async Task TranslateAll_WithValidProjectKey_ReturnsOk()
        {
            // Arrange
            var request = new TranslateAllRequest { };

            // Act
            var result = await _controller.TranslateAll(request);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task TranslateAll_WithNonNullRequest_ReturnsOk()
        {
            // Project key now comes from the ambient context, not the request, so any
            // non-null request is accepted and the translate-all event is published.
            var request = new TranslateAllRequest { };

            var result = await _controller.TranslateAll(request);

            result.Should().BeOfType<OkObjectResult>();
            _keyManagementServiceMock.Verify(x => x.SendTranslateAllEvent(request), Times.Once);
        }

        #endregion

        #region TranslateKey Tests

        [Fact]
        public async Task TranslateKey_WithValidRequest_ReturnsOk()
        {
            // Arrange
            var request = new TranslateBlocksLanguageKeyRequest
            {
                KeyId = "key-1",
               
                MessageCoRelationId = "corr-123",
                DefaultLanguage = "en"
            };

            var validationResult = new FluentValidation.Results.ValidationResult();
            _validatorMock
                .Setup(x => x.ValidateAsync(request, CancellationToken.None))
                .ReturnsAsync(validationResult);

            // Act
            var result = await _controller.TranslateKey(request);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task TranslateKey_WithNullRequest_ReturnsBadRequest()
        {
            // Act
            var result = await _controller.TranslateKey(null);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task TranslateKey_WithInvalidRequest_ReturnsBadRequest()
        {
            // Arrange
            var request = new TranslateBlocksLanguageKeyRequest
            {
                KeyId = "",
              
                MessageCoRelationId = "",
                DefaultLanguage = "en"
            };

            var validationResult = new FluentValidation.Results.ValidationResult(
                new[] { new FluentValidation.Results.ValidationFailure("KeyId", "KeyId is required") }
            );

            _validatorMock
                .Setup(x => x.ValidateAsync(request, CancellationToken.None))
                .ReturnsAsync(validationResult);

            // Act
            var result = await _controller.TranslateKey(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        #endregion

        #region UilmImport Tests

        [Fact]
        public async Task UilmImport_WithValidRequest_ReturnsOk()
        {
            // Arrange
            var request = new UilmImportRequest { FileId = "file-123" };

            // Act
            var result = await _controller.UilmImport(request);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task UilmImport_WithNonNullRequest_ReturnsOk()
        {
            var request = new UilmImportRequest { FileId = "file-123" };

            var result = await _controller.UilmImport(request);

            result.Should().BeOfType<OkObjectResult>();
            _keyManagementServiceMock.Verify(x => x.SendUilmImportEvent(request), Times.Once);
        }

        #endregion

        #region UilmExport Tests

        [Fact]
        public async Task UilmExport_WithValidRequest_ReturnsOk()
        {
            // Arrange
            var request = new UilmExportRequest {  };

            // Act
            var result = await _controller.UilmExport(request);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task UilmExport_WithNonNullRequest_ReturnsOk()
        {
            var request = new UilmExportRequest { };

            var result = await _controller.UilmExport(request);

            result.Should().BeOfType<OkObjectResult>();
            _keyManagementServiceMock.Verify(x => x.SendUilmExportEvent(request), Times.Once);
        }

        #endregion

        #region DeleteCollections Tests

        [Fact]
        public async Task DeleteCollections_WithValidCollections_ReturnsOk()
        {
            // Arrange
            var request = new DeleteCollectionsRequest { Collections = new List<string> { "col1", "col2" } };
            var expectedResponse = new BaseMutationResponse { IsSuccess = true };

            _keyManagementServiceMock
                .Setup(x => x.DeleteCollectionsAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.DeleteCollections(request);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task DeleteCollections_WithEmptyCollections_ReturnsBadRequest()
        {
            // Arrange
            var request = new DeleteCollectionsRequest { Collections = new List<string>() };

            // Act
            var result = await _controller.DeleteCollections(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        #endregion

        #region GetUilmExportedFiles Tests

        [Fact]
        public async Task GetUilmExportedFiles_WithValidPagination_ReturnsOk()
        {
            // Arrange
            var request = new GetUilmExportedFilesRequest { PageNumber = 0, PageSize = 10 };
            var expectedResponse = new GetUilmExportedFilesQueryResponse();

            _keyManagementServiceMock
                .Setup(x => x.GetUilmExportedFilesAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.GetUilmExportedFiles(request);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task GetUilmExportedFiles_WithInvalidPageSize_ReturnsBadRequest()
        {
            // Arrange
            var request = new GetUilmExportedFilesRequest { PageNumber = 0, PageSize = 0 };

            // Act
            var result = await _controller.GetUilmExportedFiles(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        #endregion

        #region GetLanguageFileGenerationHistory Tests

        [Fact]
        public async Task GetLanguageFileGenerationHistory_WithValidPagination_ReturnsOk()
        {
            // Arrange
            var request = new GetLanguageFileGenerationHistoryRequest { PageNumber = 0, PageSize = 10 };
            var expectedResponse = new GetLanguageFileGenerationHistoryResponse();

            _keyManagementServiceMock
                .Setup(x => x.GetLanguageFileGenerationHistoryAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.GetLanguageFileGenerationHistory(request);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task GetLanguageFileGenerationHistory_WithInvalidPageSize_ReturnsBadRequest()
        {
            // Arrange
            var request = new GetLanguageFileGenerationHistoryRequest { PageNumber = 0, PageSize = 0 };

            // Act
            var result = await _controller.GetLanguageFileGenerationHistory(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        #endregion

        #region RollBack Tests

        [Fact]
        public async Task RollBack_WithValidItemId_ReturnsOk()
        {
            // Arrange
            var request = new RollbackRequest { ItemId = "key-1" };
            var expectedResponse = new BaseMutationResponse { IsSuccess = true };

            _keyManagementServiceMock
                .Setup(x => x.RollbackAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.RollBack(request);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task RollBack_WithNullItemId_ReturnsBadRequest()
        {
            // Arrange
            var request = new RollbackRequest { ItemId = null };

            // Act
            var result = await _controller.RollBack(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        #endregion

        #region GetTimeline Tests

        [Fact]
        public async Task GetTimeline_WithValidRequest_ReturnsTimeline()
        {
            // Arrange
            var query = new GetKeyTimelineRequest { EntityId = "key-1", PageSize = 10 };
            var expectedResponse = new GetKeyTimelineQueryResponse();

            _keyManagementServiceMock
                .Setup(x => x.GetKeyTimelineAsync(query))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.GetTimeline(query);

            // Assert
            result.Should().NotBeNull();
        }

        #endregion

        [Fact]
        public async Task GetsByKeyNames_WithNullRequest_ReturnsError()
        {
            var result = await _controller.GetsByKeyNames(null);
            result.ErrorMessage.Should().Be("Request cannot be null.");
        }

        [Fact]
        public async Task GetTimeline_WithNullQuery_ReturnsEmptyWithoutCallingService()
        {
            // The null guard now returns an empty response early instead of discarding
            // BadRequest and passing the null query through to the service.
            var result = await _controller.GetTimeline(null);

            result.Should().NotBeNull();
            result.Timelines.Should().BeEmpty();
            result.TotalCount.Should().Be(0);
            _keyManagementServiceMock.Verify(x => x.GetKeyTimelineAsync(It.IsAny<GetKeyTimelineRequest>()), Times.Never);
        }

        [Fact]
        public async Task Gets_WithNullQuery_ReturnsEmptyWithoutCallingService()
        {
            var result = await _controller.Gets(null);

            result.Should().NotBeNull();
            result.Keys.Should().NotBeNull();
            result.Keys.Should().BeEmpty();
            result.TotalCount.Should().Be(0);
            _keyManagementServiceMock.Verify(x => x.GetKeysAsync(It.IsAny<GetKeysRequest>()), Times.Never);
        }

        [Fact]
        public async Task GetLocalizationTimeline_WithNullQuery_ReturnsEmptyWithoutCallingService()
        {
            var result = await _controller.GetLocalizationTimeline(null);

            result.Should().NotBeNull();
            result.Operations.Should().BeEmpty();
            result.TotalCount.Should().Be(0);
            _keyManagementServiceMock.Verify(x => x.GetLocalizationTimelineAsync(It.IsAny<GetLocalizationTimelineRequest>()), Times.Never);
        }

        [Fact]
        public async Task Get_WithNullRequest_ReturnsNull()
        {
            var result = await _controller.Get(null);

            result.Should().BeNull();
        }

        [Fact]
        public async Task Get_WhenKeyNotFound_ReturnsNullAndBadRequest()
        {
            var request = new GetKeyRequest();
            _keyManagementServiceMock.Setup(x => x.GetAsync(request)).ReturnsAsync((Key)null);
            var result = await _controller.Get(request);
            result.Should().BeNull();
        }

        [Fact]
        public async Task Delete_WithNullRequest_ReturnsBadRequest()
        {
            var result = await _controller.Delete(null);
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task GetCloudUilmFile_WhenNoContent_WritesEmptyBodyWithOkStatus()
        {
            var request = new GetUilmFileRequest { };
            var context = new DefaultHttpContext();
            context.Response.Body = new MemoryStream();
            _controller.ControllerContext.HttpContext = context;

            _keyManagementServiceMock.Setup(x => x.GetUilmFile(request)).ReturnsAsync((string)null);

            await _controller.GetCloudUilmFile(request);

            context.Response.StatusCode.Should().Be(200);
            context.Response.ContentType.Should().Be("application/json");
        }

        [Fact]
        public async Task TranslateAll_WithNullRequest_ReturnsBadRequest()
        {
            // Null request is now short-circuited with BadRequest instead of flowing to the service.
            var result = await _controller.TranslateAll(null);

            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task TranslateKey_WithInvalidModel_ReturnsBadRequest()
        {
            var request = new TranslateBlocksLanguageKeyRequest
            {
                KeyId = "k1",
                MessageCoRelationId = "m1",
               
                DefaultLanguage = "en"
            };
            _validatorMock.Setup(x => x.ValidateAsync(request, default)).ReturnsAsync(new FluentValidation.Results.ValidationResult(new[] {
                new FluentValidation.Results.ValidationFailure("Field", "Error")
            }));
            var result = await _controller.TranslateKey(request);
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task UilmImport_WithNullRequest_ReturnsBadRequest()
        {
            var result = await _controller.UilmImport(null);
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task UilmImport_WithFileId_ReturnsOk()
        {
            var request = new UilmImportRequest { FileId = "f1" };
            var result = await _controller.UilmImport(request);
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task UilmExport_WithNullRequest_ReturnsBadRequest()
        {
            var result = await _controller.UilmExport(null);
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task UilmExport_WithNonNullRequest_ReturnsOkResult()
        {
            var request = new UilmExportRequest {};
            var result = await _controller.UilmExport(request);
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task DeleteCollections_WithNullRequest_ReturnsBadRequest()
        {
            var result = await _controller.DeleteCollections(null);
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task GetUilmExportedFiles_WithNullRequest_ReturnsBadRequest()
        {
            var result = await _controller.GetUilmExportedFiles(null);
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task GetUilmExportedFiles_WithInvalidPagination_ReturnsBadRequest()
        {
            var request = new GetUilmExportedFilesRequest { PageSize = 0, PageNumber = -1 };
            var result = await _controller.GetUilmExportedFiles(request);
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task GetLocalizationTimeline_ReturnsServiceResult()
        {
            var query = new GetLocalizationTimelineRequest { PageNumber = 1, PageSize = 10 };
            var response = new GetLocalizationTimelineResponse { TotalCount = 3 };
            _keyManagementServiceMock.Setup(x => x.GetLocalizationTimelineAsync(query)).ReturnsAsync(response);

            var result = await _controller.GetLocalizationTimeline(query);

            result.Should().BeSameAs(response);
        }

        [Fact]
        public async Task GetTimelineByOperationId_ReturnsServiceResult()
        {
            var query = new GetTimelineByOperationIdRequest { OperationId = "op1", PageNumber = 1, PageSize = 10 };
            var response = new GetKeyTimelineQueryResponse { TotalCount = 2 };
            _keyManagementServiceMock.Setup(x => x.GetTimelineByOperationIdAsync(query)).ReturnsAsync(response);

            var result = await _controller.GetTimelineByOperationId(query);

            result.Should().BeSameAs(response);
        }

        [Fact]
        public async Task GetUilmFile_ClientOverload_WritesJsonContent()
        {
            var request = new GetUilmFileRequestForClient { Language = "en", ModuleName = "auth", projectKey = "p1" };
            var context = new DefaultHttpContext();
            context.Response.Body = new MemoryStream();
            _controller.ControllerContext.HttpContext = context;
            _keyManagementServiceMock.Setup(x => x.GetUilmFile(request)).ReturnsAsync("{\"k\":1}");

            await _controller.GetUilmFile(request);

            context.Response.ContentType.Should().Be("application/json");
            context.Response.Body.Seek(0, SeekOrigin.Begin);
            new StreamReader(context.Response.Body).ReadToEnd().Should().Be("{\"k\":1}");
        }

        [Fact]
        public async Task TranslateKeys_WithValidRequest_ReturnsOk()
        {
            var request = new TranslateBlocksLanguageKeysRequest
            {
                KeyIds = new List<string> { "k1" },
                MessageCoRelationId = "c1",
                ProjectKey = "p1",
                DefaultLanguage = "en"
            };
            _validatorsMock.Setup(x => x.ValidateAsync(request, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new FluentValidation.Results.ValidationResult());

            var result = await _controller.TranslateKeys(request);

            result.Should().BeOfType<OkObjectResult>();
            _keyManagementServiceMock.Verify(x => x.SendTranslateBlocksLanguageKeysEvent(request), Times.Once);
        }

        [Fact]
        public async Task TranslateKeys_WithNullRequest_ReturnsBadRequest()
        {
            var result = await _controller.TranslateKeys(null);
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task TranslateKeys_WithInvalidRequest_ReturnsBadRequest()
        {
            var request = new TranslateBlocksLanguageKeysRequest
            {
                KeyIds = new List<string>(),
                MessageCoRelationId = "",
                ProjectKey = "p1",
                DefaultLanguage = "en"
            };
            _validatorsMock.Setup(x => x.ValidateAsync(request, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new FluentValidation.Results.ValidationResult(new[]
                {
                    new FluentValidation.Results.ValidationFailure("KeyIds", "required")
                }));

            var result = await _controller.TranslateKeys(request);

            result.Should().BeOfType<BadRequestObjectResult>();
            _keyManagementServiceMock.Verify(x => x.SendTranslateBlocksLanguageKeysEvent(It.IsAny<TranslateBlocksLanguageKeysRequest>()), Times.Never);
        }

        [Fact]
        public async Task DeleteKeys_WithValidItemIds_ReturnsOk()
        {
            var request = new DeleteKeysRequest { ItemIds = new List<string> { "k1", "k2" } };
            _keyManagementServiceMock.Setup(x => x.DeleteKeysAsync(request))
                .ReturnsAsync(new BaseMutationResponse { IsSuccess = true });

            var result = await _controller.DeleteKeys(request);

            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task DeleteKeys_WithEmptyItemIds_ReturnsBadRequest()
        {
            var request = new DeleteKeysRequest { ItemIds = new List<string>() };
            var result = await _controller.DeleteKeys(request);
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task DeleteKeys_WhenServiceFails_ReturnsBadRequest()
        {
            var request = new DeleteKeysRequest { ItemIds = new List<string> { "k1" } };
            _keyManagementServiceMock.Setup(x => x.DeleteKeysAsync(request))
                .ReturnsAsync(new BaseMutationResponse { IsSuccess = false });

            var result = await _controller.DeleteKeys(request);

            result.Should().BeOfType<BadRequestObjectResult>();
        }
    }
}
