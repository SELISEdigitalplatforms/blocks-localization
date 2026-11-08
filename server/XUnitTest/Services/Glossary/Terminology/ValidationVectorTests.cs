using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using System.Text.Json;
using Xunit;
using static XUnitTest.Terminology.TerminologyTestData;

namespace XUnitTest.Terminology
{
    /// <summary>The vectors shared with the client suite (utils/glossary-validation-vectors.test.ts).</summary>
    public class ValidationVectorTests
    {
        internal sealed record VectorGlossary(
            string Id,
            string Name,
            string? Rule,
            bool CaseSensitive,
            IReadOnlyList<string>? Variants,
            Dictionary<string, string>? Translations,
            Dictionary<string, string[]>? Forbidden);

        internal sealed record VectorMatch(string GlossaryId, int Start, string Surface);

        internal sealed record VectorViolation(string Kind, string GlossaryId, string Value);

        internal sealed record Vector(
            string Id,
            string Source,
            string? SourceCulture,
            string Target,
            string Culture,
            IReadOnlyList<VectorGlossary> Glossaries,
            string? ExpectedMasked,
            IReadOnlyList<VectorMatch> ExpectedMatches,
            IReadOnlyList<VectorViolation> ExpectedViolations);

        private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

        private static readonly Lazy<Dictionary<string, Vector>> Vectors = new(() =>
        {
            var path = Path.Combine(AppContext.BaseDirectory, "testdata", "glossary", "validation-vectors.json");
            var vectors = JsonSerializer.Deserialize<List<Vector>>(File.ReadAllText(path), JsonOptions)!;
            return vectors.ToDictionary(v => v.Id);
        });

        public static IEnumerable<object[]> VectorIds() => Vectors.Value.Keys.Select(id => new object[] { id });

        private static BlocksGlossary ToGlossary(VectorGlossary glossary)
        {
            var meta = new Dictionary<string, object>
            {
                ["rule"] = glossary.Rule ?? "translate",
                ["caseSensitive"] = glossary.CaseSensitive,
                ["variants"] = glossary.Variants ?? Array.Empty<string>(),
                ["translations"] = glossary.Translations ?? new Dictionary<string, string>(),
                ["forbidden"] = glossary.Forbidden ?? new Dictionary<string, string[]>()
            };
            return Glossary(glossary.Id, glossary.Name, Meta(meta));
        }

        [Fact]
        public void The_shared_file_has_vectors()
        {
            Vectors.Value.Should().HaveCountGreaterThanOrEqualTo(20);
        }

        [Theory]
        [MemberData(nameof(VectorIds))]
        public void Vector_gives_the_shared_mask_matches_and_violations(string id)
        {
            var vector = Vectors.Value[id];

            if (vector.ExpectedMasked != null) PlaceholderMask.Apply(vector.Source).Should().Be(vector.ExpectedMasked);

            var matches = Match(vector.Glossaries.Select(ToGlossary).ToArray(), vector.Source, vector.SourceCulture ?? "en-US");
            matches.Select(m => new VectorMatch(m.Glossary.ItemId!, m.Start, m.Surface))
                .Should().Equal(vector.ExpectedMatches);

            TranslationValidator.Validate(vector.Target, vector.Culture, matches)
                .Select(v => new VectorViolation(v.Kind, v.GlossaryId, v.Found ?? v.Expected ?? ""))
                .Should().Equal(vector.ExpectedViolations);
        }
    }
}
