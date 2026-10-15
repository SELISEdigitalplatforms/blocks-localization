using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using BlocksTemplate.Api.Controllers;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared;
using Eurolm.DomainService.Shared.Events;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.Extensions.Logging;
using Moq;
using StorageDriver;
using Xunit;
using XUnitTest.Shared;
using BlocksLanguageKey = Eurolm.DomainService.Repositories.BlocksLanguageKey;
using KeyModel = Eurolm.DomainService.Services.Key;
using KeyTimeline = Eurolm.DomainService.Services.KeyTimeline;
using ModuleModel = Eurolm.DomainService.Services.Module;

namespace XUnitTest.Services.Key
{
    /// <summary>
    /// When the unique index rejects a save, the caller must see the same validation failure the
    /// validators already produce, and nothing that a successful save triggers may happen.
    /// </summary>
    public class DuplicateKeyHandlingTests
    {
        private const string ExpectedKeyMessage = "KeyName and ModuleId combination must not already exist for this key.";

        private readonly Mock<IKeyRepository> _keyRepository = new();
        private readonly Mock<IKeyTimelineRepository> _timeline = new();
        private readonly Mock<IValidator<KeyModel>> _keyValidator = new();
        private readonly Mock<IMessageClient> _messageClient = new();
        private readonly Mock<IServiceProvider> _serviceProvider = new();
        private readonly Mock<ILocalizationUniquenessRepository> _uniqueness = new();
        private readonly KeyManagementService _service;

        public DuplicateKeyHandlingTests()
        {
            TestBlocksContext.Set("tenant-1");
            _keyValidator.Setup(v => v.ValidateAsync(It.IsAny<KeyModel>(), It.IsAny<CancellationToken>())).ReturnsAsync(new ValidationResult());
            _serviceProvider.Setup(p => p.GetService(typeof(ILocalizationUniquenessRepository))).Returns(_uniqueness.Object);

            var storageDriver = new Mock<IStorageDriverService>();
            _service = new KeyManagementService(
                _keyRepository.Object,
                _timeline.Object,
                new Mock<ILanguageFileGenerationHistoryRepository>().Object,
                _keyValidator.Object,
                new Mock<ILogger<KeyManagementService>>().Object,
                new Mock<ILanguageManagementService>().Object,
                new Mock<IModuleManagementService>().Object,
                _messageClient.Object,
                new Mock<IAssistantService>().Object,
                storageDriver.Object,
                new StorageHelper(new Mock<ILogger<StorageHelper>>().Object, storageDriver.Object),
                _serviceProvider.Object,
                new Mock<INotificationService>().Object,
                new Mock<IGlossaryRepository>().Object);
        }

        private static KeyModel NewKey(string name = "race-key", bool publish = true) =>
            new() { KeyName = name, ModuleId = "m1", IsNewKey = true, ItemId = "", ShouldPublish = publish, Resources = Array.Empty<Resource>() };

        private void SaveRejectedFor(string keyName) =>
            _keyRepository.Setup(r => r.SaveKeyAsync(It.Is<BlocksLanguageKey>(k => k.KeyName == keyName)))
                .ThrowsAsync(MongoExceptionFactory.DuplicateKeyWrite());

        private void VerifyNothingFollowedTheSave()
        {
            _timeline.Verify(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()), Times.Never);
            _messageClient.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<GenerateUilmFilesEvent>>()), Times.Never);
            _messageClient.Verify(m => m.SendToMassConsumerAsync(It.IsAny<ConsumerMessage<GenerateUilmFilesEvent>>()), Times.Never);
        }

        [Fact]
        public async Task A_save_rejected_by_the_unique_index_answers_like_the_key_validator()
        {
            SaveRejectedFor("race-key");

            var response = await _service.SaveKeyAsync(NewKey());

            response.Success.Should().BeFalse();
            response.ErrorMessage.Should().BeEmpty();
            var failure = response.ValidationErrors.Should().ContainSingle().Subject;
            failure.PropertyName.Should().Be("IsNewKey");
            failure.ErrorMessage.Should().Be(ExpectedKeyMessage);
            VerifyNothingFollowedTheSave();
        }

        [Fact]
        public async Task A_save_that_loses_mongos_own_upsert_retry_answers_like_the_key_validator()
        {
            _keyRepository.Setup(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>())).ThrowsAsync(MongoExceptionFactory.ImmutableIdWrite());

            var response = await _service.SaveKeyAsync(NewKey());

            var failure = response.ValidationErrors.Should().ContainSingle().Subject;
            failure.PropertyName.Should().Be("IsNewKey");
            response.ErrorMessage.Should().NotContain("immutable");
            VerifyNothingFollowedTheSave();
        }

        [Fact]
        public async Task A_rejected_save_never_shows_mongo_text()
        {
            SaveRejectedFor("race-key");

            var response = await _service.SaveKeyAsync(NewKey());

            var text = $"{response.ErrorMessage} {string.Join(" ", response.ValidationErrors!.Select(e => e.ErrorMessage))}";
            text.Should().NotContain("E11000").And.NotContain("duplicate key").And.NotContain("Mongo");
        }

        [Fact]
        public async Task A_bulk_save_reports_the_rejected_key_and_keeps_saving_the_rest()
        {
            SaveRejectedFor("race-key");

            var response = await _service.SaveKeysAsync(new List<KeyModel> { NewKey("race-key", publish: false), NewKey("other-key", publish: false) });

            response.Success.Should().BeFalse();
            response.ErrorMessage.Should().Contain($"Key 'race-key' in Module 'm1': IsNewKey: {ExpectedKeyMessage}");
            response.ErrorMessage.Should().NotContain("E11000");
            _keyRepository.Verify(r => r.SaveKeyAsync(It.Is<BlocksLanguageKey>(k => k.KeyName == "other-key")), Times.Once);
            // Only the key that was saved gets a timeline entry.
            _timeline.Verify(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()), Times.Once);
        }

        [Fact]
        public async Task Other_save_errors_keep_their_existing_handling()
        {
            _keyRepository.Setup(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>())).ThrowsAsync(new InvalidOperationException("boom"));

            var response = await _service.SaveKeyAsync(NewKey());

            response.ErrorMessage.Should().Be("boom");
            response.ValidationErrors.Should().BeNull();
        }

        [Fact]
        public async Task The_summary_and_enforcement_use_the_current_tenant()
        {
            var summary = new GetDuplicateSummaryResponse { KeyGroupCount = 2 };
            var enforced = new EnforceUniquenessResponse { KeyUniquenessEnforced = true };
            _uniqueness.Setup(u => u.GetDuplicateSummaryAsync("tenant-1")).ReturnsAsync(summary);
            _uniqueness.Setup(u => u.EnsureUniqueIndexesAsync("tenant-1")).ReturnsAsync(enforced);

            (await _service.GetDuplicateSummaryAsync()).Should().BeSameAs(summary);
            (await _service.EnforceUniquenessAsync()).Should().BeSameAs(enforced);
        }

        // ---- Module save ----

        [Fact]
        public async Task A_module_save_rejected_by_the_unique_index_answers_like_the_module_validator()
        {
            var validator = new Mock<IValidator<ModuleModel>>();
            validator.Setup(v => v.ValidateAsync(It.IsAny<ModuleModel>(), It.IsAny<CancellationToken>())).ReturnsAsync(new ValidationResult());
            var repository = new Mock<IModuleRepository>();
            repository.Setup(r => r.SaveAsync(It.IsAny<BlocksLanguageModule>())).ThrowsAsync(MongoExceptionFactory.DuplicateKeyWrite());
            var service = new ModuleManagementService(validator.Object, repository.Object,
                new Mock<ILogger<ModuleManagementService>>().Object, new Mock<IGlossaryRepository>().Object);

            var response = await service.SaveModuleAsync(new SaveModuleRequest { ModuleName = "common" });

            response.Success.Should().BeFalse();
            var failure = response.ValidationErrors.Should().ContainSingle().Subject;
            failure.PropertyName.Should().Be("ModuleName");
            failure.ErrorMessage.Should().Be("Module name must be unique.");
            response.ErrorMessage.Should().NotContain("E11000");
        }

        // ---- Permissions on the new routes ----

        private static string? Permission(string action) =>
            typeof(KeyController).GetMethod(action)!.CustomAttributes
                .SingleOrDefault(a => a.AttributeType.Name == "ProtectedEndPointAttribute")?
                .ConstructorArguments[0].Value as string;

        [Fact]
        public void The_summary_route_needs_the_same_permission_as_the_key_list()
        {
            Permission(nameof(KeyController.GetDuplicateSummary)).Should().Be("blocks-localization::key::gets");
            Permission(nameof(KeyController.Gets)).Should().Be("blocks-localization::key::gets");
        }

        [Fact]
        public void Enforcing_uniqueness_needs_the_bulk_delete_permission()
        {
            Permission(nameof(KeyController.EnforceUniqueness)).Should().Be("blocks-localization::key::deletekeys");
        }

        [Fact]
        public void The_summary_is_a_get_and_enforcement_is_a_post()
        {
            typeof(KeyController).GetMethod(nameof(KeyController.GetDuplicateSummary))!
                .GetCustomAttribute<Microsoft.AspNetCore.Mvc.HttpGetAttribute>().Should().NotBeNull();
            typeof(KeyController).GetMethod(nameof(KeyController.EnforceUniqueness))!
                .GetCustomAttribute<Microsoft.AspNetCore.Mvc.HttpPostAttribute>().Should().NotBeNull();
        }
    }
}
