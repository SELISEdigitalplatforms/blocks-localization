using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared.Events;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Worker.Consumers;
using Xunit;

namespace XUnitTest.Worker
{
    /// <summary>
    /// The migration and import consumers turn on uniqueness for a clean tenant before they write,
    /// and the migration matches and writes key names trimmed.
    /// </summary>
    public class DuplicatePreventionConsumerTests
    {
        private readonly Mock<IKeyManagementService> _keyManagementService = new();
        private readonly Mock<IEnvironmentDataMigrationRepository> _migrationRepository = new(MockBehavior.Loose);
        private readonly Mock<ILogger<EuroLMEnvironmentDataMigrationEventConsumer>> _migrationLogger = new();
        private readonly Mock<IMessageClient> _messageClient = new();
        private readonly Mock<ILocalizationUniquenessRepository> _uniqueness = new();
        private readonly List<string> _order = new();
        private List<BlocksLanguageKey>? _writtenKeys;

        private EuroLMEnvironmentDataMigrationEventConsumer MigrationConsumer() =>
            new(_keyManagementService.Object, _migrationRepository.Object, _migrationLogger.Object, _messageClient.Object, _uniqueness.Object);

        private static EnvironmentDataMigrationEvent Event(bool overwrite = false) =>
            new() { ProjectKey = "source", TargetedProjectKey = "target", ShouldOverWriteExistingData = overwrite, TrackerId = "tracker-1" };

        private void SetupMigration(bool overwrite, params string[] sourceKeyNames)
        {
            var module = new BlocksLanguageModule { ItemId = "sm1", ModuleName = "common", Name = "Common" };
            var target = new BlocksLanguageModule { ItemId = "tm1", ModuleName = "common", Name = "Common" };
            var keys = sourceKeyNames.Select((name, i) => new BlocksLanguageKey
            {
                ItemId = $"sk{i}", ModuleId = "sm1", KeyName = name, LastUpdateDate = DateTime.UtcNow.AddMinutes(i),
            }).ToList();

            _uniqueness.Setup(u => u.EnsureUniqueIndexesAsync("target"))
                .Callback(() => _order.Add("ensure"))
                .ReturnsAsync(new EnforceUniquenessResponse());
            _migrationRepository.Setup(x => x.GetAllModulesAsync("source")).ReturnsAsync(new List<BlocksLanguageModule> { module });
            _migrationRepository.Setup(x => x.GetAllModulesAsync("target")).ReturnsAsync(new List<BlocksLanguageModule> { target });
            _migrationRepository.Setup(x => x.GetExistingModulesByNamesAsync(It.IsAny<List<string>>(), "target")).ReturnsAsync(new List<BlocksLanguageModule>());
            _migrationRepository.Setup(x => x.BulkUpsertModulesByNameAsync(It.IsAny<List<BlocksLanguageModule>>(), "target", overwrite))
                .Callback(() => _order.Add("modules"))
                .Returns(Task.CompletedTask);
            _migrationRepository.Setup(x => x.GetAllKeysAsync("source")).ReturnsAsync(keys);
            _migrationRepository.Setup(x => x.GetExistingKeysByModuleNameAndKeyNameAsync(
                    It.IsAny<List<(string, string)>>(), It.IsAny<Dictionary<string, string>>(), "target"))
                .ReturnsAsync(new List<BlocksLanguageKey>());
            _migrationRepository.Setup(x => x.BulkUpsertKeysByModuleNameAndKeyNameAsync(
                    It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<Dictionary<string, string>>(), "target", overwrite))
                .Callback<List<BlocksLanguageKey>, List<BlocksLanguageKey>, Dictionary<string, string>, string, bool>((k, _, _, _, _) => _writtenKeys = k)
                .ReturnsAsync(new BulkUpsertResult());
        }

        private void VerifyLogged(LogLevel level, string fragment) =>
            _migrationLogger.Verify(x => x.Log(level, It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains(fragment)),
                It.IsAny<Exception?>(), It.IsAny<Func<It.IsAnyType, Exception?, string>>()), Times.AtLeastOnce);

        // ---- Migration ----

        [Fact]
        public async Task The_migration_ensures_the_target_indexes_before_writing_modules()
        {
            SetupMigration(false, "save");

            await MigrationConsumer().Consume(Event());

            _order.Should().Equal("ensure", "modules");
        }

        [Fact]
        public async Task A_failed_ensure_is_logged_and_the_migration_carries_on()
        {
            SetupMigration(false, "save");
            _uniqueness.Setup(u => u.EnsureUniqueIndexesAsync("target")).ThrowsAsync(new InvalidOperationException("index build failed"));

            await MigrationConsumer().Consume(Event());

            _writtenKeys.Should().ContainSingle();
            VerifyLogged(LogLevel.Error, "continuing the migration");
        }

        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public async Task Source_key_names_are_matched_and_written_trimmed(bool overwrite)
        {
            SetupMigration(overwrite, " save ");

            await MigrationConsumer().Consume(Event(overwrite));

            _writtenKeys.Should().ContainSingle().Which.KeyName.Should().Be("save");
            _migrationRepository.Verify(x => x.GetExistingKeysByModuleNameAndKeyNameAsync(
                It.Is<List<(string ModuleName, string KeyName)>>(pairs => pairs.Count == 1 && pairs[0].ModuleName == "common" && pairs[0].KeyName == "save"),
                It.IsAny<Dictionary<string, string>>(), "target"), Times.Once);
            // The overwrite flag reaches the write unchanged.
            _migrationRepository.Verify(x => x.BulkUpsertKeysByModuleNameAndKeyNameAsync(
                It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<List<BlocksLanguageKey>>(), It.IsAny<Dictionary<string, string>>(), "target", overwrite), Times.Once);
        }

        [Fact]
        public async Task Names_that_differ_only_by_whitespace_become_one_key()
        {
            SetupMigration(false, "save", " save ");

            await MigrationConsumer().Consume(Event());

            _writtenKeys.Should().ContainSingle().Which.KeyName.Should().Be("save");
        }

        [Fact]
        public async Task Names_empty_after_trimming_are_skipped_and_counted()
        {
            SetupMigration(false, "save", "   ", "");

            await MigrationConsumer().Consume(Event());

            _writtenKeys.Should().ContainSingle().Which.KeyName.Should().Be("save");
            VerifyLogged(LogLevel.Warning, "Skipped 2 source keys");
        }

        [Fact]
        public async Task Untrimmed_rows_already_in_the_target_are_counted_and_left_alone()
        {
            SetupMigration(false, "save");
            _migrationRepository.Setup(x => x.CountUntrimmedKeyNamesAsync(It.Is<IEnumerable<string>>(ids => ids.SequenceEqual(new[] { "tm1" })), "target"))
                .ReturnsAsync(1);

            await MigrationConsumer().Consume(Event());

            VerifyLogged(LogLevel.Information, "1 key names with leading or trailing whitespace");
            _writtenKeys.Should().ContainSingle().Which.KeyName.Should().Be("save");
        }

        // ---- Import ----

        private UilmImportEventConsumer ImportConsumer(Mock<IWebHookService> webhook) =>
            new(_keyManagementService.Object, webhook.Object, _uniqueness.Object, new Mock<ILogger<UilmImportEventConsumer>>().Object);

        [Fact]
        public async Task The_import_ensures_the_context_tenant_indexes_before_importing()
        {
            var evt = new UilmImportEvent { FileId = "f1", ProjectKey = "project-key" };
            _uniqueness.Setup(u => u.EnsureUniqueIndexesAsync(It.IsAny<string>())).Callback(() => _order.Add("ensure")).ReturnsAsync(new EnforceUniquenessResponse());
            _keyManagementService.Setup(k => k.ImportUilmFile(evt)).Callback(() => _order.Add("import")).ReturnsAsync(true);
            XUnitTest.Shared.TestBlocksContext.Set("import-tenant");
            try
            {
                await ImportConsumer(new Mock<IWebHookService>()).Consume(evt);
            }
            finally { BlocksContext.ClearContext(); }

            _order.Should().Equal("ensure", "import");
            _uniqueness.Verify(u => u.EnsureUniqueIndexesAsync("import-tenant"), Times.Once);
        }

        [Fact]
        public async Task A_failed_ensure_never_stops_the_import()
        {
            var evt = new UilmImportEvent { FileId = "f1", ProjectKey = "project-key" };
            _uniqueness.Setup(u => u.EnsureUniqueIndexesAsync(It.IsAny<string>())).ThrowsAsync(new InvalidOperationException("down"));
            _keyManagementService.Setup(k => k.ImportUilmFile(evt)).ReturnsAsync(true);
            var webhook = new Mock<IWebHookService>();
            BlocksContext.ClearContext();

            await ImportConsumer(webhook).Consume(evt);

            _uniqueness.Verify(u => u.EnsureUniqueIndexesAsync("project-key"), Times.Once);
            _keyManagementService.Verify(k => k.ImportUilmFile(evt), Times.Once);
            webhook.Verify(w => w.CallWebhook(It.IsAny<object>()), Times.Once);
        }
    }
}
