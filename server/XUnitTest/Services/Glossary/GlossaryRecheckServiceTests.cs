using Blocks.Genesis;
using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using Eurolm.DomainService.Shared.Events;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace XUnitTest.Services.Glossary
{
    public class GlossaryRecheckServiceTests
    {
        private readonly Mock<IGlossaryRecheckJobRepository> _jobs = new();
        private readonly Mock<IGlossaryRepository> _glossaryRepository = new();
        private readonly Mock<IKeyRepository> _keyRepository = new();
        private readonly Mock<IMessageClient> _messageClient = new();
        private readonly List<BlocksGlossary> _glossaries = new();
        private readonly List<ConsumerMessage<RecheckGlossaryViolationsEvent>> _published = new();
        private readonly List<IReadOnlyList<(string KeyId, List<KeyGlossaryViolation> Violations)>> _writes = new();
        private int _matcherBuilds;

        public GlossaryRecheckServiceTests()
        {
            XUnitTest.Shared.TestBlocksContext.Set("recheck-tenant");
            _messageClient.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<RecheckGlossaryViolationsEvent>>()))
                .Callback<ConsumerMessage<RecheckGlossaryViolationsEvent>>(_published.Add)
                .Returns(Task.CompletedTask);
            _keyRepository.Setup(r => r.GetLanguageSettingAsync("recheck-tenant"))
                .ReturnsAsync(new BlocksLanguage { LanguageCode = "en-US", IsDefault = true });
            _keyRepository.Setup(r => r.SetGlossaryViolationsManyAsync(It.IsAny<IReadOnlyList<(string, List<KeyGlossaryViolation>)>>()))
                .Callback<IReadOnlyList<(string KeyId, List<KeyGlossaryViolation> Violations)>>(u => _writes.Add(u.ToList()))
                .ReturnsAsync(1);
            _glossaryRepository.Setup(r => r.GetStoredByIdsAsync(It.IsAny<IEnumerable<string>>()))
                .ReturnsAsync((IEnumerable<string> ids) => _glossaries.Where(g => ids.Contains(g.ItemId)).ToList());
        }

        private GlossaryRecheckService NewService(bool enabled = true) => new(
            _jobs.Object,
            _glossaryRepository.Object,
            _keyRepository.Object,
            new GlossaryMatcherCache(_ => { _matcherBuilds++; return Task.FromResult(_glossaries.ToList()); }),
            _messageClient.Object,
            new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { [GlossaryEnforcement.EnabledKey] = enabled ? "true" : "false" })
                .Build(),
            new Mock<ILogger<GlossaryRecheckService>>().Object);

        private void SetupEnqueue(bool created) =>
            _jobs.Setup(j => j.TryEnqueueAsync("recheck-tenant", It.IsAny<IReadOnlyCollection<string>?>(), It.IsAny<DateTime>(), GlossaryRecheckService.StaleAfter))
                .ReturnsAsync(created);

        private static BlocksGlossary Term(string id, string name, bool isGlobal = true, List<string>? modules = null) => new()
        {
            ItemId = id,
            Name = name,
            IsGlobal = isGlobal,
            ModuleIds = modules,
            SchemaVersion = 2,
            Status = GlossaryStatus.Approved,
            Rule = GlossaryRule.Translate,
            Translations = new List<GlossaryTranslation>
            {
                new() { Language = "de-DE", Value = "Arbeitsbereich", ForbiddenValues = new List<string> { "Werkbereich" } }
            }
        };

        private static BlocksLanguageKey Key(string id, string source, string? german, List<KeyGlossaryViolation>? stored = null) => new()
        {
            ItemId = id,
            ModuleId = "m1",
            Resources = german == null
                ? new[] { new Resource { Culture = "en-US", Value = source } }
                : new[] { new Resource { Culture = "en-US", Value = source }, new Resource { Culture = "de-DE", Value = german } },
            GlossaryViolations = stored
        };

        private void SetupKeys(params List<BlocksLanguageKey>[] pages)
        {
            var queue = new Queue<List<BlocksLanguageKey>>(pages);
            _keyRepository.Setup(r => r.GetKeysForGlossaryRecheckAsync(It.IsAny<GlossaryRecheckKeyScope?>(), It.IsAny<string?>(), GlossaryRecheckService.PageSize))
                .ReturnsAsync(() => queue.Count > 0 ? queue.Dequeue() : new List<BlocksLanguageKey>());
        }

        #region Queue and trigger

        [Fact]
        public async Task Queue_with_the_flag_on_creates_the_marker_and_publishes_the_event()
        {
            SetupEnqueue(created: true);

            var queued = await NewService().QueueAsync("g1");

            queued.Should().BeTrue();
            _jobs.Verify(j => j.TryEnqueueAsync("recheck-tenant", It.Is<IReadOnlyCollection<string>?>(ids => ids!.SequenceEqual(new[] { "g1" })),
                It.IsAny<DateTime>(), GlossaryRecheckService.StaleAfter), Times.Once);
            _published.Should().ContainSingle();
            _published[0].ConsumerName.Should().Be(Eurolm.DomainService.Utilities.Constants.UilmQueue);
            _published[0].Payload.Should().BeEquivalentTo(new RecheckGlossaryViolationsEvent { ProjectKey = "recheck-tenant", GlossaryId = "g1" });
        }

        [Fact]
        public async Task Queue_without_an_item_id_asks_for_the_whole_project()
        {
            SetupEnqueue(created: true);

            await NewService().QueueAsync(null);

            _jobs.Verify(j => j.TryEnqueueAsync("recheck-tenant", null, It.IsAny<DateTime>(), It.IsAny<TimeSpan>()), Times.Once);
            _published.Single().Payload.GlossaryId.Should().BeNull();
        }

        [Fact]
        public async Task Queue_while_a_job_is_queued_is_coalesced_C12()
        {
            SetupEnqueue(created: false);

            var queued = await NewService().QueueAsync("g1");

            queued.Should().BeFalse();
            _published.Should().BeEmpty();
        }

        [Fact]
        public async Task Queue_with_the_flag_off_returns_false_and_writes_nothing_C13()
        {
            var queued = await NewService(enabled: false).QueueAsync("g1");

            queued.Should().BeFalse();
            _jobs.VerifyNoOtherCalls();
            _published.Should().BeEmpty();
        }

        [Fact]
        public async Task Trigger_with_the_flag_off_queues_nothing_C13()
        {
            await NewService(enabled: false).TriggerAsync(new[] { "g1" });

            _jobs.VerifyNoOtherCalls();
            _published.Should().BeEmpty();
        }

        [Fact]
        public async Task Trigger_merges_several_glossaries_into_one_job()
        {
            SetupEnqueue(created: true);

            await NewService().TriggerAsync(new[] { "g1", "g2", "g1" });

            _jobs.Verify(j => j.TryEnqueueAsync("recheck-tenant", It.Is<IReadOnlyCollection<string>?>(ids => ids!.SequenceEqual(new[] { "g1", "g2" })),
                It.IsAny<DateTime>(), It.IsAny<TimeSpan>()), Times.Once);
            _published.Single().Payload.GlossaryId.Should().BeNull("the marker holds the scope of a multi-glossary job");
        }

        [Fact]
        public async Task Trigger_never_throws_and_a_failed_publish_releases_the_marker()
        {
            SetupEnqueue(created: true);
            _messageClient.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<RecheckGlossaryViolationsEvent>>()))
                .ThrowsAsync(new InvalidOperationException("bus down"));

            var act = () => NewService().TriggerAsync(new[] { "g1" });

            await act.Should().NotThrowAsync();
            _jobs.Verify(j => j.ReleaseAsync("recheck-tenant"), Times.Once);
        }

        #endregion

        #region Recheck run

        [Fact]
        public async Task Recheck_recomputes_and_sets_only_changed_violations_H29()
        {
            _glossaries.Add(Term("g1", "Workspace"));
            _jobs.Setup(j => j.ClaimAsync("recheck-tenant")).ReturnsAsync(new GlossaryRecheckJob { GlossaryIds = new() { "g1" } });
            var staleViolation = new KeyGlossaryViolation { Culture = "de-DE", GlossaryId = "g1", Term = "Workspace", Kind = "forbidden-used", Found = "Werkbereich" };
            SetupKeys(new List<BlocksLanguageKey>
            {
                Key("k-fixed", "Open your Workspace", "Öffne deinen Arbeitsbereich", new() { staleViolation }),
                Key("k-broken", "Open your Workspace", "Öffne deinen Werkbereich"),
                Key("k-clean", "Open your Workspace", "Öffne deinen Arbeitsbereich")
            });

            var result = await NewService().RecheckAsync(new RecheckGlossaryViolationsEvent { ProjectKey = "recheck-tenant", GlossaryId = "g1" });

            result.Should().BeEquivalentTo(new GlossaryRecheckResult { Ran = true, Checked = 3, Updated = 2, Failed = 0 });
            var written = _writes.Single().ToDictionary(w => w.KeyId, w => w.Violations);
            written.Keys.Should().BeEquivalentTo(new[] { "k-fixed", "k-broken" });
            written["k-fixed"].Should().BeEmpty();
            written["k-broken"].Should().Contain(v => v.GlossaryId == "g1" && v.Culture == "de-DE");
        }

        [Fact]
        public async Task Recheck_writes_only_violations_and_never_calls_the_AI()
        {
            // The service has no assistant dependency at all; the only key write is the violations bulk $set.
            typeof(GlossaryRecheckService).GetConstructors().Single().GetParameters()
                .Should().NotContain(p => p.ParameterType == typeof(IAssistantService));
            _glossaries.Add(Term("g1", "Workspace"));
            SetupKeys(new List<BlocksLanguageKey> { Key("k1", "Open your Workspace", "Werkbereich") });

            await NewService().RecheckAsync(new RecheckGlossaryViolationsEvent { ProjectKey = "recheck-tenant" });

            _keyRepository.Verify(r => r.SetGlossaryViolationsManyAsync(It.IsAny<IReadOnlyList<(string, List<KeyGlossaryViolation>)>>()), Times.Once);
            _keyRepository.Verify(r => r.UpdateUilmResourceKeysForChangeAll(It.IsAny<List<BlocksLanguageKey>>()), Times.Never);
            _keyRepository.Verify(r => r.SaveKeyAsync(It.IsAny<BlocksLanguageKey>()), Times.Never);
            _keyRepository.Verify(r => r.SetGlossaryViolationsAsync(It.IsAny<string>(), It.IsAny<List<KeyGlossaryViolation>>()), Times.Never);
        }

        [Fact]
        public async Task Recheck_continues_past_a_failing_key_and_keeps_its_violations_C14()
        {
            _glossaries.Add(Term("g1", "Workspace"));
            var broken = Key("k-bad", "Open your Workspace", "Werkbereich");
            broken.Resources = new[] { null!, new Resource { Culture = "en-US", Value = "Workspace" } };
            SetupKeys(new List<BlocksLanguageKey> { broken, Key("k-ok", "Open your Workspace", "Werkbereich") });

            var result = await NewService().RecheckAsync(new RecheckGlossaryViolationsEvent { ProjectKey = "recheck-tenant" });

            result.Failed.Should().Be(1);
            result.Checked.Should().Be(2);
            _writes.Single().Select(w => w.KeyId).Should().Equal("k-ok");
        }

        [Fact]
        public async Task Recheck_pages_by_item_id_in_pages_of_1000()
        {
            _glossaries.Add(Term("g1", "Workspace"));
            var firstPage = Enumerable.Range(0, GlossaryRecheckService.PageSize).Select(i => Key($"k{i:D4}", "Hello", null)).ToList();
            SetupKeys(firstPage, new List<BlocksLanguageKey> { Key("k9999", "Hello", null) });

            var result = await NewService().RecheckAsync(new RecheckGlossaryViolationsEvent { ProjectKey = "recheck-tenant" });

            result.Checked.Should().Be(GlossaryRecheckService.PageSize + 1);
            _keyRepository.Verify(r => r.GetKeysForGlossaryRecheckAsync(null, null, GlossaryRecheckService.PageSize), Times.Once);
            _keyRepository.Verify(r => r.GetKeysForGlossaryRecheckAsync(null, "k0999", GlossaryRecheckService.PageSize), Times.Once);
        }

        [Fact]
        public async Task Recheck_scope_is_tagged_keys_modules_and_stored_violations_of_a_module_glossary()
        {
            _glossaries.Add(Term("g1", "Workspace", isGlobal: false, modules: new List<string> { "m1", "m2" }));
            _jobs.Setup(j => j.ClaimAsync("recheck-tenant")).ReturnsAsync(new GlossaryRecheckJob { GlossaryIds = new() { "g1", "g-deleted" } });
            GlossaryRecheckKeyScope? scope = null;
            _keyRepository.Setup(r => r.GetKeysForGlossaryRecheckAsync(It.IsAny<GlossaryRecheckKeyScope?>(), It.IsAny<string?>(), It.IsAny<int>()))
                .Callback<GlossaryRecheckKeyScope?, string?, int>((s, _, _) => scope = s)
                .ReturnsAsync(new List<BlocksLanguageKey>());

            await NewService().RecheckAsync(new RecheckGlossaryViolationsEvent { ProjectKey = "recheck-tenant", GlossaryId = "g1" });

            scope.Should().NotBeNull();
            scope!.GlossaryIds.Should().BeEquivalentTo(new[] { "g1", "g-deleted" });
            scope.ModuleIds.Should().BeEquivalentTo(new[] { "m1", "m2" });
        }

        [Theory]
        [InlineData(true, false)]
        [InlineData(false, true)]
        public async Task Recheck_checks_every_key_for_a_global_glossary_or_a_whole_project_job(bool globalGlossary, bool wholeProjectJob)
        {
            _glossaries.Add(Term("g1", "Workspace", isGlobal: globalGlossary));
            _jobs.Setup(j => j.ClaimAsync("recheck-tenant")).ReturnsAsync(new GlossaryRecheckJob { WholeProject = wholeProjectJob, GlossaryIds = new() { "g1" } });
            SetupKeys();

            await NewService().RecheckAsync(new RecheckGlossaryViolationsEvent { ProjectKey = "recheck-tenant", GlossaryId = "g1" });

            _keyRepository.Verify(r => r.GetKeysForGlossaryRecheckAsync(null, null, It.IsAny<int>()), Times.Once);
        }

        [Fact]
        public async Task Recheck_claims_the_marker_and_rebuilds_the_matcher()
        {
            _glossaries.Add(Term("g1", "Workspace"));
            SetupKeys();
            var service = NewService();

            await service.RecheckAsync(new RecheckGlossaryViolationsEvent { ProjectKey = "recheck-tenant" });
            await service.RecheckAsync(new RecheckGlossaryViolationsEvent { ProjectKey = "recheck-tenant" });

            _jobs.Verify(j => j.ClaimAsync("recheck-tenant"), Times.Exactly(2));
            _matcherBuilds.Should().Be(2, "another process saved the glossary, so a cached matcher may be stale");
        }

        [Fact]
        public async Task Recheck_with_the_flag_off_touches_no_key()
        {
            var result = await NewService(enabled: false).RecheckAsync(new RecheckGlossaryViolationsEvent { ProjectKey = "recheck-tenant" });

            result.Ran.Should().BeFalse();
            _keyRepository.Verify(r => r.GetKeysForGlossaryRecheckAsync(It.IsAny<GlossaryRecheckKeyScope?>(), It.IsAny<string?>(), It.IsAny<int>()), Times.Never);
            _writes.Should().BeEmpty();
        }

        [Fact]
        public void KeepDetectedAt_returns_null_when_unchanged_and_keeps_old_timestamps()
        {
            var old = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            KeyGlossaryViolation V(string kind, DateTime at) => new() { Culture = "de-DE", GlossaryId = "g1", Term = "W", Kind = kind, DetectedAt = at };

            GlossaryRecheckService.KeepDetectedAt(new() { V("a", old) }, new() { V("a", DateTime.UtcNow) }).Should().BeNull();

            var merged = GlossaryRecheckService.KeepDetectedAt(new() { V("a", old) }, new() { V("a", DateTime.UtcNow), V("b", DateTime.UtcNow) });
            merged!.Single(v => v.Kind == "a").DetectedAt.Should().Be(old);
            merged.Single(v => v.Kind == "b").DetectedAt.Should().NotBe(old);

            GlossaryRecheckService.KeepDetectedAt(null, new()).Should().BeNull();
        }

        #endregion
    }
}
