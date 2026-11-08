using Blocks.Genesis;
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
using KeyModel = Eurolm.DomainService.Services.Key;

namespace XUnitTest.Services.Key
{
    /// <summary>SPEC15 SV12 (batched SaveKeys), SV14 (tag-only $set), SV18 (module-scoped Translate All), SV22 (key tags).</summary>
    public class KeyManagementServiceSpec15Tests
    {
        private readonly Mock<IKeyRepository> _keyRepository = new();
        private readonly Mock<IKeyTimelineRepository> _timeline = new();
        private readonly Mock<IGlossaryTerminologyService> _terminology = new();
        private readonly Mock<IGlossaryRepository> _glossaries = new();
        private readonly Mock<IServiceProvider> _serviceProvider = new();
        private readonly Mock<IValidator<KeyModel>> _validator = new();
        private readonly Mock<IMessageClient> _messageClient = new();
        private readonly Mock<ILanguageManagementService> _languages = new();
        private readonly Mock<IAssistantService> _assistant = new();
        private readonly List<IReadOnlyList<KeyBulkSave>> _bulkWrites = new();
        private readonly List<BlocksLanguageKey> _stored = new();
        private readonly KeyManagementService _service;

        public KeyManagementServiceSpec15Tests()
        {
            XUnitTest.Shared.TestBlocksContext.Set("spec15-keys");
            _serviceProvider.Setup(x => x.GetService(typeof(IGlossaryTerminologyService))).Returns(_terminology.Object);
            _serviceProvider.Setup(x => x.GetService(typeof(IGlossaryRepository))).Returns(_glossaries.Object);
            _validator.Setup(v => v.ValidateAsync(It.IsAny<KeyModel>(), default)).ReturnsAsync(new ValidationResult());
            _glossaries.Setup(g => g.GetStoredByIdsAsync(It.IsAny<IEnumerable<string>>()))
                .ReturnsAsync((IEnumerable<string> ids) => ids.Where(id => id.StartsWith('g'))
                    .Select(id => new BlocksGlossary { ItemId = id }).ToList());
            _keyRepository.Setup(r => r.GetKeysByNameAndModuleAsync(It.IsAny<IReadOnlyCollection<(string KeyName, string ModuleId)>>()))
                .ReturnsAsync((IReadOnlyCollection<(string KeyName, string ModuleId)> pairs) =>
                    _stored.Where(k => pairs.Contains((k.KeyName, k.ModuleId))).ToList());
            _keyRepository.Setup(r => r.BulkSaveKeysAsync(It.IsAny<IReadOnlyList<KeyBulkSave>>()))
                .Callback<IReadOnlyList<KeyBulkSave>>(_bulkWrites.Add)
                .ReturnsAsync(Array.Empty<KeyBulkSaveError>());
            var storageDriver = new Mock<IStorageDriverService>();

            _service = new KeyManagementService(
                _keyRepository.Object,
                _timeline.Object,
                new Mock<ILanguageFileGenerationHistoryRepository>().Object,
                _validator.Object,
                new Mock<ILogger<KeyManagementService>>().Object,
                _languages.Object,
                new Mock<IModuleManagementService>().Object,
                _messageClient.Object,
                _assistant.Object,
                storageDriver.Object,
                new StorageHelper(new Mock<ILogger<StorageHelper>>().Object, storageDriver.Object),
                _serviceProvider.Object,
                new Mock<INotificationService>().Object,
                _glossaries.Object);
        }

        private static KeyModel NewKey(string name, string module = "m1", List<string>? glossaryIds = null, bool isNewKey = false) => new()
        {
            KeyName = name,
            ModuleId = module,
            IsNewKey = isNewKey,
            GlossaryIds = glossaryIds,
            Resources = new[] { new Resource { Culture = "en-US", Value = "Open " + name } }
        };

        private static BlocksLanguageKey StoredKey(string name, string module = "m1") => new()
        {
            ItemId = "id-" + name,
            KeyName = name,
            ModuleId = module,
            Resources = new[] { new Resource { Culture = "en-US", Value = "Stored" }, new Resource { Culture = "de-DE", Value = "Gespeichert" } },
            GlossaryIds = new List<string> { "g-old" },
            GlossaryViolations = new List<KeyGlossaryViolation> { new() { Culture = "de-DE", GlossaryId = "g-old" } }
        };

        // ---- SV12 ----

        [Fact]
        public async Task H9_a_bulk_save_reads_keys_glossaries_and_the_language_setting_once_and_writes_in_one_batch()
        {
            _terminology.SetupGet(t => t.IsEnforcementEnabled).Returns(true);
            _terminology.Setup(t => t.ComputeKeyViolationsAsync(It.IsAny<IReadOnlyList<BlocksLanguageKey>>()))
                .ReturnsAsync((IReadOnlyList<BlocksLanguageKey> keys) => keys.Select(_ => (List<KeyGlossaryViolation>?)new List<KeyGlossaryViolation>()).ToList());
            _stored.Add(StoredKey("existing"));
            var keys = new List<KeyModel> { NewKey("a", glossaryIds: new() { "g1" }), NewKey("existing", glossaryIds: new() { "g2", "deleted-1" }), NewKey("b") };

            var result = await _service.SaveKeysAsync(keys);

            result.Success.Should().BeTrue();
            _keyRepository.Verify(r => r.GetKeysByNameAndModuleAsync(It.IsAny<IReadOnlyCollection<(string, string)>>()), Times.Once);
            _keyRepository.Verify(r => r.GetKeyByNameAsync(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
            _keyRepository.Verify(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>()), Times.Never);
            _glossaries.Verify(g => g.GetStoredByIdsAsync(It.IsAny<IEnumerable<string>>()), Times.Once);
            _terminology.Verify(t => t.ComputeKeyViolationsAsync(It.IsAny<IReadOnlyList<BlocksLanguageKey>>()), Times.Once);
            _terminology.Verify(t => t.ComputeKeyViolationsAsync(It.IsAny<BlocksLanguageKey>()), Times.Never);
            _bulkWrites.Should().ContainSingle().Which.Should().HaveCount(3);
            _bulkWrites[0].Should().OnlyContain(s => s.SetGlossaryViolations);
            _bulkWrites[0][1].Key.ItemId.Should().Be("id-existing");
            _bulkWrites[0][1].Key.GlossaryIds.Should().Equal("g2");
            _timeline.Verify(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()), Times.Exactly(3));
        }

        [Fact]
        public async Task H9_reads_and_writes_go_in_chunks_of_500()
        {
            var keys = Enumerable.Range(0, 501).Select(i => NewKey($"k{i:D3}")).ToList();

            var result = await _service.SaveKeysAsync(keys);

            result.Success.Should().BeTrue();
            _keyRepository.Verify(r => r.GetKeysByNameAndModuleAsync(It.IsAny<IReadOnlyCollection<(string, string)>>()), Times.Exactly(2));
            _bulkWrites.Select(w => w.Count).Should().Equal(500, 1);
            _glossaries.Verify(g => g.GetStoredByIdsAsync(It.IsAny<IEnumerable<string>>()), Times.Never);
        }

        [Fact]
        public async Task C13_a_new_key_that_already_exists_gets_the_validator_line_and_the_rest_are_stored()
        {
            _stored.Add(StoredKey("taken"));
            var keys = new List<KeyModel> { NewKey("taken", isNewKey: true), NewKey("fresh", isNewKey: true) };

            var result = await _service.SaveKeysAsync(keys);

            result.Success.Should().BeFalse();
            result.ErrorMessage.Should().Be("Bulk save completed with 1 errors out of 2 keys:\n" +
                $"Key 'taken' in Module 'm1': IsNewKey: {KeyManagementService.DuplicateKeyMessage}");
            _bulkWrites.Should().ContainSingle().Which.Should().ContainSingle(s => s.Key.KeyName == "fresh");
            keys[0].IsNewKey.Should().BeTrue("the request is left as it was sent");
        }

        [Fact]
        public async Task C13_validation_and_write_errors_keep_todays_lines_in_request_order()
        {
            var keys = new List<KeyModel> { NewKey("first"), NewKey("x"), NewKey("third") };
            _validator.Setup(v => v.ValidateAsync(keys[1], default))
                .ReturnsAsync(new ValidationResult(new[] { new ValidationFailure("KeyName", "KeyName must be between 2 and 100 characters long.") }));
            _keyRepository.Setup(r => r.BulkSaveKeysAsync(It.IsAny<IReadOnlyList<KeyBulkSave>>()))
                .ReturnsAsync(new[] { new KeyBulkSaveError(0, true, "E11000") });

            var result = await _service.SaveKeysAsync(keys);

            result.ErrorMessage.Should().Be("Bulk save completed with 2 errors out of 3 keys:\n" +
                $"Key 'first' in Module 'm1': IsNewKey: {KeyManagementService.DuplicateKeyMessage}\n" +
                "Key 'x' in Module 'm1': KeyName: KeyName must be between 2 and 100 characters long.");
            _timeline.Verify(t => t.SaveKeyTimelineAsync(It.IsAny<KeyTimeline>()), Times.Once);
        }

        [Fact]
        public async Task The_same_key_twice_in_one_request_stores_the_last_entry_and_counts_both_as_saved()
        {
            var first = NewKey("dup");
            var last = NewKey("dup");
            last.Resources = new[] { new Resource { Culture = "en-US", Value = "Last" } };

            var result = await _service.SaveKeysAsync(new List<KeyModel> { first, last });

            result.Success.Should().BeTrue();
            _bulkWrites.Should().ContainSingle().Which.Should().ContainSingle()
                .Which.Key.Resources.Single().Value.Should().Be("Last");
        }

        [Fact]
        public async Task A_bulk_tag_only_save_of_an_existing_key_is_a_set_and_keeps_failed_recomputes()
        {
            _terminology.SetupGet(t => t.IsEnforcementEnabled).Returns(true);
            _terminology.Setup(t => t.ComputeKeyViolationsAsync(It.IsAny<IReadOnlyList<BlocksLanguageKey>>()))
                .ReturnsAsync(new List<List<KeyGlossaryViolation>?> { null, new List<KeyGlossaryViolation>() });
            _stored.Add(StoredKey("tagged"));
            var tagOnly = NewKey("tagged", glossaryIds: new() { "g1" });
            tagOnly.GlossaryIdsOnly = true;
            var missing = NewKey("missing", glossaryIds: new() { "g1" });
            missing.GlossaryIdsOnly = true;

            await _service.SaveKeysAsync(new List<KeyModel> { tagOnly, missing });

            var writes = _bulkWrites.Single();
            writes[0].GlossaryIdsOnly.Should().BeTrue();
            writes[0].SetGlossaryViolations.Should().BeFalse();
            writes[0].Key.Resources.Should().Contain(r => r.Value == "Gespeichert");
            writes[1].GlossaryIdsOnly.Should().BeFalse("a key that doesn't exist takes today's create path");
            writes[1].SetGlossaryViolations.Should().BeTrue();
        }

        // ---- SV14 ----

        [Fact]
        public async Task H11_a_tag_only_save_sets_only_the_tags_date_and_recomputed_violations()
        {
            _terminology.SetupGet(t => t.IsEnforcementEnabled).Returns(true);
            _terminology.Setup(t => t.ComputeKeyViolationsAsync(It.IsAny<BlocksLanguageKey>())).ReturnsAsync(new List<KeyGlossaryViolation>());
            _keyRepository.Setup(r => r.GetKeyByNameAsync("tagged", "m1")).ReturnsAsync(() => StoredKey("tagged"));
            _keyRepository.Setup(r => r.SetGlossaryIdsAsync(It.IsAny<BlocksLanguageKey>(), It.IsAny<bool>())).ReturnsAsync(true);
            var request = NewKey("tagged", glossaryIds: new() { "g1" });
            request.GlossaryIdsOnly = true;

            var result = await _service.SaveKeyAsync(request);

            result.Success.Should().BeTrue();
            _keyRepository.Verify(r => r.SetGlossaryIdsAsync(It.Is<BlocksLanguageKey>(k => k.GlossaryIds!.SequenceEqual(new[] { "g1" })), true), Times.Once);
            _keyRepository.Verify(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>()), Times.Never);
        }

        [Fact]
        public async Task C16_a_failed_recompute_keeps_the_stored_violations_on_a_tag_only_save()
        {
            _terminology.SetupGet(t => t.IsEnforcementEnabled).Returns(true);
            _terminology.Setup(t => t.ComputeKeyViolationsAsync(It.IsAny<BlocksLanguageKey>())).ThrowsAsync(new InvalidOperationException("db down"));
            _keyRepository.Setup(r => r.GetKeyByNameAsync("tagged", "m1")).ReturnsAsync(() => StoredKey("tagged"));
            _keyRepository.Setup(r => r.SetGlossaryIdsAsync(It.IsAny<BlocksLanguageKey>(), It.IsAny<bool>())).ReturnsAsync(true);
            var request = NewKey("tagged", glossaryIds: new() { "g1" });
            request.GlossaryIdsOnly = true;

            await _service.SaveKeyAsync(request);

            _keyRepository.Verify(r => r.SetGlossaryIdsAsync(It.IsAny<BlocksLanguageKey>(), false), Times.Once);
        }

        [Fact]
        public async Task C16_a_tag_only_save_of_a_missing_key_creates_it()
        {
            _keyRepository.Setup(r => r.GetKeyByNameAsync("new", "m1")).ReturnsAsync((BlocksLanguageKey)null!);
            var request = NewKey("new", glossaryIds: new() { "g1" });
            request.GlossaryIdsOnly = true;

            await _service.SaveKeyAsync(request);

            _keyRepository.Verify(r => r.SaveKeyAsync(It.Is<BlocksLanguageKey>(k => k.KeyName == "new" && k.Resources.Length == 1)), Times.Once);
            _keyRepository.Verify(r => r.SetGlossaryIdsAsync(It.IsAny<BlocksLanguageKey>(), It.IsAny<bool>()), Times.Never);
        }

        // ---- SV22: key tags from server lists ----

        [Fact]
        public async Task H20_a_key_save_keeps_glossary_ids_taken_from_server_lists()
        {
            BlocksLanguageKey? saved = null;
            _keyRepository.Setup(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>())).Callback<BlocksLanguageKey>(k => saved = k).Returns(Task.CompletedTask);

            await _service.SaveKeyAsync(NewKey("k1", glossaryIds: new() { "g1", "g2", "g1" }));

            saved!.GlossaryIds.Should().Equal("g1", "g2");
        }

        // ---- SV18 ----

        [Theory]
        [InlineData(" m1 ", "m1")]
        [InlineData("m1", "m1")]
        [InlineData("", null)]
        [InlineData("   ", null)]
        [InlineData(null, null)]
        public async Task H15_H16_translate_all_copies_the_trimmed_module_into_the_event(string? moduleId, string? expected)
        {
            ConsumerMessage<TranslateAllEvent>? sent = null;
            _messageClient.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<TranslateAllEvent>>()))
                .Callback<ConsumerMessage<TranslateAllEvent>>(m => sent = m)
                .Returns(Task.CompletedTask);

            await _service.SendTranslateAllEvent(new TranslateAllRequest { DefaultLanguage = "en-US", ModuleId = moduleId!, MessageCoRelationId = "" });

            sent!.Payload.ModuleId.Should().Be(expected);
            sent.Payload.ProjectKey.Should().Be("spec15-keys");
            sent.Payload.DefaultLanguage.Should().Be("en-US");
        }

        [Theory]
        [InlineData("m2")]
        [InlineData(null)]
        public async Task H15_H16_C19_change_all_pages_only_the_requested_module(string? moduleId)
        {
            _languages.Setup(l => l.GetLanguagesAsync()).ReturnsAsync(new List<Language>
            {
                new() { LanguageCode = "en-US", LanguageName = "English", IsDefault = true },
                new() { LanguageCode = "de-DE", LanguageName = "German" }
            });
            _keyRepository.Setup(r => r.GetUilmResourceKeysWithPage(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<string?>()))
                .ReturnsAsync(new List<BlocksLanguageKey>().AsQueryable());

            var done = await _service.ChangeAll(new TranslateAllEvent { DefaultLanguage = "en-US", ModuleId = moduleId, ProjectKey = "spec15-keys" });

            done.Should().BeTrue();
            _keyRepository.Verify(r => r.GetUilmResourceKeysWithPage(0, It.IsAny<int>(), moduleId), Times.Once);
            _keyRepository.Verify(r => r.GetUilmResourceKeysWithPage(It.IsAny<int>(), It.IsAny<int>(), It.Is<string?>(m => m != moduleId)), Times.Never);
            _assistant.Verify(a => a.SuggestTranslation(It.IsAny<SuggestLanguageRequest>()), Times.Never);
            _keyRepository.Verify(r => r.UpdateUilmResourceKeysForChangeAll(It.IsAny<List<BlocksLanguageKey>>()), Times.Never);
        }

        [Fact]
        public async Task A_tag_only_duplicate_after_a_full_save_keeps_the_full_saves_resources()
        {
            _stored.Add(StoredKey("dup"));
            var full = NewKey("dup");
            full.Resources = new[] { new Resource { Culture = "en-US", Value = "New text" } };
            var tagOnly = NewKey("dup", glossaryIds: new() { "g1" });
            tagOnly.GlossaryIdsOnly = true;

            var result = await _service.SaveKeysAsync(new List<KeyModel> { full, tagOnly });

            result.Success.Should().BeTrue();
            var write = _bulkWrites.Single().Single();
            write.GlossaryIdsOnly.Should().BeFalse();
            write.Key.Resources.Single().Value.Should().Be("New text");
            write.Key.GlossaryIds.Should().Equal("g1");
        }

        [Fact]
        public async Task Two_new_key_entries_for_the_same_key_store_the_last_and_report_no_error()
        {
            var first = NewKey("brand-new", isNewKey: true);
            var last = NewKey("brand-new", isNewKey: true);
            last.Resources = new[] { new Resource { Culture = "en-US", Value = "Last" } };

            var result = await _service.SaveKeysAsync(new List<KeyModel> { first, last });

            result.Success.Should().BeTrue();
            _bulkWrites.Single().Single().Key.Resources.Single().Value.Should().Be("Last");
        }

    }
}
