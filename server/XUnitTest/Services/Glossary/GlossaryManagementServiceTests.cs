using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared;
using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using BlocksGlossary = Eurolm.DomainService.Repositories.BlocksGlossary;
using GlossaryModel = Eurolm.DomainService.Services.Glossary;

namespace XUnitTest
{
    public class GlossaryManagementServiceTests
    {
        private readonly Mock<ILogger<GlossaryManagementService>> _loggerMock;
        private readonly Mock<IGlossaryRepository> _glossaryRepositoryMock;
        private readonly Mock<IKeyRepository> _keyRepositoryMock;
        private readonly Mock<IValidator<GlossaryModel>> _validatorMock;
        private readonly GlossaryManagementService _service;

        private const string VersionMessage = "This glossary was changed by someone else. Reload and try again.";

        public GlossaryManagementServiceTests()
        {
            XUnitTest.Shared.TestBlocksContext.Set();
            _loggerMock = new Mock<ILogger<GlossaryManagementService>>();
            _glossaryRepositoryMock = new Mock<IGlossaryRepository>();
            _keyRepositoryMock = new Mock<IKeyRepository>();
            _validatorMock = new Mock<IValidator<GlossaryModel>>();
            _validatorMock.Setup(v => v.ValidateAsync(It.IsAny<GlossaryModel>(), default))
                .ReturnsAsync(new FluentValidation.Results.ValidationResult());
            _glossaryRepositoryMock.Setup(r => r.ReplaceAsync(It.IsAny<BlocksGlossary>(), It.IsAny<int?>()))
                .ReturnsAsync(true);

            _service = new GlossaryManagementService(
                _validatorMock.Object,
                _loggerMock.Object,
                _glossaryRepositoryMock.Object,
                _keyRepositoryMock.Object
            );
        }

        private void SetupStored(BlocksGlossary stored) =>
            _glossaryRepositoryMock.Setup(r => r.GetStoredByIdAsync(stored.ItemId)).ReturnsAsync(stored);

        private void VerifyNothingWritten()
        {
            _glossaryRepositoryMock.Verify(r => r.InsertAsync(It.IsAny<BlocksGlossary>()), Times.Never);
            _glossaryRepositoryMock.Verify(r => r.ReplaceAsync(It.IsAny<BlocksGlossary>(), It.IsAny<int?>()), Times.Never);
        }

        private static void ShouldBeValidationError(ApiResponse result, string property, string message)
        {
            result.Success.Should().BeFalse();
            result.ValidationErrors.Should().ContainSingle(e => e.PropertyName == property && e.ErrorMessage == message);
        }

        [Fact]
        public async Task SaveGlossaryAsync_ReusedSingleton_UsesEachRequestsTenant()
        {
            var saved = new List<BlocksGlossary>();
            _glossaryRepositoryMock.Setup(r => r.InsertAsync(It.IsAny<BlocksGlossary>()))
                .Callback<BlocksGlossary>(saved.Add).Returns(Task.CompletedTask);

            XUnitTest.Shared.TestBlocksContext.Set("dev");
            await _service.SaveGlossaryAsync(new GlossaryModel { Name = "First" });
            XUnitTest.Shared.TestBlocksContext.Set("other");
            await _service.SaveGlossaryAsync(new GlossaryModel { Name = "Second" });

            saved.Select(x => x.TenantId).Should().Equal("dev", "other");
        }

        #region SaveGlossaryAsync Tests

        [Fact]
        public async Task SaveGlossaryAsync_Create_InsertsVersionOneOwnedByCurrentUser()
        {
            BlocksGlossary? inserted = null;
            _glossaryRepositoryMock.Setup(r => r.InsertAsync(It.IsAny<BlocksGlossary>()))
                .Callback<BlocksGlossary>(g => inserted = g).Returns(Task.CompletedTask);

            var result = await _service.SaveGlossaryAsync(new GlossaryModel
            {
                Name = "  Cafe\u0301 ",
                Language = "en-US",
                Type = "Acronym",
                Context = "ctx",
                AdditionalNote = "{}",
                IsGlobal = false,
                ModuleIds = new List<string> { "m1" },
                Version = 9
            });

            result.Success.Should().BeTrue();
            inserted.Should().NotBeNull();
            Guid.TryParse(inserted!.ItemId, out _).Should().BeTrue();
            inserted.Version.Should().Be(1);
            inserted.CreatedBy.Should().Be("test-user");
            inserted.LastUpdatedBy.Should().Be("test-user");
            inserted.CreateDate.Should().Be(inserted.LastUpdateDate);
            inserted.Name.Should().Be("Caf\u00e9");
            inserted.Context.Should().Be("ctx");
            inserted.AdditionalNote.Should().Be("{}");
            inserted.ModuleIds.Should().Equal("m1");
            _glossaryRepositoryMock.Verify(r => r.ReplaceAsync(It.IsAny<BlocksGlossary>(), It.IsAny<int?>()), Times.Never);
        }

        [Fact]
        public async Task SaveGlossaryAsync_InvalidGlossary_ReturnsValidationError()
        {
            var glossary = new GlossaryModel { Name = "" };
            var validationResult = new FluentValidation.Results.ValidationResult();
            validationResult.Errors.Add(new FluentValidation.Results.ValidationFailure("Name", "Name is required."));
            _validatorMock.Setup(v => v.ValidateAsync(glossary, default)).ReturnsAsync(validationResult);

            var result = await _service.SaveGlossaryAsync(glossary);

            result.Success.Should().BeFalse();
            VerifyNothingWritten();
        }

        [Theory]
        [InlineData(null)]
        [InlineData(3)]
        public async Task SaveGlossaryAsync_Update_KeepsCreatorAndIncrementsVersion(int? clientVersion)
        {
            var created = DateTime.UtcNow.AddDays(-3);
            SetupStored(new BlocksGlossary { ItemId = "g1", Name = "API", CreatedBy = "user-a", CreateDate = created, Version = 3 });
            BlocksGlossary? replaced = null;
            int? expected = -1;
            _glossaryRepositoryMock.Setup(r => r.ReplaceAsync(It.IsAny<BlocksGlossary>(), It.IsAny<int?>()))
                .Callback<BlocksGlossary, int?>((g, v) => { replaced = g; expected = v; })
                .ReturnsAsync(true);

            var result = await _service.SaveGlossaryAsync(new GlossaryModel { ItemId = "g1", Name = "API Updated", Version = clientVersion });

            result.Success.Should().BeTrue();
            replaced!.ItemId.Should().Be("g1");
            replaced.Name.Should().Be("API Updated");
            replaced.CreatedBy.Should().Be("user-a");
            replaced.CreateDate.Should().Be(created);
            replaced.LastUpdatedBy.Should().Be("test-user");
            replaced.LastUpdateDate.Should().BeAfter(created);
            replaced.Version.Should().Be(4);
            expected.Should().Be(clientVersion);
            _glossaryRepositoryMock.Verify(r => r.InsertAsync(It.IsAny<BlocksGlossary>()), Times.Never);
        }

        [Fact]
        public async Task SaveGlossaryAsync_UnknownItemId_ReturnsItemIdErrorAndWritesNothing()
        {
            _glossaryRepositoryMock.Setup(r => r.GetStoredByIdAsync("does-not-exist")).ReturnsAsync((BlocksGlossary?)null);

            var result = await _service.SaveGlossaryAsync(new GlossaryModel { ItemId = "does-not-exist", Name = "X" });

            ShouldBeValidationError(result, "ItemId", "Glossary item not found");
            VerifyNothingWritten();
        }

        [Fact]
        public async Task SaveGlossaryAsync_StaleVersion_ReturnsVersionErrorAndWritesNothing()
        {
            SetupStored(new BlocksGlossary { ItemId = "g1", Name = "API", Version = 5 });

            var result = await _service.SaveGlossaryAsync(new GlossaryModel { ItemId = "g1", Name = "API", Version = 4 });

            ShouldBeValidationError(result, "Version", VersionMessage);
            VerifyNothingWritten();
        }

        [Fact]
        public async Task SaveGlossaryAsync_LostVersionedRace_ReturnsVersionError()
        {
            SetupStored(new BlocksGlossary { ItemId = "g1", Name = "API", Version = 4 });
            _glossaryRepositoryMock.Setup(r => r.ReplaceAsync(It.IsAny<BlocksGlossary>(), 4)).ReturnsAsync(false);

            var result = await _service.SaveGlossaryAsync(new GlossaryModel { ItemId = "g1", Name = "API", Version = 4 });

            ShouldBeValidationError(result, "Version", VersionMessage);
        }

        [Fact]
        public async Task SaveGlossaryAsync_UnversionedReplaceMatchesNothing_ReturnsItemIdError()
        {
            SetupStored(new BlocksGlossary { ItemId = "g1", Name = "API", Version = 4 });
            _glossaryRepositoryMock.Setup(r => r.ReplaceAsync(It.IsAny<BlocksGlossary>(), null)).ReturnsAsync(false);

            var result = await _service.SaveGlossaryAsync(new GlossaryModel { ItemId = "g1", Name = "API" });

            ShouldBeValidationError(result, "ItemId", "Glossary item not found");
        }

        [Fact]
        public async Task SaveGlossaryAsync_LegacyDocumentWithVersionZero_SavesVersionOne()
        {
            SetupStored(new BlocksGlossary { ItemId = "g1", Name = "API" });

            var result = await _service.SaveGlossaryAsync(new GlossaryModel { ItemId = "g1", Name = "API", Version = 0 });

            result.Success.Should().BeTrue();
            _glossaryRepositoryMock.Verify(r => r.ReplaceAsync(It.Is<BlocksGlossary>(g => g.Version == 1), 0), Times.Once);
        }

        [Fact]
        public async Task SaveGlossaryAsync_RepositoryThrows_ReturnsError()
        {
            _glossaryRepositoryMock.Setup(r => r.InsertAsync(It.IsAny<BlocksGlossary>()))
                .ThrowsAsync(new Exception("Database error"));

            var result = await _service.SaveGlossaryAsync(new GlossaryModel { Name = "API" });

            result.Success.Should().BeFalse();
            result.ErrorMessage.Should().Be("Database error");
        }

        #endregion

        #region DeleteGlossaryAsync Tests

        [Fact]
        public async Task DeleteGlossaryAsync_ExistingItem_PullsFromKeysThenDeletes()
        {
            var request = new DeleteGlossaryRequest { ItemId = "glossary-1" };
            var calls = new List<string>();
            _glossaryRepositoryMock.Setup(r => r.GetByIdAsync("glossary-1"))
                .ReturnsAsync(new GlossaryModel { ItemId = "glossary-1", Name = "API" });
            _keyRepositoryMock.Setup(r => r.RemoveGlossaryIdFromKeysAsync("glossary-1"))
                .Callback(() => calls.Add("pull")).ReturnsAsync(500);
            _glossaryRepositoryMock.Setup(r => r.DeleteAsync("glossary-1"))
                .Callback(() => calls.Add("delete")).Returns(Task.CompletedTask);

            var result = await _service.DeleteGlossaryAsync(request);

            result.IsSuccess.Should().BeTrue();
            calls.Should().Equal("pull", "delete");
        }

        [Fact]
        public async Task DeleteGlossaryAsync_PullFails_DoesNotDelete()
        {
            var request = new DeleteGlossaryRequest { ItemId = "glossary-1" };
            _glossaryRepositoryMock.Setup(r => r.GetByIdAsync("glossary-1"))
                .ReturnsAsync(new GlossaryModel { ItemId = "glossary-1", Name = "API" });
            _keyRepositoryMock.Setup(r => r.RemoveGlossaryIdFromKeysAsync("glossary-1"))
                .ThrowsAsync(new Exception("db down"));

            var result = await _service.DeleteGlossaryAsync(request);

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().Contain("Error", "Could not remove the glossary from keys. Nothing was deleted.");
            _glossaryRepositoryMock.Verify(r => r.DeleteAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task DeleteGlossaryAsync_NonExistingItem_ReturnsNotFoundAndChangesNoKeys()
        {
            var request = new DeleteGlossaryRequest { ItemId = "non-existing" };
            _glossaryRepositoryMock.Setup(r => r.GetByIdAsync("non-existing"))
                .ReturnsAsync((GlossaryModel)null);

            var result = await _service.DeleteGlossaryAsync(request);

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("itemId");
            _keyRepositoryMock.Verify(r => r.RemoveGlossaryIdFromKeysAsync(It.IsAny<string>()), Times.Never);
            _glossaryRepositoryMock.Verify(r => r.DeleteAsync(It.IsAny<string>()), Times.Never);
        }

        #endregion

        #region GetGlossariesAsync Tests

        [Fact]
        public async Task GetGlossariesAsync_ReturnsResults()
        {
            // Arrange
            var request = new GetGlossariesRequest { PageNumber = 0, PageSize = 20 };
            var expectedResponse = new GetGlossariesResponse
            {
                Items = new List<GlossaryModel>
                {
                    new GlossaryModel { Name = "API", Type = "Acronym" },
                    new GlossaryModel { Name = "URL", Type = "Abbreviation" }
                },
                TotalCount = 2
            };

            _glossaryRepositoryMock.Setup(r => r.GetAllAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _service.GetGlossariesAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.Items.Should().HaveCount(2);
            result.TotalCount.Should().Be(2);
        }

        [Fact]
        public async Task GetGlossariesAsync_EmptyResult_ReturnsEmptyList()
        {
            // Arrange
            var request = new GetGlossariesRequest {  };
            var expectedResponse = new GetGlossariesResponse
            {
                Items = new List<GlossaryModel>(),
                TotalCount = 0
            };

            _glossaryRepositoryMock.Setup(r => r.GetAllAsync(request))
                .ReturnsAsync(expectedResponse);

            // Act
            var result = await _service.GetGlossariesAsync(request);

            // Assert
            result.Items.Should().BeEmpty();
            result.TotalCount.Should().Be(0);
        }

        #endregion
    }
}
