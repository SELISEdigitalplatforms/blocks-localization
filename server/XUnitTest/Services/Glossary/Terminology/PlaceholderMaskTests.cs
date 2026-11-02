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
