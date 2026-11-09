using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using ModuleModel = Eurolm.DomainService.Services.Module;

namespace XUnitTest.Services.Module
{
    /// <summary>SPEC16 H1, H1b, H5, C1, C2, C10: the module description on Save.</summary>
    public class ModuleManagementServiceSpec16Tests
    {
        private readonly Mock<IModuleRepository> _repository = new();
        private readonly Mock<IValidator<ModuleModel>> _validator = new();
        private readonly List<BlocksLanguageModule> _saved = new();
        private readonly ModuleManagementService _service;

        public ModuleManagementServiceSpec16Tests()
        {
            XUnitTest.Shared.TestBlocksContext.Set("spec16-modules");
            _validator.Setup(v => v.ValidateAsync(It.IsAny<ModuleModel>(), default)).ReturnsAsync(new ValidationResult());
            _repository.Setup(r => r.SaveAsync(It.IsAny<BlocksLanguageModule>()))
                .Callback<BlocksLanguageModule>(_saved.Add)
                .Returns(Task.CompletedTask);
            _service = new ModuleManagementService(
                _validator.Object,
                _repository.Object,
                new Mock<ILogger<ModuleManagementService>>().Object,
                new Mock<IGlossaryRepository>().Object,
                new Mock<IKeyRepository>().Object,
                new Mock<IKeyTimelineRepository>().Object);
        }

        private void Stored(string? description) =>
            _repository.Setup(r => r.GetByIdAsync("mod-1"))
                .ReturnsAsync(new BlocksLanguageModule { ItemId = "mod-1", ModuleName = "Billing", Description = description });

        [Fact]
        public async Task H1_a_new_module_stores_the_trimmed_description()
        {
            var result = await _service.SaveModuleAsync(new SaveModuleRequest { ModuleName = "Billing", Description = "  Subscription plans.  " });

            result.Success.Should().BeTrue();
            _saved.Single().Description.Should().Be("Subscription plans.");
        }

        [Fact]
        public async Task H5_a_new_description_replaces_the_stored_one()
        {
            Stored("Old text");

            await _service.SaveModuleAsync(new SaveModuleRequest { ItemId = "mod-1", ModuleName = "Billing", Description = "New text" });

            _saved.Single().Description.Should().Be("New text");
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public async Task H1b_a_blank_description_clears_it(string description)
        {
            Stored("Subscription plans.");

            await _service.SaveModuleAsync(new SaveModuleRequest { ItemId = "mod-1", ModuleName = "Billing", Description = description });

            _saved.Single().Description.Should().BeNull();
        }

        [Fact]
        public async Task C10_a_save_without_a_description_keeps_the_stored_one()
        {
            Stored("Subscription plans.");

            await _service.SaveModuleAsync(new SaveModuleRequest { ItemId = "mod-1", ModuleName = "Billing & Payments" });

            _saved.Single().ModuleName.Should().Be("Billing & Payments");
            _saved.Single().Description.Should().Be("Subscription plans.");
        }

        [Fact]
        public async Task C10_a_new_module_without_a_description_stores_null()
        {
            await _service.SaveModuleAsync(new SaveModuleRequest { ModuleName = "Billing" });

            _saved.Single().Description.Should().BeNull();
        }

        [Fact]
        public async Task C1_an_invalid_description_saves_nothing()
        {
            _validator.Setup(v => v.ValidateAsync(It.IsAny<ModuleModel>(), default))
                .ReturnsAsync(new ValidationResult(new[] { new ValidationFailure("Description", "Description must be 500 characters or fewer.") }));

            var result = await _service.SaveModuleAsync(new SaveModuleRequest { ModuleName = "Billing", Description = new string('a', 501) });

            result.Success.Should().BeFalse();
            result.ValidationErrors.Should().ContainSingle(e => e.PropertyName == "Description");
            _repository.Verify(r => r.SaveAsync(It.IsAny<BlocksLanguageModule>()), Times.Never);
        }

        [Theory]
        [InlineData(500, true)]
        [InlineData(501, false)]
        public async Task C1_the_validator_allows_at_most_500_characters_after_trim(int length, bool valid)
        {
            var validator = new ModuleValidator(_repository.Object);

            var result = await validator.ValidateAsync(new ModuleModel { ModuleName = "Billing", Description = "  " + new string('a', length) + "  " });

            result.IsValid.Should().Be(valid);
            if (!valid) result.Errors.Should().ContainSingle(e => e.PropertyName == "Description" && e.ErrorMessage == "Description must be 500 characters or fewer.");
        }

        [Fact]
        public async Task C1_the_validator_accepts_a_missing_description()
        {
            var result = await new ModuleValidator(_repository.Object).ValidateAsync(new ModuleModel { ModuleName = "Billing" });

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public void C2_a_document_without_a_description_reads_as_null()
        {
            var document = new MongoDB.Bson.BsonDocument { { "_id", "mod-1" }, { "ModuleName", "Billing" }, { "Name", "Billing" } };

            var module = MongoDB.Bson.Serialization.BsonSerializer.Deserialize<BlocksLanguageModule>(document);

            module.ModuleName.Should().Be("Billing");
            module.Description.Should().BeNull();
        }
    }
}
