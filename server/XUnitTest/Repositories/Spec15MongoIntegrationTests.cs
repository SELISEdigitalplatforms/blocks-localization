using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using Xunit;
using XUnitTest.Shared;

namespace XUnitTest.Repositories
{
    /// <summary>
    /// SPEC15 repository behaviour that a mocked collection cannot show (filters, $set, bulk errors, index
    /// creation). Runs against local MongoDB, like the keyset tests (port from BLOCKS_ROUTING_TEST_MONGO_PORT).
    /// </summary>
    public sealed class Spec15MongoIntegrationTests : IDisposable
    {
        private readonly MongoClient _client;
        private readonly string _databaseName = "blocks_spec15_" + Guid.NewGuid().ToString("N");
        private readonly IMongoDatabase _database;
        private readonly IMongoCollection<BlocksLanguageKey> _keys;
        private readonly IMongoCollection<BlocksGlossary> _glossaries;
        private readonly Mock<IDbContextProvider> _provider = new();

        public Spec15MongoIntegrationTests()
        {
            TestBlocksContext.Set("spec15-tenant");
            var port = Environment.GetEnvironmentVariable("BLOCKS_ROUTING_TEST_MONGO_PORT") ?? "27017";
            _client = new MongoClient($"mongodb://localhost:{port}/?appName=spec15-tests");
            _database = _client.GetDatabase(_databaseName);
            _database.RunCommand<BsonDocument>(new BsonDocument("ping", 1));
            _keys = _database.GetCollection<BlocksLanguageKey>("BlocksLanguageKeys");
            _glossaries = _database.GetCollection<BlocksGlossary>("BlocksGlossaries");
            _provider.Setup(x => x.GetDatabase(It.IsAny<string>())).Returns(_database);
        }

        public void Dispose()
        {
            _client.DropDatabase(_databaseName);
            _client.Dispose();
        }

        private KeyRepository KeyRepo() => new(_provider.Object, NullLogger<KeyRepository>.Instance);

        private static KeyGlossaryViolation Violation(string glossaryId, string culture = "de-DE") => new()
        {
            Culture = culture,
            GlossaryId = glossaryId,
            Term = "Workspace",
            Kind = GlossaryViolationKinds.MissingTranslation,
            DetectedAt = new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc)
        };

        private static BlocksLanguageKey Key(string itemId, string keyName, string moduleId, string german, List<string>? glossaryIds = null,
                                             List<KeyGlossaryViolation>? violations = null) => new()
        {
            ItemId = itemId,
            KeyName = keyName,
            ModuleId = moduleId,
            Resources = new[] { new Resource { Culture = "en-US", Value = "Open" }, new Resource { Culture = "de-DE", Value = german } },
            Routes = new List<string>(),
            GlossaryIds = glossaryIds,
            GlossaryViolations = violations
        };

        private Task<BlocksLanguageKey> StoredAsync(string keyName, string moduleId) =>
            _keys.Find(k => k.KeyName == keyName && k.ModuleId == moduleId).FirstOrDefaultAsync();

        // ---- SV11: environment data migration ----

        [Fact]
        public async Task Migration_overwrite_keeps_the_target_keys_tags_and_violations_and_merges_resources()
        {
            var target = Key("t1", "open", "m1", "Öffnen", new List<string> { "tg" }, new List<KeyGlossaryViolation> { Violation("tg") });
            target.Resources = target.Resources.Append(new Resource { Culture = "fr-FR", Value = "Ouvrir" }).ToArray();
            await _keys.InsertOneAsync(target);
            var source = Key("t1", "open", "m1", "Öffne", new List<string> { "sg" }, new List<KeyGlossaryViolation> { Violation("sg") });
            var repo = new EnvironmentDataMigrationRepository(_provider.Object);

            await repo.BulkUpsertKeysByModuleNameAndKeyNameAsync(new List<BlocksLanguageKey> { source }, new List<BlocksLanguageKey> { target },
                new Dictionary<string, string>(), "target", shouldOverwrite: true);

            var stored = await StoredAsync("open", "m1");
            stored.GlossaryIds.Should().Equal("tg");
            stored.GlossaryViolations.Should().ContainSingle().Which.GlossaryId.Should().Be("tg");
            stored.Resources.Should().Contain(r => r.Culture == "de-DE" && r.Value == "Öffne").And.Contain(r => r.Culture == "fr-FR");
        }

        [Fact]
        public async Task Migration_overwrite_by_item_id_keeps_the_target_keys_tags_and_violations()
        {
            var target = Key("t1", "open", "m1", "Öffnen", new List<string> { "tg" }, new List<KeyGlossaryViolation> { Violation("tg") });
            await _keys.InsertOneAsync(target);
            var source = Key("t1", "open", "m1", "Öffne", new List<string> { "sg" }, new List<KeyGlossaryViolation> { Violation("sg") });
            var repo = new EnvironmentDataMigrationRepository(_provider.Object);

            await repo.BulkUpsertKeysAsync(new List<BlocksLanguageKey> { source }, new List<BlocksLanguageKey> { target }, "target", shouldOverwrite: true);

            var stored = await StoredAsync("open", "m1");
            stored.GlossaryIds.Should().Equal("tg");
            stored.GlossaryViolations.Should().ContainSingle().Which.GlossaryId.Should().Be("tg");
        }

        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public async Task Migration_inserts_keep_only_tags_and_violations_of_glossaries_in_the_target(bool shouldOverwrite)
        {
            await _glossaries.InsertOneAsync(new BlocksGlossary { ItemId = "shared", Name = "Workspace", NormalizedName = "workspace" });
            var source = Key("new-1", "fresh", "m1", "Neu", new List<string> { "shared", "source-only" },
                new List<KeyGlossaryViolation> { Violation("shared"), Violation("source-only") });
            var repo = new EnvironmentDataMigrationRepository(_provider.Object);

            await repo.BulkUpsertKeysByModuleNameAndKeyNameAsync(new List<BlocksLanguageKey> { source }, new List<BlocksLanguageKey>(),
                new Dictionary<string, string>(), "target", shouldOverwrite);

            var stored = await StoredAsync("fresh", "m1");
            stored.GlossaryIds.Should().Equal("shared");
            stored.GlossaryViolations.Should().ContainSingle().Which.GlossaryId.Should().Be("shared");
        }

        [Fact]
        public async Task Migration_insert_only_by_item_id_keeps_only_tags_of_glossaries_in_the_target()
        {
            await _glossaries.InsertOneAsync(new BlocksGlossary { ItemId = "shared", Name = "Workspace", NormalizedName = "workspace" });
            var source = Key("new-1", "fresh", "m1", "Neu", new List<string> { "shared", "source-only" },
                new List<KeyGlossaryViolation> { Violation("source-only") });
            var repo = new EnvironmentDataMigrationRepository(_provider.Object);

            await repo.BulkUpsertKeysAsync(new List<BlocksLanguageKey> { source }, new List<BlocksLanguageKey>(), "target", shouldOverwrite: false);

            var stored = await StoredAsync("fresh", "m1");
            stored.GlossaryIds.Should().Equal("shared");
            stored.GlossaryViolations.Should().BeEmpty();
        }

        // ---- SV14: tag-only save ----

        [Fact]
        public async Task A_tag_only_set_keeps_a_translation_saved_after_the_read()
        {
            await _keys.InsertOneAsync(Key("k1", "open", "m1", "Öffnen", new List<string> { "g-old" }, new List<KeyGlossaryViolation> { Violation("g-old") }));
            var staleCopy = await StoredAsync("open", "m1");
            await _keys.UpdateOneAsync(k => k.ItemId == "k1", Builders<BlocksLanguageKey>.Update.Set(k => k.Resources,
                new[] { new Resource { Culture = "en-US", Value = "Open" }, new Resource { Culture = "de-DE", Value = "Neuer Wert" } }));
            staleCopy.GlossaryIds = new List<string> { "g1" };
            staleCopy.GlossaryViolations = new List<KeyGlossaryViolation>();
            staleCopy.LastUpdateDate = new DateTime(2026, 11, 4, 0, 0, 0, DateTimeKind.Utc);

            var matched = await KeyRepo().SetGlossaryIdsAsync(staleCopy, setGlossaryViolations: true);

            matched.Should().BeTrue();
            var stored = await StoredAsync("open", "m1");
            stored.Resources.Single(r => r.Culture == "de-DE").Value.Should().Be("Neuer Wert");
            stored.GlossaryIds.Should().Equal("g1");
            stored.GlossaryViolations.Should().BeEmpty();
            stored.LastUpdateDate.Should().Be(staleCopy.LastUpdateDate);
        }

        [Fact]
        public async Task A_tag_only_set_without_a_recompute_keeps_the_stored_violations_and_reports_a_missing_key()
        {
            await _keys.InsertOneAsync(Key("k1", "open", "m1", "Öffnen", new List<string> { "g-old" }, new List<KeyGlossaryViolation> { Violation("g-old") }));
            var update = Key("ignored", "open", "m1", "x", new List<string> { "g1" }, new List<KeyGlossaryViolation>());

            (await KeyRepo().SetGlossaryIdsAsync(update, setGlossaryViolations: false)).Should().BeTrue();
            (await KeyRepo().SetGlossaryIdsAsync(Key("x", "missing", "m1", "x"), setGlossaryViolations: false)).Should().BeFalse();

            var stored = await StoredAsync("open", "m1");
            stored.GlossaryIds.Should().Equal("g1");
            stored.GlossaryViolations.Should().ContainSingle().Which.GlossaryId.Should().Be("g-old");
            (await StoredAsync("missing", "m1")).Should().BeNull();
        }

        // ---- SV12: batched key saves ----

        [Fact]
        public async Task Keys_are_read_by_name_and_module_pairs_only()
        {
            await _keys.InsertManyAsync(new[] { Key("a", "k1", "m1", ""), Key("b", "k2", "m2", ""), Key("c", "k1", "m2", "") });

            var found = await KeyRepo().GetKeysByNameAndModuleAsync(new List<(string, string)> { ("k1", "m1"), ("k2", "m2") });

            found.Select(k => k.ItemId).Should().BeEquivalentTo(new[] { "a", "b" });
        }

        [Fact]
        public async Task A_bulk_save_reports_the_rejected_entry_by_index_and_stores_the_others()
        {
            await _keys.Indexes.CreateOneAsync(new CreateIndexModel<BlocksLanguageKey>(
                Builders<BlocksLanguageKey>.IndexKeys.Ascending(k => k.ModuleId).Ascending(k => k.KeyName), new CreateIndexOptions { Unique = true }));
            await _keys.InsertOneAsync(Key("existing", "taken", "m1", "Alt", new List<string> { "g-old" }));

            var errors = await KeyRepo().BulkSaveKeysAsync(new List<KeyBulkSave>
            {
                new(Key("new-1", "fresh", "m1", "Neu"), false, false),
                // A replacement may not change _id, so this entry is rejected.
                new(Key("other-id", "taken", "m1", "Neu"), false, false),
                new(Key("ignored", "taken", "m1", "ignored", new List<string> { "g1" }), true, false)
            });

            errors.Should().ContainSingle().Which.Should().Match<KeyBulkSaveError>(e => e.Index == 1 && e.IsDuplicateKey);
            (await StoredAsync("fresh", "m1")).Should().NotBeNull();
            var taken = await StoredAsync("taken", "m1");
            taken.ItemId.Should().Be("existing");
            taken.GlossaryIds.Should().Equal("g1");
            taken.Resources.Single(r => r.Culture == "de-DE").Value.Should().Be("Alt");
        }

        // ---- SV18: module-scoped Translate All paging ----

        [Fact]
        public async Task Translate_all_pages_only_the_requested_module()
        {
            await _keys.InsertManyAsync(new[] { Key("a", "k1", "m1", ""), Key("b", "k2", "m2", ""), Key("c", "k3", "m2", "") });

            var module = (await KeyRepo().GetUilmResourceKeysWithPage(0, 10, "m2")).ToList();
            var all = (await KeyRepo().GetUilmResourceKeysWithPage(0, 10, null)).ToList();

            module.Select(k => k.ItemId).Should().BeEquivalentTo(new[] { "b", "c" });
            all.Should().HaveCount(3);
        }

        // ---- SV19: export file search ----

        [Theory]
        [InlineData("(", new[] { "report (1).json" })]
        [InlineData(".*", new[] { "a.*b.xlsx" })]
        [InlineData("REPORT", new[] { "report (1).json" })]
        public async Task Export_search_matches_the_text_literally_and_ignores_case(string searchText, string[] expected)
        {
            var files = _database.GetCollection<UilmExportedFile>("UilmExportedFiles");
            await files.InsertManyAsync(new[] { "report (1).json", "a.*b.xlsx", "plain.csv" }.Select(name =>
                new UilmExportedFile { FileId = Guid.NewGuid().ToString(), FileName = name, CreatedBy = "u" }));

            var result = await KeyRepo().GetUilmExportedFilesAsync(new GetUilmExportedFilesRequest { SearchText = searchText, PageSize = 10 });

            result.UilmExportedFiles.Select(f => f.FileName).Should().BeEquivalentTo(expected);
        }

        // ---- SV21: violations of deleted glossaries ----

        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public async Task Stale_violations_are_counted_and_removed_only_on_a_real_run(bool dryRun)
        {
            await _keys.InsertManyAsync(new[]
            {
                Key("a", "k1", "m1", "", violations: new List<KeyGlossaryViolation> { Violation("live"), Violation("gone"), Violation("gone", "fr-FR") }),
                Key("b", "k2", "m1", "", violations: new List<KeyGlossaryViolation> { Violation("live") })
            });

            var removed = await KeyRepo().RemoveStaleGlossaryViolationsAsync(new HashSet<string> { "live" }, dryRun, batchSize: 1);

            removed.Should().Be(2);
            var stored = await StoredAsync("k1", "m1");
            stored.GlossaryViolations!.Select(v => v.GlossaryId).Should().BeEquivalentTo(dryRun ? new[] { "live", "gone", "gone" } : new[] { "live" });
            (await StoredAsync("k2", "m1")).GlossaryViolations.Should().ContainSingle();
        }

        // ---- SV07: unique name index at runtime ----

        private async Task<bool> HasUniqueNameIndexAsync() =>
            (await (await _glossaries.Indexes.ListAsync()).ToListAsync())
                .Any(i => i["name"] == GlossaryRepository.NormalizedNameIndexName && i.GetValue("unique", false).ToBoolean());

        [Fact]
        public async Task The_unique_name_index_is_created_when_no_names_collide()
        {
            await _glossaries.InsertManyAsync(new[]
            {
                new BlocksGlossary { ItemId = "g1", Name = "Workspace", NormalizedName = "workspace" },
                new BlocksGlossary { ItemId = "g2", Name = "Settings", NormalizedName = "settings" }
            });
            var logger = new Mock<Microsoft.Extensions.Logging.ILogger>();

            var created = await GlossaryIndexInitializer.EnsureUniqueNameIndexAsync("t1", _glossaries, logger.Object);

            created.Should().BeTrue();
            (await HasUniqueNameIndexAsync()).Should().BeTrue();
            logger.VerifyLog(Microsoft.Extensions.Logging.LogLevel.Information, "Unique glossary name index created for tenant t1");
        }

        [Fact]
        public async Task An_empty_tenant_gets_the_unique_name_index()
        {
            (await GlossaryIndexInitializer.EnsureUniqueNameIndexAsync("t1", _glossaries, NullLogger.Instance)).Should().BeTrue();
            (await HasUniqueNameIndexAsync()).Should().BeTrue();
        }

        [Theory]
        [InlineData("workspace", "workspace")]
        [InlineData(null, null)]
        public async Task Duplicate_names_block_the_index_and_saves_keep_working(string? first, string? second)
        {
            await _glossaries.InsertManyAsync(new[]
            {
                new BlocksGlossary { ItemId = "g1", Name = "Workspace", NormalizedName = first! },
                new BlocksGlossary { ItemId = "g2", Name = "workspace", NormalizedName = second! }
            });
            var logger = new Mock<Microsoft.Extensions.Logging.ILogger>();

            var created = await GlossaryIndexInitializer.EnsureUniqueNameIndexAsync("t2", _glossaries, logger.Object);

            created.Should().BeFalse();
            (await HasUniqueNameIndexAsync()).Should().BeFalse();
            logger.VerifyLog(Microsoft.Extensions.Logging.LogLevel.Warning, "Unique glossary name index not created for tenant t2: 1 duplicate name groups");
            await _glossaries.InsertOneAsync(new BlocksGlossary { ItemId = "g3", Name = "WORKSPACE", NormalizedName = "workspace" });
        }

        [Fact]
        public async Task The_unique_name_check_runs_once_per_tenant_per_process()
        {
            var tenant = "once-" + Guid.NewGuid().ToString("N");
            await _glossaries.InsertManyAsync(new[]
            {
                new BlocksGlossary { ItemId = "g1", Name = "Workspace", NormalizedName = "workspace" },
                new BlocksGlossary { ItemId = "g2", Name = "workspace", NormalizedName = "workspace" }
            });

            var first = GlossaryIndexInitializer.EnsureUniqueNameIndexStarted(tenant, _glossaries, NullLogger.Instance);
            await first;
            await _glossaries.DeleteOneAsync(g => g.ItemId == "g2");
            var second = GlossaryIndexInitializer.EnsureUniqueNameIndexStarted(tenant, _glossaries, NullLogger.Instance);
            await second;

            second.Should().BeSameAs(first);
            (await HasUniqueNameIndexAsync()).Should().BeFalse("duplicates are not retried in the same process");
        }

        [Fact]
        public async Task A_glossary_request_starts_the_unique_name_index_in_the_background()
        {
            var tenant = "repo-" + Guid.NewGuid().ToString("N");
            var repo = new GlossaryRepository(_provider.Object, NullLogger<GlossaryRepository>.Instance);

            await repo.GetAllEntitiesAsync(tenant);
            await GlossaryIndexInitializer.EnsureUniqueNameIndexStarted(tenant, _glossaries, NullLogger.Instance);

            (await HasUniqueNameIndexAsync()).Should().BeTrue();
        }

        [Fact]
        public async Task A_tag_only_entry_for_a_key_deleted_after_the_read_is_stored_as_a_full_save()
        {
            await _keys.InsertOneAsync(Key("kept", "kept", "m1", "Alt", new List<string> { "g-old" }));
            var deleted = Key("gone-id", "gone", "m1", "Gelöscht", new List<string> { "g1" });

            var errors = await KeyRepo().BulkSaveKeysAsync(new List<KeyBulkSave>
            {
                new(Key("ignored", "kept", "m1", "ignored", new List<string> { "g1" }), true, false),
                new(deleted, true, false)
            });

            errors.Should().BeEmpty();
            (await StoredAsync("kept", "m1")).Resources.Single(r => r.Culture == "de-DE").Value.Should().Be("Alt");
            var recreated = await StoredAsync("gone", "m1");
            recreated.ItemId.Should().Be("gone-id");
            recreated.GlossaryIds.Should().Equal("g1");
        }

        [Fact]
        public async Task A_write_concern_error_still_reports_only_the_rejected_entries()
        {
            var collection = new Mock<IMongoCollection<BlocksLanguageKey>>();
            var database = new Mock<IMongoDatabase>();
            database.Setup(d => d.GetCollection<BlocksLanguageKey>(It.IsAny<string>(), null)).Returns(collection.Object);
            var provider = new Mock<IDbContextProvider>();
            provider.Setup(p => p.GetDatabase(It.IsAny<string>())).Returns(database.Object);
            var writeConcernError = (WriteConcernError)typeof(WriteConcernError)
                .GetConstructors(System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Public)
                .OrderByDescending(c => c.GetParameters().Length).First()
                .Invoke(typeof(WriteConcernError).GetConstructors(System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Public)
                    .OrderByDescending(c => c.GetParameters().Length).First().GetParameters()
                    .Select(p => p.ParameterType == typeof(int) ? 64 : p.ParameterType == typeof(string) ? "WriteConcernFailed"
                        : p.ParameterType == typeof(BsonDocument) ? new BsonDocument()
                        : p.ParameterType.IsAssignableFrom(typeof(string[])) ? Array.Empty<string>()
                        : p.ParameterType.IsValueType ? Activator.CreateInstance(p.ParameterType) : null).ToArray());
            var result = new BulkWriteResult<BlocksLanguageKey>.Acknowledged(3, 0, 0, 0, 0, new List<WriteModel<BlocksLanguageKey>>(), new List<BulkWriteUpsert>());
            var exception = new MongoBulkWriteException<BlocksLanguageKey>(
                new MongoDB.Driver.Core.Connections.ConnectionId(new MongoDB.Driver.Core.Servers.ServerId(new MongoDB.Driver.Core.Clusters.ClusterId(), new System.Net.DnsEndPoint("localhost", 27017))),
                result, new[] { MongoExceptionFactory.BulkError(1) }, writeConcernError, new List<WriteModel<BlocksLanguageKey>>());
            collection.Setup(c => c.BulkWriteAsync(It.IsAny<IEnumerable<WriteModel<BlocksLanguageKey>>>(), It.IsAny<BulkWriteOptions>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(exception);
            var logger = new Mock<Microsoft.Extensions.Logging.ILogger<KeyRepository>>();

            var errors = await new KeyRepository(provider.Object, logger.Object).BulkSaveKeysAsync(new List<KeyBulkSave>
            {
                new(Key("a", "k1", "m1", "x"), false, false),
                new(Key("b", "k2", "m1", "x"), false, false),
                new(Key("c", "k3", "m1", "x"), false, false)
            });

            errors.Should().ContainSingle().Which.Index.Should().Be(1);
            logger.VerifyLog(Microsoft.Extensions.Logging.LogLevel.Warning, "Bulk key save: write concern error 64 for a batch of 3 keys");
        }

    }
}
