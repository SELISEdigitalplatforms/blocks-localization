using Eurolm.DomainService.Repositories;
using System.Buffers;
using System.Globalization;
using System.Text;

namespace Eurolm.DomainService.Services
{
    /// <summary>
    /// Checks an AI output against the active rules of the prompt's matches (DATA CONTRACTS › Validation). Same
    /// rules as the revised Phase 3 client (utils/glossary-validation.ts <c>validateTranslation</c>).
    /// </summary>
    public static class TranslationValidator
    {
        private readonly record struct Occurrence(int Start, int Length)
        {
            public bool IsWithin(Occurrence outer) => Start >= outer.Start && Start + Length <= outer.Start + outer.Length;
        }

        public static List<GlossaryViolationDto> Validate(string? output, string? targetCulture, IReadOnlyList<GlossaryMatch> ruleMatches)
        {
            var text = NormalizeNfc(output ?? "");
            var violations = new List<GlossaryViolationDto>();
            if (JsText.Trim(text).Length == 0 || ruleMatches == null || ruleMatches.Count == 0) return violations;

            var culture = targetCulture ?? "";
            List<Occurrence> Find(string value, bool caseInsensitive) => FindAll(text, value, caseInsensitive, culture);

            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var group in TerminologyPromptBuilder.GroupByGlossary(ruleMatches))
            {
                foreach (var violation in GlossaryViolations(text, group, culture, Find))
                {
                    var id = string.Join('\0', violation.GlossaryId, violation.Kind, violation.Found ?? violation.Expected ?? "");
                    if (seen.Add(id)) violations.Add(violation);
                }
            }
            return violations;
        }

        private static IEnumerable<GlossaryViolationDto> GlossaryViolations(
            string text,
            TerminologyPromptBuilder.MatchedGlossaryGroup group,
            string targetCulture,
            Func<string, bool, List<Occurrence>> find)
        {
            var terminology = group.Matches[0].Terminology;
            var glossaryId = group.Glossary.ItemId ?? "";
            var term = group.Glossary.Name ?? "";

            if (terminology.Rule == GlossaryRule.Keep)
            {
                // Every matched source surface must appear unchanged.
                foreach (var surface in group.Surfaces)
                {
                    if (find(surface, false).Count == 0)
                        yield return new GlossaryViolationDto { GlossaryId = glossaryId, Term = term, Kind = GlossaryViolationKinds.MissingKeep, Expected = surface };
                }
                yield break;
            }

            var approved = terminology.Rule == GlossaryRule.Translate
                ? JsText.Trim(terminology.ActiveTranslation(targetCulture) ?? "")
                : "";

            if (approved.Length > 0 && find(approved, true).Count == 0)
                yield return new GlossaryViolationDto { GlossaryId = glossaryId, Term = term, Kind = GlossaryViolationKinds.MissingTranslation, Expected = approved };

            // Forbidden rule: the term and its variants. Translate or forbidden: the stored forbidden values.
            // Longest first, so "Dashboards" isn't also reported as "Dashboard". An occurrence inside the
            // approved translation ("Portal" in "Portalseite") is not a use.
            var banned = BannedValues(group, terminology, targetCulture);

            var approvedSpans = approved.Length > 0 ? find(approved, true) : new List<Occurrence>();
            var reportedStarts = new HashSet<int>();
            foreach (var (value, caseInsensitive) in banned)
            {
                var occurrence = find(value, caseInsensitive).Cast<Occurrence?>()
                    .FirstOrDefault(c => !approvedSpans.Any(span => c!.Value.IsWithin(span)));
                if (occurrence == null || !reportedStarts.Add(occurrence.Value.Start)) continue;
                yield return new GlossaryViolationDto
                {
                    GlossaryId = glossaryId,
                    Term = term,
                    Kind = GlossaryViolationKinds.ForbiddenUsed,
                    Found = text.Substring(occurrence.Value.Start, occurrence.Value.Length)
                };
            }
        }

        private static List<(string Value, bool CaseInsensitive)> BannedValues(
            TerminologyPromptBuilder.MatchedGlossaryGroup group,
            EffectiveTerminology terminology,
            string targetCulture)
        {
            var banned = new List<(string Value, bool CaseInsensitive)>();
            if (terminology.Rule == GlossaryRule.Forbidden)
            {
                foreach (var alternative in new[] { group.Glossary.Name ?? "" }.Concat(terminology.Variants))
                {
                    var value = JsText.Trim(alternative ?? "");
                    if (value.Length > 0) banned.Add((value, !terminology.CaseSensitive));
                }
            }
            banned.AddRange(terminology.ActiveForbidden(targetCulture).Select(v => (v, true)));
            return banned.OrderByDescending(b => b.Value.Length).ToList();
        }

        /// <summary>
        /// Every occurrence of <paramref name="value"/> in <paramref name="text"/> where it starts a word; trailing
        /// letters are allowed so inflected forms ("Arbeitsbereichs") count (A11). No-space languages: substring.
        /// </summary>
        private static List<Occurrence> FindAll(string text, string value, bool caseInsensitive, string targetCulture)
        {
            var needle = NormalizeNfc(value);
            if (needle.Length == 0 || text.Length == 0) return new List<Occurrence>();
            var substring = GlossaryMatcher.IsNoSpaceCulture(targetCulture);

            return caseInsensitive
                ? FindIgnoringCase(text, needle, substring, targetCulture)
                : FindOrdinal(text, needle, substring);
        }

        private static List<Occurrence> FindOrdinal(string text, string needle, bool substring)
        {
            var occurrences = new List<Occurrence>();
            for (var at = text.IndexOf(needle, StringComparison.Ordinal); at != -1; at = text.IndexOf(needle, at + 1, StringComparison.Ordinal))
            {
                if (substring || GlossaryMatcher.IsWordStart(text, at)) occurrences.Add(new Occurrence(at, needle.Length));
            }
            return occurrences;
        }

        private static List<Occurrence> FindIgnoringCase(string text, string needle, bool substring, string targetCulture)
        {
            var occurrences = new List<Occurrence>();
            var textInfo = TextInfoFor(targetCulture);
            var (lowered, map) = LowerWithMap(text, textInfo);
            var loweredNeedle = LowerWithMap(needle, textInfo).Lowered;
            if (loweredNeedle.Length == 0) return occurrences;
            for (var at = lowered.IndexOf(loweredNeedle, StringComparison.Ordinal); at != -1; at = lowered.IndexOf(loweredNeedle, at + 1, StringComparison.Ordinal))
            {
                var start = map[at];
                var end = map[at + loweredNeedle.Length];
                if (start < 0 || end < 0) continue;
                if (substring || GlossaryMatcher.IsWordStart(text, start)) occurrences.Add(new Occurrence(start, end - start));
            }
            return occurrences;
        }

        /// <summary>
        /// Lower-cases one code point at a time with the target culture. <c>map</c> gives the original index only
        /// where a lowered code point starts (-1 elsewhere), so a match inside a case expansion is rejected.
        /// The Greek final sigma folds to σ.
        /// </summary>
        private static (string Lowered, int[] Map) LowerWithMap(string text, TextInfo textInfo)
        {
            var builder = new StringBuilder(text.Length);
            var map = new List<int>(text.Length + 1);
            var index = 0;
            while (index < text.Length)
            {
                var status = Rune.DecodeFromUtf16(text.AsSpan(index), out var rune, out var consumed);
                string lower;
                if (status == OperationStatus.Done)
                {
                    lower = textInfo.ToLower(rune.ToString());
                    if (lower == "ς") lower = "σ";
                }
                else
                {
                    consumed = 1;
                    lower = text[index].ToString();
                }
                map.Add(index);
                for (var i = 1; i < lower.Length; i++) map.Add(-1);
                builder.Append(lower);
                index += consumed;
            }
            map.Add(text.Length);
            return (builder.ToString(), map.ToArray());
        }

        private static TextInfo TextInfoFor(string culture)
        {
            if (string.IsNullOrWhiteSpace(culture)) return CultureInfo.InvariantCulture.TextInfo;
            try
            {
                return CultureInfo.GetCultureInfo(culture).TextInfo;
            }
            catch (CultureNotFoundException)
            {
                return CultureInfo.InvariantCulture.TextInfo;
            }
        }

        private static string NormalizeNfc(string value)
        {
            try
            {
                return value.Normalize(NormalizationForm.FormC);
            }
            catch (ArgumentException)
            {
                return value; // invalid UTF-16 (lone surrogate) is compared as is
            }
        }
    }
}
