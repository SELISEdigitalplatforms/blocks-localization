using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using Xunit;
using static XUnitTest.Terminology.TerminologyTestData;

namespace XUnitTest.Terminology
{
    /// <summary>
    /// Ported from the Phase 2 client tests utils/glossary-meta.test.ts (parseGlossaryMeta); the expected
    /// results are identical (C19, C9).
    /// </summary>
    public class GlossaryMetaParserTests
    {
        private const string Prefix = "@@glossary-meta:v1@@";

        private static void ShouldBeDefaults(GlossaryMeta meta)
        {
            meta.Rule.Should().Be(GlossaryRule.Translate);
            meta.CaseSensitive.Should().BeFalse();
            meta.Variants.Should().BeEmpty();
            meta.Translations.Should().BeEmpty();
            meta.Forbidden.Should().BeEmpty();
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void Empty_or_missing_note_returns_defaults(string? value)
        {
            var parsed = GlossaryMetaParser.Parse(value);

            parsed.Status.Should().Be(GlossaryMetaStatus.Plain);
            parsed.Raw.Should().Be("");
            ShouldBeDefaults(parsed.Meta);
            parsed.Meta.Note.Should().BeNull();
        }

        [Fact]
        public void Plain_text_note_is_kept_unchanged_Example_1()
        {
            var parsed = GlossaryMetaParser.Parse("Use in onboarding only");

            parsed.Status.Should().Be(GlossaryMetaStatus.Plain);
            parsed.Meta.Rule.Should().Be(GlossaryRule.Translate);
            parsed.Meta.Note.Should().Be("Use in onboarding only");
        }

        [Fact]
        public void Structured_data_is_read()
        {
            var parsed = GlossaryMetaParser.Parse(Prefix + """{"rule":"keep","caseSensitive":true,"variants":["SELISE AG"],"note":"x"}""");

            parsed.Status.Should().Be(GlossaryMetaStatus.Structured);
            parsed.Meta.Rule.Should().Be(GlossaryRule.Keep);
            parsed.Meta.CaseSensitive.Should().BeTrue();
            parsed.Meta.Variants.Should().Equal("SELISE AG");
            parsed.Meta.Translations.Should().BeEmpty();
            parsed.Meta.Forbidden.Should().BeEmpty();
            parsed.Meta.Note.Should().Be("x");
        }

        [Fact]
        public void Each_field_falls_back_when_its_type_is_wrong()
        {
            var parsed = GlossaryMetaParser.Parse(Prefix + """{"rule":"other","caseSensitive":"yes","variants":"a","translations":[1],"forbidden":{"de-DE":"x"},"note":5}""");

            parsed.Status.Should().Be(GlossaryMetaStatus.Structured);
            ShouldBeDefaults(parsed.Meta);
            parsed.Meta.Note.Should().BeNull();
        }

        [Fact]
        public void Non_string_and_empty_items_are_dropped()
        {
            var parsed = GlossaryMetaParser.Parse(Prefix + """{"variants":["a",1," ",null,"b"],"translations":{"de-DE":" ","fr-FR":"x"},"forbidden":{"de-DE":["",2,"y"],"fr-FR":[]}}""");

            parsed.Meta.Variants.Should().Equal("a", "b");
            parsed.Meta.Translations.Select(t => $"{t.Key}={t.Value}").Should().Equal("fr-FR=x");
            parsed.Meta.Forbidden.Should().ContainSingle();
            parsed.Meta.Forbidden[0].Key.Should().Be("de-DE");
            parsed.Meta.Forbidden[0].Value.Should().Equal("y");
        }

        [Fact]
        public void Culture_codes_not_in_the_project_are_kept_Example_6()
        {
            var parsed = GlossaryMetaParser.Parse(Prefix + """{"rule":"translate","translations":{"it-IT":"x"}}""");

            parsed.Meta.Translations.Select(t => $"{t.Key}={t.Value}").Should().Equal("it-IT=x");
        }

        [Fact]
        public void Corrupt_JSON_keeps_the_full_raw_string_as_the_note_Example_4()
        {
            var raw = Prefix + "{broken";

            var parsed = GlossaryMetaParser.Parse(raw);

            parsed.Status.Should().Be(GlossaryMetaStatus.Corrupt);
            parsed.Meta.Note.Should().Be(raw);
            parsed.Raw.Should().Be(raw);
            ShouldBeDefaults(parsed.Meta);
        }

        [Theory]
        [InlineData("[]")]
        [InlineData("null")]
        [InlineData("5")]
        [InlineData("\"text\"")]
        public void A_JSON_value_that_is_not_an_object_is_corrupt(string json)
        {
            GlossaryMetaParser.Parse(Prefix + json).Status.Should().Be(GlossaryMetaStatus.Corrupt);
        }

        [Theory]
        [InlineData("@@glossary-meta:v2@@{}")]
        [InlineData("@@glossary-meta:v01@@{}")]
        public void An_unsupported_version_returns_defaults_without_a_note_Example_5(string raw)
        {
            var parsed = GlossaryMetaParser.Parse(raw);

            parsed.Status.Should().Be(GlossaryMetaStatus.UnsupportedVersion);
            ShouldBeDefaults(parsed.Meta);
            parsed.Meta.Note.Should().BeNull();
        }

        [Fact]
        public void The_serialized_Example_2_string_parses_in_key_order()
        {
            var parsed = GlossaryMetaParser.Parse(Prefix + """{"rule":"translate","translations":{"de-DE":"Arbeitsbereich","fr-FR":"Espace de travail"},"forbidden":{"de-DE":["Werkbereich"]}}""");

            parsed.Status.Should().Be(GlossaryMetaStatus.Structured);
            parsed.Meta.Translations.Select(t => t.Key).Should().Equal("de-DE", "fr-FR");
            parsed.Meta.Translations.Select(t => t.Value).Should().Equal("Arbeitsbereich", "Espace de travail");
            parsed.Meta.Forbidden.Single().Value.Should().Equal("Werkbereich");
        }

        [Fact]
        public void The_round_trip_fixture_with_a_multi_line_note_parses_as_the_client_does()
        {
            var parsed = GlossaryMetaParser.Parse(Prefix + """{"rule":"translate","variants":["workspaces","Workspace's"],"translations":{"de-DE":"Arbeitsbereich","it-IT":"Area di lavoro"},"forbidden":{"de-DE":["Werkbereich","Arbeitsraum"]},"note":"multi\nline \"note\""}""");

            parsed.Meta.Variants.Should().Equal("workspaces", "Workspace's");
            parsed.Meta.Translations.Select(t => t.Key).Should().Equal("de-DE", "it-IT");
            parsed.Meta.Forbidden.Single().Value.Should().Equal("Werkbereich", "Arbeitsraum");
            parsed.Meta.Note.Should().Be("multi" + (char)10 + "line \"note\"");
        }

        [Fact]
        public void Characters_the_marker_strips_are_kept_in_the_JSON()
        {
            var parsed = GlossaryMetaParser.Parse(Meta(new { translations = new Dictionary<string, string> { ["de-DE"] = "A;B→\"C\"⟦x⟧" } }));

            parsed.Meta.Translations.Single().Value.Should().Be("A;B→\"C\"⟦x⟧");
        }

        [Fact]
        public void Only_ASCII_digits_form_a_version_as_in_JavaScript()
        {
            var raw = "@@glossary-meta:v" + U(0x0661) + "@@{}";

            var parsed = GlossaryMetaParser.Parse(raw);

            parsed.Status.Should().Be(GlossaryMetaStatus.Plain);
            parsed.Meta.Note.Should().Be(raw);
        }

        [Fact]
        public void Values_are_trimmed_with_JavaScript_whitespace()
        {
            // JS trim removes U+FEFF and keeps U+0085, unlike .NET Trim.
            var parsed = GlossaryMetaParser.Parse(Meta(new
            {
                variants = new[] { U(0xFEFF) + "a" + U(0x3000), U(0x0085) + "b" }
            }));

            parsed.Meta.Variants.Should().Equal("a", U(0x0085) + "b");
        }

        [Fact]
        public void A_repeated_key_takes_the_last_value_as_in_JSON_parse()
        {
            var parsed = GlossaryMetaParser.Parse(Prefix + """{"rule":"keep","rule":"forbidden","translations":{"de-DE":"a","fr-FR":"b","de-DE":"c"}}""");

            parsed.Meta.Rule.Should().Be(GlossaryRule.Forbidden);
            parsed.Meta.Translations.Select(t => $"{t.Key}={t.Value}").Should().Equal("de-DE=c", "fr-FR=b");
        }
    }

    /// <summary>Ported from the Phase 2 client tests utils/glossary-rule-marker.test.ts (stripRuleMarker) (C19).</summary>
    public class RuleMarkerTests
    {
        [Theory]
        [InlineData("Definition ⟦rule: de-DE→x⟧ ", "Definition")]
        [InlineData("⟦rule: keep as-is in all languages⟧", "")]
        [InlineData(" Plain ", "Plain")]
        [InlineData(null, "")]
        [InlineData("⟦rule: x⟧ in the middle", "⟦rule: x⟧ in the middle")]
        [InlineData("Definition ⟦rule: de-DE→old⟧", "Definition")]
        [InlineData("a ⟧", "a ⟧")]
        [InlineData("x ⟦rule: a⟧ y ⟦rule: b⟧", "x ⟦rule: a⟧ y")]
        [InlineData("x ⟦rule: a⟧⟦rule: b⟧", "x ⟦rule: a⟧")]
        [InlineData("Definition ⟦other: a⟧", "Definition ⟦other: a⟧")]
        public void Strip_removes_one_trailing_marker_and_trims(string? context, string expected)
        {
            RuleMarker.Strip(context).Should().Be(expected);
        }

        [Theory]
        [InlineData("Definition ⟦rule: de-DE→x⟧ ", true)]
        [InlineData("⟦rule: keep as-is in all languages⟧", true)]
        [InlineData("⟦rule: x⟧ in the middle", false)]
        [InlineData("Plain", false)]
        [InlineData(null, false)]
        public void HasTrailingMarker_agrees_with_Strip(string? context, bool expected)
        {
            RuleMarker.HasTrailingMarker(context).Should().Be(expected);
        }
    }
}
