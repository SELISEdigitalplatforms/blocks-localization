using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using Xunit;
using static XUnitTest.Terminology.TerminologyTestData;

namespace XUnitTest.Terminology
{
    public class GlossaryTerminologyResolverTests
    {
        [Fact]
        public void A_legacy_Track_A_document_resolves_from_the_JSON_with_the_marker_stripped_H1()
        {
            var glossary = Workspace("A container for projects. ⟦rule: de-DE→Arbeitsbereich⟧");

            var terminology = GlossaryTerminologyResolver.Resolve(glossary);

            terminology.Rule.Should().Be(GlossaryRule.Translate);
            terminology.Variants.Should().Equal("workspaces");
            terminology.Translations.Select(t => (t.Language, t.Value)).Should().Equal(("de-DE", "Arbeitsbereich"), ("fr-FR", "Espace de travail"));
            terminology.Translations[0].ForbiddenValues.Should().Equal("Werkbereich");
            terminology.Translations[1].ForbiddenValues.Should().Equal("Zone");
            terminology.Status.Should().Be(GlossaryStatus.Approved);
            terminology.Definition.Should().Be("A container for projects.");
            terminology.IsUnsupported.Should().BeFalse();
        }

        [Fact]
        public void A_legacy_document_keeps_its_stored_status()
        {
            var glossary = Workspace();
            glossary.Status = GlossaryStatus.Draft;

            GlossaryTerminologyResolver.Resolve(glossary).Status.Should().Be(GlossaryStatus.Draft);
        }

        [Fact]
        public void A_plain_note_resolves_to_defaults_and_keeps_the_note()
        {
            var terminology = GlossaryTerminologyResolver.Resolve(Glossary("g", "API", "Only in docs", "Definition"));

            terminology.Rule.Should().Be(GlossaryRule.Translate);
            terminology.CaseSensitive.Should().BeFalse();
            terminology.Variants.Should().BeEmpty();
            terminology.Translations.Should().BeEmpty();
            terminology.Note.Should().Be("Only in docs");
            terminology.Definition.Should().Be("Definition");
        }

        [Fact]
        public void Corrupt_JSON_resolves_to_defaults_C9()
        {
            var raw = GlossaryMetaParser.Prefix + "{broken";

            var terminology = GlossaryTerminologyResolver.Resolve(Glossary("g", "API", raw));

            terminology.Translations.Should().BeEmpty();
            terminology.IsUnsupported.Should().BeFalse();
            terminology.Note.Should().Be(raw);
        }

        [Fact]
        public void An_unsupported_version_is_flagged()
        {
            var terminology = GlossaryTerminologyResolver.Resolve(Glossary("g", "API", "@@glossary-meta:v2@@{}"));

            terminology.IsUnsupported.Should().BeTrue();
            terminology.Note.Should().BeNull();
        }

        [Fact]
        public void A_structured_document_uses_its_stored_fields_with_defaults()
        {
            var glossary = Glossary("g", "API", GlossaryMetaParser.Prefix + """{"rule":"keep"}""", "Definition ⟦rule: keep as-is in all languages⟧");
            glossary.SchemaVersion = 2;
            glossary.Translations = new List<GlossaryTranslation> { new() { Language = "de-DE", Value = "Schnittstelle" } };

            var terminology = GlossaryTerminologyResolver.Resolve(glossary);

            // The stored fields win over the JSON (which a Track A save may have left behind).
            terminology.Rule.Should().Be(GlossaryRule.Translate);
            terminology.CaseSensitive.Should().BeFalse();
            terminology.Variants.Should().BeEmpty();
            terminology.Translations.Single().Value.Should().Be("Schnittstelle");
            terminology.Status.Should().Be(GlossaryStatus.Approved);
            terminology.Definition.Should().Be("Definition");
        }

        [Fact]
        public void A_migrated_document_reads_its_structured_fields()
        {
            var glossary = Glossary("g", "SELISE", "Brand", "Company name.");
            glossary.SchemaVersion = 2;
            glossary.Rule = GlossaryRule.Keep;
            glossary.CaseSensitive = true;
            glossary.Variants = new List<string> { "Selise" };
            glossary.Status = GlossaryStatus.Deprecated;

            var terminology = GlossaryTerminologyResolver.Resolve(glossary);

            terminology.Rule.Should().Be(GlossaryRule.Keep);
            terminology.CaseSensitive.Should().BeTrue();
            terminology.Variants.Should().Equal("Selise");
            terminology.Status.Should().Be(GlossaryStatus.Deprecated);
            terminology.Note.Should().Be("Brand");
        }

        [Fact]
        public void Keep_keeps_inactive_values_but_none_is_active_C20_Example_8()
        {
            var glossary = Glossary("g7", "SELISE", Meta(new Dictionary<string, object>
            {
                ["rule"] = "keep",
                ["translations"] = Map(("de-DE", "Selise GmbH")),
                ["forbidden"] = new Dictionary<string, string[]> { ["de-DE"] = new[] { "Selis" } }
            }));

            var terminology = GlossaryTerminologyResolver.Resolve(glossary);

            terminology.Translations.Single().Value.Should().Be("Selise GmbH");
            terminology.Translations.Single().ForbiddenValues.Should().Equal("Selis");
            terminology.ActiveTranslation("de-DE").Should().BeNull();
            terminology.ActiveForbidden("de-DE").Should().BeEmpty();
            terminology.ActiveTranslations().Should().BeEmpty();
        }

        [Fact]
        public void Forbidden_keeps_translations_inactive_and_forbidden_values_active_C20()
        {
            var glossary = Glossary("g", "Werk", Meta(new Dictionary<string, object>
            {
                ["rule"] = "forbidden",
                ["translations"] = Map(("de-DE", "Arbeit")),
                ["forbidden"] = new Dictionary<string, string[]> { ["de-DE"] = new[] { "Werkstück" } }
            }));

            var terminology = GlossaryTerminologyResolver.Resolve(glossary);

            terminology.ActiveTranslation("de-DE").Should().BeNull();
            terminology.ActiveForbidden("de-DE").Should().Equal("Werkstück");
            var active = terminology.ActiveTranslations().Single();
            active.Value.Should().Be("");
            active.ForbiddenValues.Should().Equal("Werkstück");
        }

        [Fact]
        public void A_culture_with_only_forbidden_values_gets_its_own_entry()
        {
            var meta = GlossaryMetaParser.Parse(Meta(new Dictionary<string, object>
            {
                ["translations"] = Map(("de-DE", "a")),
                ["forbidden"] = new Dictionary<string, string[]> { ["fr-FR"] = new[] { "b" }, ["de-DE"] = new[] { "c" } }
            })).Meta;

            var translations = GlossaryTerminologyResolver.ToTranslations(meta);

            translations.Select(t => $"{t.Language}:{t.Value}:{string.Join(",", t.ForbiddenValues)}")
                .Should().Equal("de-DE:a:c", "fr-FR::b");
        }
    }
}
