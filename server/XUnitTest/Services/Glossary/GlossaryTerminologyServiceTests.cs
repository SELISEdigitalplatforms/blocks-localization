using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;
using KeyModel = Eurolm.DomainService.Services.Key;

namespace XUnitTest
{
    public class GlossaryTerminologyServiceTests
    {
        private readonly Mock<IKeyRepository> _keyRepository = new();
        private readonly List<BlocksGlossary> _glossaries = new();
        private readonly List<string> _loadedTenants = new();

        public GlossaryTerminologyServiceTests()
        {
            XUnitTest.Shared.TestBlocksContext.Set("terminology-tenant");
            _keyRepository.Setup(r => r.GetLanguageSettingAsync(It.IsAny<string>()))
                .ReturnsAsync(new BlocksLanguage { LanguageCode = "en-US", IsDefault = true });
        }

        private GlossaryTerminologyService NewService(bool enabled) => new(
            new GlossaryMatcherCache(tenant => { _loadedTenants.Add(tenant); return Task.FromResult(_glossaries.ToList()); }),
            _keyRepository.Object,
            new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { [GlossaryEnforcement.EnabledKey] = enabled ? "true" : "false" })
                .Build());

        private static BlocksGlossary Term(string id, string name, GlossaryStatus status = GlossaryStatus.Approved,
            bool isGlobal = false, List<string>? moduleIds = null, GlossaryRule rule = GlossaryRule.Translate) => new()
        {
            ItemId = id,
            Name = name,
            IsGlobal = isGlobal,
            ModuleIds = moduleIds,
            SchemaVersion = 2,
            Status = status,
            Rule = rule,
            Context = "Definition of " + name,
            Translations = new List<GlossaryTranslation>
            {
                new() { Language = "de-DE", Value = name + "-de", ForbiddenValues = new List<string> { "bad-" + name } }
            }
        };

        [Fact]
        public async Task Match_resolves_key_scope_from_keyId_in_the_context_tenant()
        {
            _glossaries.Add(Term("g-key", "Workspace"));
            _glossaries.Add(Term("g-module", "Portal", moduleIds: new List<string> { "m1" }));
            _keyRepository.Setup(r => r.GetByIdAsync("k1"))
                .ReturnsAsync(new KeyModel { ItemId = "k1", GlossaryIds = new List<string> { "g-key" }, ModuleId = "m1" });

            var response = await NewService(false).MatchAsync(new MatchGlossaryRequest
            {
                Text = "Open your Workspace and Portal",
                Language = "en-US",
                KeyId = "k1"
            });

            response.Matches.Select(m => (m.GlossaryId, m.Scope, m.Start, m.Length)).Should().BeEquivalentTo(new[]
            {
                ("g-key", "key", 10, 9),
                ("g-module", "module", 24, 6)
            });
            _loadedTenants.Should().Equal("terminology-tenant");
        }

        [Fact]
        public async Task Match_returns_draft_terms_and_only_active_translations()
        {
            _glossaries.Add(Term("g-draft", "Workspace", GlossaryStatus.Draft, isGlobal: true));
            _glossaries.Add(Term("g-keep", "SELISE", isGlobal: true, rule: GlossaryRule.Keep));
            _glossaries.Add(Term("g-old", "Portal", GlossaryStatus.Deprecated, isGlobal: true));

            var response = await NewService(false).MatchAsync(new MatchGlossaryRequest { Text = "SELISE Workspace Portal", Language = "en-US" });

            response.Matches.Should().HaveCount(2);
            var draft = response.Matches.Single(m => m.GlossaryId == "g-draft");
            draft.Status.Should().Be("draft");
            draft.Rule.Should().Be("translate");
            draft.Translations.Should().ContainSingle().Which.Value.Should().Be("Workspace-de");
            draft.Definition.Should().Be("Definition of Workspace");
            var keep = response.Matches.Single(m => m.GlossaryId == "g-keep");
            keep.Rule.Should().Be("keep");
            keep.Translations.Should().BeEmpty("Keep terms have no active translations (A10)");
        }

        [Fact]
        public async Task Match_in_all_mode_returns_other_terms_as_other()
        {
            _glossaries.Add(Term("g-other", "Workspace"));

            var applicable = await NewService(false).MatchAsync(new MatchGlossaryRequest { Text = "Workspace", Language = "en-US" });
            var all = await NewService(false).MatchAsync(new MatchGlossaryRequest { Text = "Workspace", Language = "en-US", Mode = "all" });

            applicable.Matches.Should().BeEmpty();
            all.Matches.Should().ContainSingle().Which.Scope.Should().Be("other");
        }

        [Fact]
        public async Task ComputeKeyViolations_is_null_with_the_flag_off()
        {
            _glossaries.Add(Term("g1", "Workspace", isGlobal: true));

            var violations = await NewService(false).ComputeKeyViolationsAsync(new BlocksLanguageKey
            {
                Resources = new[] { new Resource { Culture = "en-US", Value = "Workspace" }, new Resource { Culture = "de-DE", Value = "Werk" } }
            });

            violations.Should().BeNull();
            _loadedTenants.Should().BeEmpty();
        }

        [Fact]
        public async Task ComputeKeyViolations_checks_every_non_default_culture_with_a_value()
        {
            _glossaries.Add(Term("g1", "Workspace", isGlobal: true));

            var violations = await NewService(true).ComputeKeyViolationsAsync(new BlocksLanguageKey
            {
                ModuleId = "m1",
                Resources = new[]
                {
                    new Resource { Culture = "en-US", Value = "Open your Workspace" },
                    new Resource { Culture = "de-DE", Value = "Öffnen Sie Ihren bad-Workspace" },
                    new Resource { Culture = "fr-FR", Value = "" }
                }
            });

            violations.Should().NotBeNull();
            violations!.Should().OnlyContain(v => v.Culture == "de-DE" && v.GlossaryId == "g1");
            violations.Select(v => v.Kind).Should().BeEquivalentTo(new[] { GlossaryViolationKinds.MissingTranslation, GlossaryViolationKinds.ForbiddenUsed });
        }

        [Fact]
        public async Task ComputeKeyViolations_ignores_draft_terms()
        {
            _glossaries.Add(Term("g1", "Workspace", GlossaryStatus.Draft, isGlobal: true));

            var violations = await NewService(true).ComputeKeyViolationsAsync(new BlocksLanguageKey
            {
                Resources = new[] { new Resource { Culture = "en-US", Value = "Open your Workspace" }, new Resource { Culture = "de-DE", Value = "Öffnen" } }
            });

            violations.Should().BeEmpty();
        }
    }
}
