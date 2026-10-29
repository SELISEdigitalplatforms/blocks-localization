using Api.Controllers;
using Blocks.Genesis;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace XUnitTest
{
    public class GlossaryControllerTests
    {
        private readonly Mock<IGlossaryManagementService> _glossaryManagementServiceMock;
        private readonly Mock<IKeyManagementService> _keyManagementServiceMock;
        private readonly Mock<IGlossaryMigrationService> _migrationServiceMock = new();
        private readonly Mock<IGlossaryTerminologyService> _terminologyServiceMock = new();
        private readonly GlossaryController _controller;

        public GlossaryControllerTests()
        {
            _glossaryManagementServiceMock = new Mock<IGlossaryManagementService>();
            _keyManagementServiceMock = new Mock<IKeyManagementService>();

            _controller = new GlossaryController(
                _glossaryManagementServiceMock.Object,
                _keyManagementServiceMock.Object,
                _migrationServiceMock.Object,
                _terminologyServiceMock.Object
            )
            {
                ControllerContext = new ControllerContext()
            };
        }

        [Fact]
        public async Task Get_WithEmptyItemId_ReturnsBadRequest()
        {
            var result = await _controller.Get("");
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task Get_WithValidItemId_Found_ReturnsOk()
        {
            var glossary = new Glossary { ItemId = "g1", Name = "API" };
            _glossaryManagementServiceMock.Setup(x => x.GetGlossaryByIdAsync("g1")).ReturnsAsync(glossary);

            var result = await _controller.Get("g1");

            result.Should().BeOfType<OkObjectResult>();
            ((OkObjectResult)result).Value.Should().BeSameAs(glossary);
        }

        [Fact]
        public async Task Get_WithValidItemId_NotFound_ReturnsNotFound()
        {
            _glossaryManagementServiceMock.Setup(x => x.GetGlossaryByIdAsync("missing")).ReturnsAsync((Glossary)null);

            var result = await _controller.Get("missing");

            result.Should().BeOfType<NotFoundObjectResult>();
        }

        [Fact]
        public async Task GetSuggestedGlossaries_DelegatesToKeyManagementService()
        {
            var request = new GetSuggestedGlossariesRequest { ItemId = "m1" };
            var response = new GetSuggestedGlossariesResponse();
            _keyManagementServiceMock.Setup(x => x.GetSuggestedGlossariesAsync(request)).ReturnsAsync(response);

            var result = await _controller.GetSuggestedGlossaries(request);

            result.Should().BeSameAs(response);
        }

        [Fact]
        public async Task GetSuggestedGlossaries_WithNullRequest_ReturnsEmptyWithoutCallingService()
        {
            var result = await _controller.GetSuggestedGlossaries(null);

            result.Should().NotBeNull();
            result.SuggestedGlossaries.Should().BeEmpty();
            _keyManagementServiceMock.Verify(x => x.GetSuggestedGlossariesAsync(It.IsAny<GetSuggestedGlossariesRequest>()), Times.Never);
        }

        #region Save Tests

        [Fact]
        public async Task Save_WithValidGlossary_ReturnsSuccess()
        {
            // Arrange
            var glossary = new Glossary
            {
                Name = "API",
                Language = "en-US",
                Type = "Acronym"
            };

            var expectedResponse = new ApiResponse { Success = true };

            _glossaryManagementServiceMock
                .Setup(x => x.SaveGlossaryAsync(glossary))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Save(glossary);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task Save_WithNullGlossary_ReturnsFailureWithoutCallingService()
        {
            var result = await _controller.Save(null);

            result.Should().NotBeNull();
            result.Success.Should().BeFalse();
            result.ErrorMessage.Should().Be("Glossary cannot be null.");
            _glossaryManagementServiceMock.Verify(x => x.SaveGlossaryAsync(It.IsAny<Glossary>()), Times.Never);
        }

        [Fact]
        public async Task Save_WithOnlyRequiredFields_ReturnsSuccess()
        {
            // Arrange
            var glossary = new Glossary
            {
                Name = "Term"
            };

            var expectedResponse = new ApiResponse { Success = true };

            _glossaryManagementServiceMock
                .Setup(x => x.SaveGlossaryAsync(glossary))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Save(glossary);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            _glossaryManagementServiceMock.Verify(x => x.SaveGlossaryAsync(glossary), Times.Once);
        }

        #endregion

        #region Gets Tests

        [Fact]
        public async Task Gets_WithValidRequest_ReturnsGlossaryList()
        {
            // Arrange
            var request = new GetGlossariesRequest {  PageNumber = 0, PageSize = 20 };
            var expectedResponse = new GetGlossariesResponse
            {
                Items = new List<Glossary>
                {
                    new Glossary { Name = "API", Type = "Acronym" },
                    new Glossary { Name = "URL", Type = "Abbreviation" }
                },
                TotalCount = 2
            };

            _glossaryManagementServiceMock
                .Setup(x => x.GetGlossariesAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Gets(request);

            // Assert
            result.Should().NotBeNull();
            result.Items.Should().HaveCount(2);
            result.TotalCount.Should().Be(2);
        }

        [Fact]
        public async Task Gets_WithEmptyResult_ReturnsEmptyList()
        {
            // Arrange
            var request = new GetGlossariesRequest {  };
            var expectedResponse = new GetGlossariesResponse
            {
                Items = new List<Glossary>(),
                TotalCount = 0
            };

            _glossaryManagementServiceMock
                .Setup(x => x.GetGlossariesAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Gets(request);

            // Assert
            result.Items.Should().BeEmpty();
            result.TotalCount.Should().Be(0);
        }

        [Fact]
        public async Task Gets_WithNullRequest_ReturnsEmptyWithoutCallingService()
        {
            var result = await _controller.Gets(null);

            result.Should().NotBeNull();
            result.Items.Should().BeEmpty();
            result.TotalCount.Should().Be(0);
            _glossaryManagementServiceMock.Verify(x => x.GetGlossariesAsync(It.IsAny<GetGlossariesRequest>()), Times.Never);
        }

        [Fact]
        public async Task Gets_WithSearchText_CallsServiceWithRequest()
        {
            // Arrange
            var request = new GetGlossariesRequest
            {
                SearchText = "API",
                PageNumber = 0,
                PageSize = 10
            };

            var expectedResponse = new GetGlossariesResponse
            {
                Items = new List<Glossary> { new Glossary { Name = "API" } },
                TotalCount = 1
            };

            _glossaryManagementServiceMock
                .Setup(x => x.GetGlossariesAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Gets(request);

            // Assert
            result.Items.Should().HaveCount(1);
            _glossaryManagementServiceMock.Verify(x => x.GetGlossariesAsync(request), Times.Once);
        }

        #endregion

        #region Delete Tests

        [Fact]
        public async Task Delete_WithValidItemId_ReturnsOk()
        {
            // Arrange
            var request = new DeleteGlossaryRequest { ItemId = "glossary-1" };
            var expectedResponse = new BaseMutationResponse { IsSuccess = true };

            _glossaryManagementServiceMock
                .Setup(x => x.DeleteGlossaryAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _controller.Delete(request);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task Delete_WithEmptyItemId_ReturnsBadRequest()
        {
            // Arrange
            var request = new DeleteGlossaryRequest { ItemId = "" };

            // Act
            var result = await _controller.Delete(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task Delete_WithNonExistingItem_ReturnsBadRequest()
        {
            // Arrange
            var request = new DeleteGlossaryRequest { ItemId = "non-existing" };
            var failureResponse = new BaseMutationResponse
            {
                IsSuccess = false,
                Errors = new Dictionary<string, string> { { "itemId", "Glossary item not found" } }
            };

            _glossaryManagementServiceMock
                .Setup(x => x.DeleteGlossaryAsync(request))
                .ReturnsAsync(failureResponse);

            // Act
            var result = await _controller.Delete(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        #endregion

        [Fact]
        public async Task Save_VersionConflict_ReturnsServiceValidationErrorsUnchanged()
        {
            var glossary = new Glossary { ItemId = "g1", Name = "API", Version = 4 };
            var response = new ApiResponse(string.Empty, new List<FluentValidation.Results.ValidationFailure>
            {
                new("Version", "This glossary was changed by someone else. Reload and try again.")
            });
            _glossaryManagementServiceMock.Setup(x => x.SaveGlossaryAsync(glossary)).ReturnsAsync(response);

            var result = await _controller.Save(glossary);

            result.Should().BeSameAs(response);
            result.Success.Should().BeFalse();
            result.ValidationErrors.Should().ContainSingle(e => e.PropertyName == "Version");
        }

        [Fact]
        public async Task Save_UnknownItemId_ReturnsItemIdValidationError()
        {
            var glossary = new Glossary { ItemId = "nope", Name = "X" };
            var response = new ApiResponse(string.Empty, new List<FluentValidation.Results.ValidationFailure>
            {
                new("ItemId", "Glossary item not found")
            });
            _glossaryManagementServiceMock.Setup(x => x.SaveGlossaryAsync(glossary)).ReturnsAsync(response);

            var result = await _controller.Save(glossary);

            result.ValidationErrors.Should().ContainSingle(e => e.PropertyName == "ItemId" && e.ErrorMessage == "Glossary item not found");
        }

        [Fact]
        public async Task Save_WithCurrentVersion_ReturnsSuccess()
        {
            var glossary = new Glossary { ItemId = "g1", Name = "API", Version = 4 };
            _glossaryManagementServiceMock.Setup(x => x.SaveGlossaryAsync(glossary)).ReturnsAsync(new ApiResponse());

            var result = await _controller.Save(glossary);

            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task Get_ReturnsVersion()
        {
            _glossaryManagementServiceMock.Setup(x => x.GetGlossaryByIdAsync("g1"))
                .ReturnsAsync(new Glossary { ItemId = "g1", Name = "API", Version = 4 });

            var result = await _controller.Get("g1");

            ((Glossary)((OkObjectResult)result).Value!).Version.Should().Be(4);
        }

        [Fact]
        public async Task Gets_ReturnsVersionOfEachItem()
        {
            var request = new GetGlossariesRequest { PageNumber = 0, PageSize = 10 };
            _glossaryManagementServiceMock.Setup(x => x.GetGlossariesAsync(request)).ReturnsAsync(new GetGlossariesResponse
            {
                Items = new List<Glossary> { new Glossary { ItemId = "g1", Name = "A", Version = 0 }, new Glossary { ItemId = "g2", Name = "B", Version = 2 } },
                TotalCount = 2
            });

            var result = await _controller.Gets(request);

            result.Items.Select(g => g.Version).Should().Equal(0, 2);
        }

        [Fact]
        public void Glossary_SerializesVersionAsCamelCase()
        {
            var json = System.Text.Json.JsonSerializer.Serialize(
                new Glossary { ItemId = "g1", Name = "API", Version = 3 },
                new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));

            json.Should().Contain("\"version\":3");
        }

        #region Phase 6 endpoints

        [Fact]
        public async Task GetByIds_ReturnsItemsFromTheService()
        {
            var items = new List<Glossary> { new Glossary { ItemId = "b", Name = "B" }, new Glossary { ItemId = "a", Name = "A" } };
            _glossaryManagementServiceMock.Setup(x => x.GetGlossariesByIdsAsync(It.Is<IReadOnlyList<string>>(ids => ids.SequenceEqual(new[] { "b", "a", "missing" }))))
                .ReturnsAsync(items);

            var result = await _controller.GetByIds(new List<string> { "b", "a", "missing" });

            var body = ((OkObjectResult)result).Value.Should().BeOfType<GetGlossariesByIdsResponse>().Subject;
            body.Items.Select(g => g.ItemId).Should().Equal("b", "a");
        }

        [Fact]
        public async Task GetByIds_WithNoIds_ReturnsBadRequest()
        {
            (await _controller.GetByIds(new List<string>())).Should().BeOfType<BadRequestObjectResult>();
            (await _controller.GetByIds(null)).Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task GetByIds_WithMoreThan100Ids_ReturnsBadRequest()
        {
            var ids = Enumerable.Range(0, 101).Select(i => $"g{i}").ToList();

            (await _controller.GetByIds(ids)).Should().BeOfType<BadRequestObjectResult>();
            _glossaryManagementServiceMock.Verify(x => x.GetGlossariesByIdsAsync(It.IsAny<IReadOnlyList<string>>()), Times.Never);
        }

        [Fact]
        public async Task GetByIds_With100Ids_IsAccepted()
        {
            _glossaryManagementServiceMock.Setup(x => x.GetGlossariesByIdsAsync(It.IsAny<IReadOnlyList<string>>())).ReturnsAsync(new List<Glossary>());

            (await _controller.GetByIds(Enumerable.Range(0, 100).Select(i => $"g{i}").ToList())).Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task Usage_UnknownGlossary_ReturnsNotFound()
        {
            _glossaryManagementServiceMock.Setup(x => x.GetGlossaryUsageAsync(It.IsAny<GlossaryUsageRequest>())).ReturnsAsync((GlossaryUsageResponse?)null);

            (await _controller.Usage(new GlossaryUsageRequest { ItemId = "x" })).Should().BeOfType<NotFoundObjectResult>();
        }

        [Fact]
        public async Task Usage_ReturnsTheUsage()
        {
            var usage = new GlossaryUsageResponse { KeyCount = 3, ModuleIds = new List<string> { "m1" }, ViolationKeyCount = 1 };
            _glossaryManagementServiceMock.Setup(x => x.GetGlossaryUsageAsync(It.IsAny<GlossaryUsageRequest>())).ReturnsAsync(usage);

            var result = await _controller.Usage(new GlossaryUsageRequest { ItemId = "g1", PageSize = 50 });

            ((OkObjectResult)result).Value.Should().BeSameAs(usage);
        }

        [Theory]
        [InlineData("", 0, 10)]
        [InlineData("g1", 0, 0)]
        [InlineData("g1", 0, 51)]
        [InlineData("g1", -1, 10)]
        public async Task Usage_InvalidRequest_ReturnsBadRequest(string itemId, int pageNumber, int pageSize)
        {
            var result = await _controller.Usage(new GlossaryUsageRequest { ItemId = itemId, PageNumber = pageNumber, PageSize = pageSize });

            result.Should().BeOfType<BadRequestObjectResult>();
            _glossaryManagementServiceMock.Verify(x => x.GetGlossaryUsageAsync(It.IsAny<GlossaryUsageRequest>()), Times.Never);
        }

        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public async Task Migrate_PassesDryRunAndReturnsTheReport(bool dryRun)
        {
            var report = new MigrateGlossariesResponse { DryRun = dryRun, Total = 2 };
            _migrationServiceMock.Setup(x => x.MigrateAsync(dryRun)).ReturnsAsync(report);

            var result = await _controller.Migrate(dryRun);

            ((OkObjectResult)result).Value.Should().BeSameAs(report);
        }

        [Fact]
        public void Migrate_IsProtectedByTheMigratePermission()
        {
            typeof(GlossaryController).GetMethod(nameof(GlossaryController.Migrate))!
                .GetCustomAttributesData().Single(a => a.AttributeType.Name.StartsWith("ProtectedEndPoint", StringComparison.Ordinal))
                .ConstructorArguments.Single().Value.Should().Be("blocks-localization::glossary::migrate");
        }

        [Fact]
        public void Glossary_SerializesStructuredFieldsAsCamelCase()
        {
            var json = System.Text.Json.JsonSerializer.Serialize(
                new Glossary
                {
                    ItemId = "g1", Name = "API", Rule = "keep", Status = "draft", SchemaVersion = 2, CaseSensitive = true,
                    Variants = new List<string> { "apis" },
                    Translations = new List<GlossaryTranslationDto> { new() { Language = "de-DE", Value = "Schnittstelle", ForbiddenValues = new() { "API" } } }
                },
                new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));

            json.Should().Contain("\"rule\":\"keep\"").And.Contain("\"status\":\"draft\"").And.Contain("\"schemaVersion\":2")
                .And.Contain("\"caseSensitive\":true").And.Contain("\"variants\":[\"apis\"]")
                .And.Contain("\"forbiddenValues\":[\"API\"]");
        }

        [Fact]
        public void PermissionSeed_ContainsTheMigrateEndpoint()
        {
            var path = Path.Combine(FindServerDirectory(), "seed", "localization-permissions.upsert.json");
            using var document = System.Text.Json.JsonDocument.Parse(File.ReadAllText(path));

            var entry = document.RootElement.EnumerateArray()
                .Single(e => e.GetProperty("Resource").GetString() == "blocks-localization::glossary::migrate");
            entry.GetProperty("Type").GetString().Should().Be("Endpoint");
            entry.GetProperty("PermissionSeverity").GetString().Should().Be("High");
            entry.GetProperty("ResourceGroup").GetString().Should().Be("localization");
        }

        #region Recheck (SPEC8 H28, C12, C13, C15)

        private GlossaryController ControllerWithRecheck(Mock<IGlossaryRecheckService> recheck) =>
            new(_glossaryManagementServiceMock.Object, _keyManagementServiceMock.Object, _migrationServiceMock.Object,
                _terminologyServiceMock.Object, recheck.Object)
            { ControllerContext = new ControllerContext() };

        [Theory]
        [InlineData("g1", true)]
        [InlineData(null, true)]
        [InlineData("g1", false)]
        public async Task Recheck_returns_ok_with_queued(string? itemId, bool queued)
        {
            var recheck = new Mock<IGlossaryRecheckService>();
            recheck.Setup(r => r.QueueAsync(itemId)).ReturnsAsync(queued);

            var result = await ControllerWithRecheck(recheck).Recheck(itemId);

            ((OkObjectResult)result).Value.Should().BeEquivalentTo(new RecheckGlossaryResponse { Queued = queued });
            recheck.Verify(r => r.QueueAsync(itemId), Times.Once);
        }

        [Fact]
        public async Task Recheck_without_a_registered_service_is_not_queued()
        {
            var result = await _controller.Recheck("g1");

            ((OkObjectResult)result).Value.Should().BeEquivalentTo(new RecheckGlossaryResponse { Queued = false });
        }

        [Fact]
        public void Recheck_is_a_post_protected_by_the_recheck_permission()
        {
            var method = typeof(GlossaryController).GetMethod(nameof(GlossaryController.Recheck))!;
            method.GetCustomAttributesData().Single(a => a.AttributeType.Name.StartsWith("ProtectedEndPoint", StringComparison.Ordinal))
                .ConstructorArguments.Single().Value.Should().Be("blocks-localization::glossary::recheck");
            method.GetCustomAttributes(typeof(HttpPostAttribute), false).Should().ContainSingle();
        }

        [Fact]
        public void RecheckGlossaryResponse_serializes_as_queued()
        {
            System.Text.Json.JsonSerializer.Serialize(new RecheckGlossaryResponse { Queued = true },
                    new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web))
                .Should().Be("{\"queued\":true}");
        }

        [Fact]
        public void PermissionSeed_ContainsTheRecheckEndpoint()
        {
            var path = Path.Combine(FindServerDirectory(), "seed", "localization-permissions.upsert.json");
            using var document = System.Text.Json.JsonDocument.Parse(File.ReadAllText(path));

            var entries = document.RootElement.EnumerateArray().ToList();
            var entry = entries.Single(e => e.GetProperty("Resource").GetString() == "blocks-localization::glossary::recheck");
            entry.GetProperty("Type").GetString().Should().Be("Endpoint");
            entry.GetProperty("PermissionSeverity").GetString().Should().Be("Low");
            entry.GetProperty("ResourceGroup").GetString().Should().Be("localization");
            entry.GetProperty("IsBuiltIn").GetBoolean().Should().BeTrue();
            entry.GetProperty("Description").GetString().Should().Contain("POST /Glossary/Recheck");
            entries.Select(e => e.GetProperty("_id").GetString()).Should().OnlyHaveUniqueItems();
        }

        #endregion

        private static string FindServerDirectory()
        {
            var directory = new DirectoryInfo(AppContext.BaseDirectory);
            while (directory != null && !File.Exists(Path.Combine(directory.FullName, "seed", "localization-permissions.upsert.json")))
                directory = directory.Parent;
            return directory?.FullName ?? throw new DirectoryNotFoundException("server/seed not found");
        }

        #endregion

        #region Match (SPEC6 C5)

        [Theory]
        [InlineData(null, "en-US", "Text")]
        [InlineData("", "en-US", "Text")]
        [InlineData("Open", null, "Language")]
        [InlineData("Open", " ", "Language")]
        public async Task Match_WithInvalidInput_ReturnsBadRequestWithTheFieldError(string? text, string? language, string field)
        {
            var result = await _controller.Match(new MatchGlossaryRequest { Text = text, Language = language });

            var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
            badRequest.Value.Should().BeOfType<BaseMutationResponse>().Which.Errors.Should().ContainKey(field);
            _terminologyServiceMock.Verify(s => s.MatchAsync(It.IsAny<MatchGlossaryRequest>()), Times.Never);
        }

        [Fact]
        public async Task Match_WithTextLongerThan5000Characters_ReturnsBadRequest()
        {
            var result = await _controller.Match(new MatchGlossaryRequest { Text = new string('a', 5001), Language = "en-US" });

            result.Should().BeOfType<BadRequestObjectResult>()
                .Which.Value.Should().BeOfType<BaseMutationResponse>().Which.Errors.Should().ContainKey("Text");
        }

        [Fact]
        public async Task Match_WithMoreThan100GlossaryIds_ReturnsBadRequest()
        {
            var ids = Enumerable.Range(0, 101).Select(i => $"g{i}").ToList();

            var result = await _controller.Match(new MatchGlossaryRequest { Text = "Open", Language = "en-US", GlossaryIds = ids });

            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task Match_WithAValidRequest_ReturnsTheServiceMatches()
        {
            var request = new MatchGlossaryRequest { Text = new string('a', 5000), Language = "en-US", KeyId = "k1" };
            var response = new MatchGlossaryResponse
            {
                Matches = { new GlossaryMatchDto { GlossaryId = "g1", Start = 0, Length = 4, Term = "aaaa", Scope = "key" } }
            };
            _terminologyServiceMock.Setup(s => s.MatchAsync(request)).ReturnsAsync(response);

            var result = await _controller.Match(request);

            result.Should().BeOfType<OkObjectResult>().Which.Value.Should().BeSameAs(response);
        }

        #endregion
    }
}
