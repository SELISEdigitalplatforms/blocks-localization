using Eurolm.DomainService.Repositories;
using System.Buffers;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

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
            // Searched with placeholders and tags blanked out (same offsets); reported from the real text.
            var searchable = PlaceholderMask.Apply(text);
            List<Occurrence> Find(string value, bool caseInsensitive) => FindAll(searchable, value, caseInsensitive, culture);
            List<Occurrence> FindBanned(string value, bool caseInsensitive) =>
                Find(value, caseInsensitive).Where(o => EndsForbiddenWord(searchable, o, value, culture)).ToList();
            bool ContainsApproved(string value) => ContainsApprovedTranslation(searchable, value, culture);

            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var group in TerminologyPromptBuilder.GroupByGlossary(ruleMatches))
            {
                foreach (var violation in GlossaryViolations(text, group, culture, Find, FindBanned, ContainsApproved))
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
            Func<string, bool, List<Occurrence>> find,
            Func<string, bool, List<Occurrence>> findBanned,
            Func<string, bool> containsApproved)
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

            if (approved.Length > 0 && !containsApproved(approved))
                yield return new GlossaryViolationDto { GlossaryId = glossaryId, Term = term, Kind = GlossaryViolationKinds.MissingTranslation, Expected = approved };

            // Forbidden rule: the term and its variants. Translate or forbidden: the stored forbidden values.
            // Longest first, so "Dashboards" isn't also reported as "Dashboard". An occurrence inside the
            // approved translation ("Portal" in "Portalseite") is not a use.
            var banned = BannedValues(group, terminology, targetCulture);

            var approvedSpans = approved.Length > 0 ? find(approved, true) : new List<Occurrence>();
            var reportedStarts = new HashSet<int>();
            foreach (var (value, caseInsensitive) in banned)
            {
                var occurrence = findBanned(value, caseInsensitive).Cast<Occurrence?>()
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

        private static readonly TimeSpan RegexTimeout = TimeSpan.FromMilliseconds(100);

        /// <summary>
        /// Arabic letters written onto the next word: a conjunction (و, ف), then a preposition (ب, ك, ل), then
        /// the article ال; ل followed by ال is written لل.
        /// </summary>
        private static readonly Regex ArabicProclitics = new("^[وف]?(?:[بكل]?ال|لل|[بكل])?$", RegexOptions.CultureInvariant, RegexTimeout);

        /// <summary>Hebrew prefix letters (ו, ה, ב, כ, ל, מ, ש), up to three, written onto the next word.</summary>
        private static readonly Regex HebrewProclitics = new("^[והבכלמש]{0,3}$", RegexOptions.CultureInvariant, RegexTimeout);

        /// <summary>Languages that write compounds as one word ("Standardarbeitsbereich").</summary>
        private static readonly string[] CompoundingLanguages = { "de", "nl", "sv", "da", "nb", "nn", "no", "is", "fo", "fi", "et", "af", "lb", "fy" };

        private static readonly char[] CultureSeparators = { '-', '_' };

        /// <summary>A shorter approved translation must start a word, so "Tag" is not found inside "Vertrag".</summary>
        public const int MinCompoundPartLength = 4;

        /// <summary>A shorter forbidden value must be a whole word, so "App" does not flag "Application".</summary>
        public const int MinInflectedForbiddenLength = 4;

        /// <summary>Letters a longer forbidden value may take as an inflected ending ("Werkbereichs").</summary>
        public const int MaxForbiddenEnding = 3;

        /// <summary>
        /// True when a forbidden <paramref name="value"/> found at <paramref name="occurrence"/> also ends there:
        /// a whole word, or (for a value of <see cref="MinInflectedForbiddenLength"/> letters or more) one followed
        /// by at most <see cref="MaxForbiddenEnding"/> letters. No-space languages: always.
        /// </summary>
        private static bool EndsForbiddenWord(string text, Occurrence occurrence, string value, string targetCulture)
        {
            if (GlossaryMatcher.IsNoSpaceCulture(targetCulture)) return true;
            var ending = WordLettersAfter(text, occurrence.Start + occurrence.Length, MaxForbiddenEnding);
            if (ending == 0) return true;
            return ending <= MaxForbiddenEnding && NormalizeNfc(value).EnumerateRunes().Count() >= MinInflectedForbiddenLength;
        }

        /// <summary>Letters and numbers from <paramref name="index"/> to the end of the word, counted up to <paramref name="limit"/> + 1.</summary>
        private static int WordLettersAfter(string text, int index, int limit)
        {
            var count = 0;
            while (count <= limit && !GlossaryMatcher.IsWordEnd(text, index))
            {
                count++;
                index += char.IsHighSurrogate(text[index]) && index + 1 < text.Length && char.IsLowSurrogate(text[index + 1]) ? 2 : 1;
            }
            return count;
        }

        /// <summary>
        /// True when the approved translation is used in <paramref name="text"/>: where it starts a word (inflected
        /// endings allowed, A11), or attached to the end of a word the target language builds that way — a compound
        /// ("Standardarbeitsbereich") or Arabic/Hebrew prefix letters ("بالحساب"). The text is searched as given;
        /// callers pass it with placeholders masked.
        /// </summary>
        public static bool ContainsApprovedTranslation(string text, string approved, string? targetCulture)
        {
            var culture = targetCulture ?? "";
            if (FindAll(text, approved, true, culture).Count > 0) return true;

            var needle = JsText.Trim(NormalizeNfc(approved));
            var language = culture.Split(CultureSeparators)[0].ToLowerInvariant();
            string core;
            Func<string, bool> allowsPrefix;
            switch (language)
            {
                case "ar":
                    // The article may be dropped or replaced by a preposition contraction: "الحساب" in "للحساب".
                    core = needle.StartsWith("ال", StringComparison.Ordinal) && needle.Length > 3 ? needle[2..] : needle;
                    allowsPrefix = prefix => SafeIsMatch(ArabicProclitics, prefix);
                    break;
                case "he":
                case "iw":
                    core = needle;
                    allowsPrefix = prefix => SafeIsMatch(HebrewProclitics, prefix);
                    break;
                default:
                    if (!CompoundingLanguages.Contains(language, StringComparer.Ordinal)
                        || needle.EnumerateRunes().Count() < MinCompoundPartLength) return false;
                    core = needle;
                    allowsPrefix = _ => true;
                    break;
            }

            return FindAll(text, core, true, culture, anywhere: true)
                .Any(occurrence => allowsPrefix(WordPrefix(text, occurrence.Start)));
        }

        private static bool SafeIsMatch(Regex regex, string value)
        {
            try
            {
                return regex.IsMatch(value);
            }
            catch (RegexMatchTimeoutException)
            {
                return false;
            }
        }

        /// <summary>The letters and digits of the same word that come before <paramref name="index"/>.</summary>
        private static string WordPrefix(string text, int index)
        {
            var start = index;
            while (start > 0 && !GlossaryMatcher.IsWordStart(text, start))
            {
                start -= char.IsLowSurrogate(text[start - 1]) && start >= 2 && char.IsHighSurrogate(text[start - 2]) ? 2 : 1;
            }
            return text[start..index];
        }

        /// <summary>
        /// Every occurrence of <paramref name="value"/> in <paramref name="text"/> where it starts a word; trailing
        /// letters are allowed so inflected forms ("Arbeitsbereichs") count (A11). Forbidden values are further
        /// limited by <see cref="EndsForbiddenWord"/>. No-space languages, or
        /// <paramref name="anywhere"/>: substring.
        /// </summary>
        private static List<Occurrence> FindAll(string text, string value, bool caseInsensitive, string targetCulture, bool anywhere = false)
        {
            var needle = NormalizeNfc(value);
            if (needle.Length == 0 || text.Length == 0) return new List<Occurrence>();
            var substring = anywhere || GlossaryMatcher.IsNoSpaceCulture(targetCulture);

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
