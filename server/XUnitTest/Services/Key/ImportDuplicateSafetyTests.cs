using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Services.HelperService;
using Eurolm.DomainService.Shared.Entities;
using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using Moq;
using StorageDriver;
using Xunit;
using XUnitTest.Shared;
using BlocksLanguageKey = Eurolm.DomainService.Repositories.BlocksLanguageKey;
using KeyModel = Eurolm.DomainService.Services.Key;
using KeyTimeline = Eurolm.DomainService.Services.KeyTimeline;

namespace XUnitTest.Services.Key
{
    /// <summary>
    /// Once the unique indexes exist, JSON/CSV/XLSX imports must neither fail on a key the file repeats
    /// nor orphan keys when another import created the same new module at the same moment.
    /// </summary>
    public class ImportDuplicateSafetyTests
    {
        private readonly Mock<IKeyRepository> _keyRepository = new();
        private readonly Mock<IKeyTimelineRepository> _timeline = new();
        private readonly KeyManagementService _service;
        private readonly List<string> _order = new();
        private List<BlocksLanguageKey>? _insertedKeys;

        public ImportDuplicateSafetyTests()
        {
            TestBlocksContext.Set("tenant-1");
            var storageDriver = new Mock<IStorageDriverService>();
            _service = new KeyManagementService(
                _keyRepository.Object, _timeline.Object, new Mock<ILanguageFileGenerationHistoryRepository>().Object,
                new Mock<IValidator<KeyModel>>().Object, new Mock<ILogger<KeyManagementService>>().Object,
                new Mock<ILanguageManagementService>().Object, new Mock<IModuleManagementService>().Object,
                new Mock<IMessageClient>().Object, new Mock<IAssistantService>().Object, storageDriver.Object,
                new StorageHelper(new Mock<ILogger<StorageHelper>>().Object, storageDriver.Object),
                new Mock<IServiceProvider>().Object, new Mock<INotificationService>().Object, new Mock<IGlossaryRepository>().Object);

            _keyRepository.Setup(r => r.InsertModulesSkippingTakenNamesAsync(It.IsAny<List<BlocksLanguageModule>>()))
                .Callback(() => _order.Add("modules"))
                .ReturnsAsync(new List<BlocksLanguageModule>());
            _keyRepository.Setup(r => r.InsertOrMergeResourceKeysAsync(It.IsAny<List<BlocksLanguageKey>>()))
                .Callback<List<BlocksLanguageKey>>(keys => { _order.Add("keys"); _insertedKeys = keys; })
                .ReturnsAsync(new List<BlocksLanguageKey>());
            _keyRepository.Setup(r => r.UpdateKeysCountOfAppAsync(It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);
        }

        private Task ProcessJson(List<BlocksLanguageModule> dbModules, params LanguageJsonModel[] rows)
        {
            var method = typeof(KeyManagementService).GetMethod("ProcessJsonFile", BindingFlags.NonPublic | BindingFlags.Instance)!;
            return (Task)method.Invoke(_service, new object[] { dbModules, rows.ToList() })!;
        }

        private static LanguageJsonModel Row(string module, string key, string culture, string value) =>
            new() { _id = Guid.NewGuid().ToString(), Module = module, KeyName = key, Resources = new[] { new Resource { Culture = culture, Value = value } } };

        [Fact]
        public async Task A_key_the_file_repeats_becomes_one_row_with_both_translations()
        {
            var common = new BlocksLanguageModule { ItemId = "m1", ModuleName = "common" };

            await ProcessJson(new List<BlocksLanguageModule> { common },
                Row("common", "save", "en-US", "Save"),
                Row("common", "save", "de-DE", "Speichern"),
                Row("common", "cancel", "en-US", "Cancel"));

            _insertedKeys.Should().HaveCount(2);
            var save = _insertedKeys!.Single(k => k.KeyName == "save");
            save.Resources.Select(r => (r.Culture, r.Value)).Should().BeEquivalentTo(new[] { ("en-US", "Save"), ("de-DE", "Speichern") });
            _timeline.Verify(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()), Times.Exactly(2));
        }

        [Fact]
        public async Task Keys_merged_into_a_concurrent_writers_row_get_no_insert_timeline_entry()
        {
            var common = new BlocksLanguageModule { ItemId = "m1", ModuleName = "common" };
            _keyRepository.Setup(r => r.InsertOrMergeResourceKeysAsync(It.IsAny<List<BlocksLanguageKey>>()))
                .ReturnsAsync((List<BlocksLanguageKey> keys) => keys.Where(k => k.KeyName == "save").ToList());

            await ProcessJson(new List<BlocksLanguageModule> { common },
                Row("common", "save", "en-US", "Save"),
                Row("common", "cancel", "en-US", "Cancel"));

            _timeline.Verify(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()), Times.Once);
        }

        [Fact]
        public async Task New_modules_are_saved_before_the_keys_that_use_them()
        {
            await ProcessJson(new List<BlocksLanguageModule>(), Row("brand-new", "save", "en-US", "Save"));

            _order.Should().Equal("modules", "keys");
            _keyRepository.Verify(r => r.InsertUilmApplications(It.IsAny<List<BlocksLanguageModule>>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Keys_move_to_a_module_another_import_created_at_the_same_moment()
        {
            _keyRepository.Setup(r => r.InsertModulesSkippingTakenNamesAsync(It.IsAny<List<BlocksLanguageModule>>()))
                .ReturnsAsync((List<BlocksLanguageModule> modules) => modules.ToList());
            _keyRepository.Setup(r => r.GetUilmApplications<BlocksLanguageModule>(It.IsAny<Expression<Func<BlocksLanguageModule, bool>>>()))
                .ReturnsAsync(new List<BlocksLanguageModule> { new() { ItemId = "their-module", ModuleName = "brand-new" } });
            var counted = new List<string>();
            _keyRepository.Setup(r => r.UpdateKeysCountOfAppAsync(It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<string>(), It.IsAny<string>()))
                .Callback<string, bool, string, string>((id, _, _, _) => counted.Add(id))
                .ReturnsAsync(true);

            await ProcessJson(new List<BlocksLanguageModule>(), Row("brand-new", "save", "en-US", "Save"));

            _insertedKeys.Should().ContainSingle().Which.ModuleId.Should().Be("their-module");
            counted.Should().Equal("their-module");
        }
    }

    /// <summary>The repository side of the import fallbacks.</summary>
    public class ImportDuplicateSafetyRepositoryTests
    {
        private readonly Mock<IDbContextProvider> _dbContextProvider = new();
        private readonly Mock<IMongoDatabase> _database = new();
        private readonly Mock<IMongoCollection<BlocksLanguageKey>> _keys = new();
        private readonly Mock<IMongoCollection<BlocksLanguageModule>> _modules = new();
        private readonly KeyRepository _repo;
        private InsertManyOptions? _keyInsertOptions;

        public ImportDuplicateSafetyRepositoryTests()
        {
            TestBlocksContext.Set("tenant-1");
            _dbContextProvider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(_database.Object);
            _database.Setup(x => x.GetCollection<BlocksLanguageKey>("BlocksLanguageKeys", null)).Returns(_keys.Object);
            _database.Setup(x => x.GetCollection<BlocksLanguageModule>("BlocksLanguageModules", null)).Returns(_modules.Object);
            _keys.Setup(x => x.BulkWriteAsync(It.IsAny<IEnumerable<WriteModel<BlocksLanguageKey>>>(), It.IsAny<BulkWriteOptions>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((IEnumerable<WriteModel<BlocksLanguageKey>> ops, BulkWriteOptions _, CancellationToken _) =>
                    new BulkWriteResult<BlocksLanguageKey>.Acknowledged(ops.Count(), 0, 0, 0, 0, ops.ToList(), new List<BulkWriteUpsert>()));
            _repo = new KeyRepository(_dbContextProvider.Object);
        }

        private static List<BlocksLanguageKey> Keys(params string[] names) =>
            names.Select(n => new BlocksLanguageKey { ItemId = n, ModuleId = "m1", KeyName = n }).ToList();

        [Fact]
        public async Task New_keys_are_inserted_unordered_so_one_rejection_does_not_stop_the_rest()
        {
            _keys.Setup(x => x.InsertManyAsync(It.IsAny<IEnumerable<BlocksLanguageKey>>(), It.IsAny<InsertManyOptions>(), It.IsAny<CancellationToken>()))
                .Callback<IEnumerable<BlocksLanguageKey>, InsertManyOptions, CancellationToken>((_, o, _) => _keyInsertOptions = o)
                .Returns(Task.CompletedTask);

            var merged = await _repo.InsertOrMergeResourceKeysAsync(Keys("a", "b"));

            merged.Should().BeEmpty();
            _keyInsertOptions!.IsOrdered.Should().BeFalse();
        }

        [Fact]
        public async Task Keys_another_writer_created_meanwhile_are_merged_into_its_rows()
        {
            var keys = Keys("a", "b", "c");
            _keys.Setup(x => x.InsertManyAsync(It.IsAny<IEnumerable<BlocksLanguageKey>>(), It.IsAny<InsertManyOptions>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(MongoExceptionFactory.BulkWrite(new List<WriteModel<BlocksLanguageKey>>(),
                    new[] { MongoExceptionFactory.BulkError(1) }, Enumerable.Empty<WriteModel<BlocksLanguageKey>>()));

            var merged = await _repo.InsertOrMergeResourceKeysAsync(keys);

            merged.Should().Equal(keys[1]);
            _keys.Verify(x => x.BulkWriteAsync(
                It.Is<IEnumerable<WriteModel<BlocksLanguageKey>>>(ops => ops.Count() == 1),
                It.IsAny<BulkWriteOptions>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Any_other_insert_error_still_fails_the_import()
        {
            _keys.Setup(x => x.InsertManyAsync(It.IsAny<IEnumerable<BlocksLanguageKey>>(), It.IsAny<InsertManyOptions>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(MongoExceptionFactory.BulkWrite(new List<WriteModel<BlocksLanguageKey>>(),
                    new[] { MongoExceptionFactory.BulkError(0, code: 2) }, Enumerable.Empty<WriteModel<BlocksLanguageKey>>()));

            var act = () => _repo.InsertOrMergeResourceKeysAsync(Keys("a"));

            await act.Should().ThrowAsync<MongoBulkWriteException<BlocksLanguageKey>>();
        }

        [Fact]
        public async Task Modules_whose_name_was_taken_meanwhile_are_skipped_and_reported()
        {
            var modules = new List<BlocksLanguageModule> { new() { ItemId = "x", ModuleName = "taken" }, new() { ItemId = "y", ModuleName = "free" } };
            _modules.Setup(x => x.InsertManyAsync(It.IsAny<IEnumerable<BlocksLanguageModule>>(), It.IsAny<InsertManyOptions>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(MongoExceptionFactory.BulkWrite(new List<WriteModel<BlocksLanguageModule>>(),
                    new[] { MongoExceptionFactory.BulkError(0) }, Enumerable.Empty<WriteModel<BlocksLanguageModule>>()));

            var skipped = await _repo.InsertModulesSkippingTakenNamesAsync(modules);

            skipped.Should().Equal(modules[0]);
        }
    }
}
