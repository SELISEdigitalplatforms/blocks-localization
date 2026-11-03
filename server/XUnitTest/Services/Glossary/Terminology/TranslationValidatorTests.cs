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

        [Theory]
        [InlineData("Projektarbeitsbereich öffnen")]
        [InlineData("Den Standardarbeitsbereichs öffnen")]
        public void A_translation_at_the_end_of_a_compound_counts_in_a_compounding_language_C21_Example_10(string output)
        {
            Validate(new[] { Workspace() }, "Open your Workspace", output).Should().BeEmpty();
        }

        [Theory]
        [InlineData("de-DE")]
        [InlineData("de_DE")]
        [InlineData("DE")]
        public void The_target_language_is_read_from_a_culture_with_either_separator(string culture)
        {
            TranslationValidator.ContainsApprovedTranslation("Projektarbeitsbereich", "Arbeitsbereich", culture).Should().BeTrue();
        }

        [Fact]
        public void A_translation_inside_another_word_is_still_reported_where_compounds_are_not_written_as_one_word()
        {
            var workspace = Glossary("g1", "Workspace", Meta(new Dictionary<string, object> { ["translations"] = Map(("en-GB", "space")) }));

            Validate(new[] { workspace }, "Open your Workspace", "Open your workspace", target: "en-GB")
                .Should().ContainSingle().Which.Kind.Should().Be(GlossaryViolationKinds.MissingTranslation);
        }

        [Fact]
        public void A_short_translation_inside_a_compound_is_still_reported()
        {
            var day = Glossary("d", "Day", Meta(new Dictionary<string, object> { ["translations"] = Map(("de-DE", "Tag")) }));

            Validate(new[] { day }, "Day", "Vertrag").Should().ContainSingle().Which.Expected.Should().Be("Tag");
            Validate(new[] { day }, "Day", "Tagesansicht").Should().BeEmpty();
        }

        [Theory]
        [InlineData("الحساب")]
        [InlineData("افتح حسابك")]
        [InlineData("افتح الحساب")]
        [InlineData("بالحساب")]
        [InlineData("وبالحساب")]
        [InlineData("للحساب")]
        [InlineData("فالحساب")]
        public void Arabic_prefix_letters_and_the_article_are_accepted(string output)
        {
            var account = Glossary("a", "Account", Meta(new Dictionary<string, object> { ["translations"] = Map(("ar-SA", "الحساب")) }));

            Validate(new[] { account }, "Open your Account", output, target: "ar-SA").Should().BeEmpty();
        }

        [Fact]
        public void An_Arabic_translation_inside_a_longer_stem_is_still_reported()
        {
            var account = Glossary("a", "Account", Meta(new Dictionary<string, object> { ["translations"] = Map(("ar-SA", "حساب")) }));

            // "مح" is not a run of prefix letters, so this is another word, not the approved one.
            Validate(new[] { account }, "Account", "مححساب", target: "ar-SA")
                .Should().ContainSingle().Which.Kind.Should().Be(GlossaryViolationKinds.MissingTranslation);
        }

        [Theory]
        [InlineData("החשבון")]
        [InlineData("בחשבון")]
        [InlineData("ולחשבון")]
        public void Hebrew_prefix_letters_are_accepted(string output)
        {
            var account = Glossary("a", "Account", Meta(new Dictionary<string, object> { ["translations"] = Map(("he-IL", "חשבון")) }));

            Validate(new[] { account }, "Account", output, target: "he-IL").Should().BeEmpty();
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

        [Theory]
        [InlineData("Open the Application")]
        [InlineData("Open the Appendix")]
        [InlineData("Sign in with your Login")]
        public void A_short_forbidden_value_must_be_a_whole_word(string output)
        {
            var app = Glossary("a", "App", Meta(new Dictionary<string, object>
            {
                ["forbidden"] = new Dictionary<string, string[]> { ["en-GB"] = new[] { "App", "log" } }
            }));

            Validate(new[] { app }, "App", output, "en-GB").Where(v => v.Kind == GlossaryViolationKinds.ForbiddenUsed)
                .Should().BeEmpty();
            Validate(new[] { app }, "App", "Open the App", "en-GB").Single(v => v.Kind == GlossaryViolationKinds.ForbiddenUsed)
                .Found.Should().Be("App");
        }

        [Theory]
        [InlineData("Ihres Werkbereichs", "Werkbereich")]
        [InlineData("Die Werkbereichen", "Werkbereich")]
        public void A_longer_forbidden_value_takes_a_short_inflected_ending(string output, string found)
        {
            Validate(new[] { Workspace() }, "Workspace", output)
                .Single(v => v.Kind == GlossaryViolationKinds.ForbiddenUsed).Found.Should().Be(found);
        }

        [Fact]
        public void A_longer_forbidden_value_inside_a_longer_word_is_not_a_use()
        {
            Validate(new[] { Workspace() }, "Workspace", "Der Werkbereichsleiter")
                .Should().NotContain(v => v.Kind == GlossaryViolationKinds.ForbiddenUsed);
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
        public void An_unknown_target_culture_lowers_with_the_invariant_culture()
        {
            const string culture = "not-a-culture-zz9";
            var workspace = Glossary("w", "Workspace", Meta(new { translations = Map((culture, "Arbeitsbereich")), forbidden = new Dictionary<string, string[]> { [culture] = new[] { "Werkbereich" } } }));

            Validate(new[] { workspace }, "Open Workspace", "WERKBEREICH öffnen", culture)
                .Should().Contain(v => v.Kind == GlossaryViolationKinds.ForbiddenUsed && v.Found == "WERKBEREICH");
        }

        [Fact]
        public void A_lone_surrogate_in_the_output_is_compared_as_is()
        {
            var workspace = Glossary("w", "Workspace", Meta(new { translations = Map(("de-DE", "Arbeitsbereich")), forbidden = new Dictionary<string, string[]> { ["de-DE"] = new[] { "Werkbereich" } } }));

            Validate(new[] { workspace }, "Open Workspace", "Werkbereich \uD800 öffnen")
                .Should().Contain(v => v.Kind == GlossaryViolationKinds.ForbiddenUsed && v.Found == "Werkbereich");
        }

        [Fact]
        public void An_approved_Hindi_translation_must_start_a_word()
        {
            var world = Glossary("w", "world", Meta(new { translations = Map(("hi-IN", "दुनिया")) }));

            Validate(new[] { world }, "Hello world", "नमस्ते दुनिया", "hi-IN").Should().BeEmpty();
            // "को" ends in a vowel sign, so "दुनिया" after it is inside one word, not a word of its own.
            Validate(new[] { world }, "Hello world", "नमस्ते कोदुनिया", "hi-IN").Should().ContainSingle()
                .Which.Kind.Should().Be(GlossaryViolationKinds.MissingTranslation);
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
