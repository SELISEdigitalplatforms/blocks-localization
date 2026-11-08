using Eurolm.DomainService.Services;
using FluentAssertions;
using Xunit;

namespace XUnitTest.Terminology
{
    public class PlaceholderMaskTests
    {
        private static string Blanked(string text, params string[] spans) =>
            spans.Aggregate(text, (result, span) =>
            {
                var at = result.IndexOf(span, StringComparison.Ordinal);
                return result[..at] + new string(' ', span.Length) + result[(at + span.Length)..];
            });

        [Theory]
        [InlineData("Welcome, {user}!", "{user}")]
        [InlineData("Hi {{name}}", "{{name}}")]
        [InlineData("Id ${id}", "${id}")]
        [InlineData("{0} files", "{0}")]
        [InlineData("Total {amount, number, currency}", "{amount, number, currency}")]
        [InlineData("Click <a href=\"/user\">here</a>", "<a href=\"/user\">", "</a>")]
        [InlineData("%s of %1$d user", "%s", "%1$d")]
        [InlineData("100%% user", "%%")]
        public void Blanks_placeholders_and_keeps_offsets(string text, params string[] spans)
        {
            var masked = PlaceholderMask.Apply(text);

            masked.Should().Be(Blanked(text, spans));
            masked.Length.Should().Be(text.Length);
        }

        [Fact]
        public void Keeps_ICU_branch_text_but_blanks_the_header_and_selectors()
        {
            const string text = "{count, plural, one {# user} other {# users}}";

            PlaceholderMask.Apply(text).Should().Be(Blanked(text, "{count, plural, one", "other"));
        }

        [Fact]
        public void Blanks_ICU_select_option_names_but_keeps_branch_text()
        {
            const string text = "{role, select, admin {Admin panel} other {Panel}}";

            var masked = PlaceholderMask.Apply(text);

            masked.Length.Should().Be(text.Length);
            masked[..14].Should().Be(new string(' ', 14));
            masked.Substring(15, 5).Should().Be("     ");
            masked.Substring(22, 11).Should().Be("Admin panel");
            masked.Should().NotContain("other");
        }

        [Fact]
        public void Select_option_names_are_blanked_only_at_the_arguments_own_depth()
        {
            const string text = "{g, select, female {She is admin {x}} other {admin rights}}";

            var masked = PlaceholderMask.Apply(text);

            masked.Should().Contain("She is admin").And.Contain("admin rights");
            masked.Should().NotContain("female").And.NotContain("other");
        }

        [Fact]
        public void H2_a_select_option_named_like_a_glossary_is_not_matched_but_branch_text_is()
        {
            var matcher = Matcher(TerminologyTestData.Glossary("g1", "admin"));

            var matches = matcher.Match("{role, select, admin {Admin panel} other {Panel}}", new MatchOptions());

            matches.Should().ContainSingle();
            matches[0].Start.Should().Be(22);
            matches[0].Length.Should().Be(5);
        }

        [Theory]
        [InlineData("Hi {{ name }} and {user}", new[] { "{user}", "{{name}}" })]
        [InlineData("${id} {count, number}", new[] { "${id}", "{count,number}" })]
        [InlineData("{count, plural, one {# item} other {# items}}", new[] { "{count,plural," })]
        [InlineData("{role, select, admin {Admin {user}} other {Panel}}", new[] { "{role,select,", "{user}" })]
        [InlineData("<a href=\"/x\">Go</a><br />", new[] { "</a>", "<a>", "<br/>" })]
        [InlineData("%1$d of %s, 100%%", new[] { "%1$d", "%s" })]
        [InlineData("{user} and {user}", new[] { "{user}", "{user}" })]
        [InlineData("Plain text", new string[0])]
        public void Tokens_are_normalized_and_sorted(string text, string[] expected)
        {
            PlaceholderMask.GetTokens(text).Should().Equal(expected);
        }

        [Theory]
        [InlineData("50% off, a < b > c, {not closed")]
        [InlineData("One other thing")]
        [InlineData("")]
        public void Leaves_plain_text_alone(string text)
        {
            PlaceholderMask.Apply(text).Should().Be(text);
        }

        [Fact]
        public void Matcher_never_matches_inside_placeholders_or_tags()
        {
            var matcher = Matcher(TerminologyTestData.Glossary("g1", "Workspace"));

            matcher.Match("Open {workspace}, {{Workspace}} or <workspace>", new MatchOptions()).Should().BeEmpty();
            matcher.Match("Open {id} Workspace", new MatchOptions()).Should().ContainSingle()
                .Which.Start.Should().Be(10);
        }

        [Fact]
        public void Validator_ignores_values_inside_placeholders()
        {
            var matches = TerminologyTestData.Match(new[] { TerminologyTestData.Workspace() }, "Open your Workspace", "en-US");

            TranslationValidator.Validate("Öffnen Sie Ihren Arbeitsbereich {Werkbereich}", "de-DE", matches).Should().BeEmpty();
            TranslationValidator.Validate("Öffnen {{Arbeitsbereich}}", "de-DE", matches)
                .Should().ContainSingle().Which.Kind.Should().Be(GlossaryViolationKinds.MissingTranslation);
        }

        private static GlossaryMatcher Matcher(params Eurolm.DomainService.Repositories.BlocksGlossary[] glossaries) =>
            TerminologyTestData.Matcher(glossaries);
    }
}
