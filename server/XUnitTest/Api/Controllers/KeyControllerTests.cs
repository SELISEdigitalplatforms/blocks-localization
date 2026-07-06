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
        public async Task Save_WithNullKey_ThrowsException()
        {
            // Act & Assert
            await Assert.ThrowsAsync<NullReferenceException>(() => _controller.Save(null));
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
                .Setup(x => x.DeleteAsysnc(request))
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
                .Setup(x => x.DeleteAsysnc(request))
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
        public async Task TranslateAll_WithNullProjectKey_ReturnsBadRequest()
        {
            // Arrange
            var request = new TranslateAllRequest {  };

            // Act
            var result = await _controller.TranslateAll(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task TranslateAll_WithEmptyProjectKey_ReturnsBadRequest()
        {
            // Arrange
            var request = new TranslateAllRequest { };

            // Act
            var result = await _controller.TranslateAll(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
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
        public async Task UilmImport_WithNullProjectKey_ReturnsBadRequest()
        {
            // Arrange
            var request = new UilmImportRequest {  FileId = "file-123" };

            // Act
            var result = await _controller.UilmImport(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
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
        public async Task UilmExport_WithNullProjectKey_ReturnsBadRequest()
        {
            // Arrange
            var request = new UilmExportRequest {  };

            // Act
            var result = await _controller.UilmExport(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
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
        public async Task GetTimeline_WithNullQuery_ThrowsNullReferenceException()
        {
            await Assert.ThrowsAsync<NullReferenceException>(() => _controller.GetTimeline(null));
        }

        [Fact]
        public async Task Get_WithNullRequest_ThrowsNullReferenceException()
        {
            await Assert.ThrowsAsync<NullReferenceException>(() => _controller.Get(null));
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
        public async Task Delete_WithNullRequest_ThrowsNullReferenceException()
        {
            await Assert.ThrowsAsync<NullReferenceException>(() => _controller.Delete(null));
        }

        [Fact]
        public async Task GetUilmFile_WithNullProjectKey_Returns401()
        {
            var request = new GetUilmFileRequest { };
            var context = new DefaultHttpContext();
            _controller.ControllerContext.HttpContext = context;
            await _controller.GetUilmFile(request);
            context.Response.StatusCode.Should().Be(401);
        }

        [Fact]
        public async Task TranslateAll_WithNullRequest_ThrowsNullReferenceException()
        {
            await Assert.ThrowsAsync<NullReferenceException>(() => _controller.TranslateAll(null));
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
        public async Task UilmImport_WithEmptyProjectKey_ReturnsBadRequest()
        {
            var request = new UilmImportRequest { FileId = "f1" };
            var result = await _controller.UilmImport(request);
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task UilmExport_WithNullRequest_ReturnsBadRequest()
        {
            var result = await _controller.UilmExport(null);
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task UilmExport_WithEmptyProjectKey_ReturnsBadRequest()
        {
            var request = new UilmExportRequest {};
            var result = await _controller.UilmExport(request);
            result.Should().BeOfType<BadRequestObjectResult>();
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

    }
}
