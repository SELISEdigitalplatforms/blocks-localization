using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using Xunit;
using static XUnitTest.Terminology.TerminologyTestData;

namespace XUnitTest.Terminology
{
    public class TranslationValidatorTests
    {
        private static List<GlossaryViolationDto> Validate(BlocksGlossary[] glossaries, string source, string output, string target = "de-DE", string sourceCulture = "en-US") =>
            TranslationValidator.Validate(output, target, Match(glossaries, source, sourceCulture));

        [Fact]
        public void Example_1_reports_the_forbidden_value_and_the_missing_translation()
        {
            var violations = Validate(new[] { Workspace() }, "Open your Workspace", "Öffnen Sie Ihren Werkbereich");

            violations.Select(v => (v.Kind, v.Expected, v.Found)).Should().Equal(
                (GlossaryViolationKinds.MissingTranslation, "Arbeitsbereich", null),
                (GlossaryViolationKinds.ForbiddenUsed, null, "Werkbereich"));
            violations.Should().OnlyContain(v => v.GlossaryId == "g1" && v.Term == "Workspace");
        }

        [Fact]
        public void The_corrected_Example_1_output_has_no_violations()
        {
            Validate(new[] { Workspace() }, "Open your Workspace", "Öffnen Sie Ihren Arbeitsbereich").Should().BeEmpty();
        }

        [Theory]
        [InlineData("Öffnen Sie die Einstellungen des Arbeitsbereichs")]
        [InlineData("Die Arbeitsbereiche")]
        [InlineData("ARBEITSBEREICH öffnen")]
        public void Inflected_and_differently_cased_translations_count_C21_Example_10(string output)
        {
            Validate(new[] { Workspace() }, "Open your Workspace", output).Should().BeEmpty();
        }

        [Fact]
        public void A_translation_only_inside_a_compound_is_reported_C21_Example_10()
        {
            Validate(new[] { Workspace() }, "Open your Workspace", "Projektarbeitsbereich öffnen")
                .Should().ContainSingle().Which.Kind.Should().Be(GlossaryViolationKinds.MissingTranslation);
        }

        [Fact]
        public void A_forbidden_value_inside_the_approved_translation_is_not_a_use()
        {
            var portal = Glossary("p", "Portal", Meta(new Dictionary<string, object>
            {
                ["translations"] = Map(("de-DE", "Portalseite")),
                ["forbidden"] = new Dictionary<string, string[]> { ["de-DE"] = new[] { "Portal" } }
            }));

            Validate(new[] { portal }, "Portal", "Die Portalseite").Should().BeEmpty();
            Validate(new[] { portal }, "Portal", "Das Portal und die Portalseite")
                .Should().ContainSingle().Which.Found.Should().Be("Portal");
        }

        [Fact]
        public void Keep_requires_each_matched_surface_case_sensitively()
        {
            var selise = Glossary("s", "SELISE", Meta(new { rule = "keep", variants = new[] { "Selise" }, caseSensitive = true }));

            Validate(new[] { selise }, "SELISE and Selise", "SELISE und Selise").Should().BeEmpty();
            Validate(new[] { selise }, "SELISE and Selise", "selise und Selise")
                .Should().ContainSingle().Which.Should().Match<GlossaryViolationDto>(v => v.Kind == GlossaryViolationKinds.MissingKeep && v.Expected == "SELISE");
        }

        [Fact]
        public void Forbidden_reports_the_term_and_its_variants_respecting_case_sensitivity()
        {
            var insensitive = Glossary("f", "Werk", Meta(new { rule = "forbidden", variants = new[] { "Werke" } }));
            var sensitive = Glossary("c", "BETA", Meta(new { rule = "forbidden", caseSensitive = true }));

            Validate(new[] { insensitive }, "Werk", "Die werke").Single().Found.Should().Be("werke");
            Validate(new[] { sensitive }, "BETA", "Die Beta").Should().BeEmpty();
            Validate(new[] { sensitive }, "BETA", "Die BETA").Single().Found.Should().Be("BETA");
        }

        [Fact]
        public void Longer_banned_values_are_reported_once_at_a_position()
        {
            var dashboard = Glossary("d", "Dashboard", Meta(new { rule = "forbidden", variants = new[] { "Dashboards" } }));

            Validate(new[] { dashboard }, "Dashboard", "Zwei Dashboards").Should().ContainSingle().Which.Found.Should().Be("Dashboards");
        }

        [Fact]
        public void Inactive_values_are_ignored_C20()
        {
            var keep = Glossary("k", "SELISE", Meta(new Dictionary<string, object>
            {
                ["rule"] = "keep",
                ["translations"] = Map(("de-DE", "Selise GmbH")),
                ["forbidden"] = new Dictionary<string, string[]> { ["de-DE"] = new[] { "SELISE" } }
            }));
            var forbidden = Glossary("f", "Werk", Meta(new Dictionary<string, object>
            {
                ["rule"] = "forbidden",
                ["translations"] = Map(("de-DE", "Arbeit"))
            }));

            Validate(new[] { keep }, "SELISE login", "SELISE Anmeldung").Should().BeEmpty();
            Validate(new[] { forbidden }, "Werk order", "Auftrag").Should().BeEmpty();
        }

        [Fact]
        public void No_space_target_languages_match_substrings()
        {
            var workspace = Glossary("w", "Workspace", Meta(new { translations = Map(("ja-JP", "ワークスペース")) }));

            Validate(new[] { workspace }, "Open your Workspace", "あなたのワークスペースを開く", "ja-JP").Should().BeEmpty();
            Validate(new[] { workspace }, "Open your Workspace", "作業領域を開く", "ja-JP").Single().Kind.Should().Be(GlossaryViolationKinds.MissingTranslation);
        }

        [Fact]
        public void Turkish_lowering_uses_the_target_culture()
        {
            var city = Glossary("t", "Igdir", Meta(new { translations = Map(("tr-TR", "Iğdır")) }));

            Validate(new[] { city }, "Igdir", "IĞDIR şehri", "tr-TR").Should().BeEmpty();
        }

        [Fact]
        public void A_decomposed_output_is_normalized_before_checking()
        {
            var cafe = Glossary("c", "Cafe", Meta(new { translations = Map(("fr-FR", "Caf" + U(0x00E9))) }));

            Validate(new[] { cafe }, "Cafe", "Le Cafe" + U(0x0301), "fr-FR").Should().BeEmpty();
        }

        [Fact]
        public void Empty_output_or_no_rules_report_nothing()
        {
            Validate(new[] { Workspace() }, "Open your Workspace", "   ").Should().BeEmpty();
            TranslationValidator.Validate("text", "de-DE", new List<GlossaryMatch>()).Should().BeEmpty();
            TranslationValidator.Validate(null, "de-DE", Match(new[] { Workspace() }, "Workspace")).Should().BeEmpty();
        }

        [Fact]
        public void One_violation_per_glossary_kind_and_found()
        {
            var violations = Validate(new[] { Workspace() }, "Workspace and Workspace", "Werkbereich und Werkbereich");

            violations.Count(v => v.Kind == GlossaryViolationKinds.ForbiddenUsed).Should().Be(1);
            violations.Count(v => v.Kind == GlossaryViolationKinds.MissingTranslation).Should().Be(1);
        }
    }
}
