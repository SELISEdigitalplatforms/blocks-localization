using Eurolm.DomainService.Repositories;
using System.Buffers;
using System.Globalization;
using System.Text;

namespace Eurolm.DomainService.Services
{
    public enum GlossaryScope
    {
        Key,
        Module,
        Global,
        Other
    }

    public enum GlossaryScopeMode
    {
        /// <summary>Only key, module and global terms; others are dropped.</summary>
        Applicable,
        /// <summary>Every term; terms outside the key, module and global scopes are returned as Other.</summary>
        All
    }

    public class MatchOptions
    {
        /// <summary>Source culture; zh, ja, th, lo, km and my match substrings instead of whole words.</summary>
        public string? SourceCulture { get; init; }
        public IReadOnlyCollection<string>? KeyGlossaryIds { get; init; }
        public string? ModuleId { get; init; }
        public GlossaryScopeMode Mode { get; init; } = GlossaryScopeMode.Applicable;
    }

    public class GlossaryMatch
    {
        public BlocksGlossary Glossary { get; init; } = default!;
        public EffectiveTerminology Terminology { get; init; } = default!;
        /// <summary>Offset in UTF-16 code units of the original (not normalized) text.</summary>
        public int Start { get; init; }
        /// <summary>Length in UTF-16 code units of the original text.</summary>
        public int Length { get; init; }
        /// <summary>The matched text as it appears in the original text.</summary>
        public string Surface { get; init; } = "";
        public GlossaryScope Scope { get; init; }
    }

    /// <summary>
    /// Aho–Corasick matcher over glossary names and variants (DATA CONTRACTS › Matcher). Deprecated terms and
    /// unsupported-version legacy documents are excluded at build time. Mirrors the Phase 3 client matcher
    /// (utils/glossary-matcher.ts), except that the text is NFC-normalized before matching.
    /// </summary>
    public sealed class GlossaryMatcher
    {
        private sealed class Entry
        {
            public required BlocksGlossary Glossary { get; init; }
            public required EffectiveTerminology Terminology { get; init; }
        }

        private readonly Automaton _sensitive;
        private readonly Automaton _insensitive;

        private GlossaryMatcher(Automaton sensitive, Automaton insensitive)
        {
            _sensitive = sensitive;
            _insensitive = insensitive;
        }

        public int AlternativeCount => _sensitive.PatternCount + _insensitive.PatternCount;

        public static GlossaryMatcher Build(IEnumerable<(BlocksGlossary Glossary, EffectiveTerminology Terminology)> glossaries)
        {
            ArgumentNullException.ThrowIfNull(glossaries);
            var sensitive = new AutomatonBuilder();
            var insensitive = new AutomatonBuilder();

            foreach (var (glossary, terminology) in glossaries)
            {
                if (glossary == null || terminology == null) continue;
                if (terminology.IsUnsupported || terminology.Status == GlossaryStatus.Deprecated) continue;

                var entry = new Entry { Glossary = glossary, Terminology = terminology };
                var builder = terminology.CaseSensitive ? sensitive : insensitive;
                foreach (var alternative in Alternatives(glossary, terminology))
                {
                    builder.Add(terminology.CaseSensitive ? alternative : FoldCase(alternative), entry);
                }
            }

            return new GlossaryMatcher(sensitive.ToAutomaton(), insensitive.ToAutomaton());
        }

        public List<GlossaryMatch> Match(string text, MatchOptions options)
        {
            ArgumentNullException.ThrowIfNull(options);
            if (string.IsNullOrEmpty(text)) return new List<GlossaryMatch>();

            var wholeWord = !IsNoSpaceCulture(options.SourceCulture);
            var keyIds = options.KeyGlossaryIds is { Count: > 0 } ids ? new HashSet<string>(ids, StringComparer.Ordinal) : null;

            // Offsets always refer to the original text; the normalized and folded copies are only searched.
            var (normalized, normalizedToOriginal) = NormalizeWithOffsets(text);
            var (folded, foldedToNormalized) = FoldWithOffsets(normalized);

            var candidates = new List<Candidate>();
            void Collect(Automaton automaton, string haystack, Func<int, int> toOriginal)
            {
                automaton.Search(haystack, (end, length, entries) =>
                    AddCandidates(candidates, text, toOriginal(end - length), toOriginal(end), entries, wholeWord, options, keyIds));
            }

            Collect(_sensitive, normalized, p => normalizedToOriginal[p]);
            Collect(_insensitive, folded, p =>
            {
                var n = foldedToNormalized[p];
                return n < 0 ? -1 : normalizedToOriginal[n];
            });

            return ResolveOverlaps(candidates, text.Length)
                .Select(c => new GlossaryMatch
                {
                    Glossary = c.Entry.Glossary,
                    Terminology = c.Entry.Terminology,
                    Start = c.Start,
                    Length = c.Length,
                    Surface = text.Substring(c.Start, c.Length),
                    Scope = c.Scope
                })
                .ToList();
        }

        private readonly record struct Candidate(Entry Entry, int Start, int Length, GlossaryScope Scope);

        private static void AddCandidates(List<Candidate> candidates, string text, int start, int originalEnd, List<Entry> entries,
                                          bool wholeWord, MatchOptions options, HashSet<string>? keyIds)
        {
            if (start < 0 || originalEnd < 0 || originalEnd <= start) return;
            if (IsTrailingUnit(text, start)) return;
            if (wholeWord && (!IsWordStart(text, start) || !IsWordEnd(text, originalEnd))) return;
            foreach (Entry entry in entries)
            {
                var scope = ScopeOf(entry.Glossary, options, keyIds);
                if (scope.HasValue)
                    candidates.Add(new Candidate(entry, start, originalEnd - start, scope.Value));
            }
        }

        private static GlossaryScope? ScopeOf(BlocksGlossary glossary, MatchOptions options, HashSet<string>? keyIds)
        {
            if (keyIds != null && glossary.ItemId != null && keyIds.Contains(glossary.ItemId)) return GlossaryScope.Key;
            if (!string.IsNullOrEmpty(options.ModuleId) && glossary.ModuleIds != null && glossary.ModuleIds.Contains(options.ModuleId))
                return GlossaryScope.Module;
            if (glossary.IsGlobal) return GlossaryScope.Global;
            return options.Mode == GlossaryScopeMode.All ? GlossaryScope.Other : null;
        }

        /// <summary>
        /// Longer span wins, then key &gt; module &gt; global &gt; other, then Approved over Draft (Phase 8), then
        /// the lower ItemId (ordinal).
        /// </summary>
        private static List<Candidate> ResolveOverlaps(List<Candidate> candidates, int textLength)
        {
            candidates.Sort(CompareCandidates);

            var taken = new bool[textLength];
            var kept = new List<Candidate>();
            foreach (var candidate in candidates)
            {
                if (!IsFree(taken, candidate)) continue;
                for (var i = candidate.Start; i < candidate.Start + candidate.Length; i++) taken[i] = true;
                kept.Add(candidate);
            }
            kept.Sort((a, b) => a.Start.CompareTo(b.Start));
            return kept;
        }

        private static int CompareCandidates(Candidate a, Candidate b)
        {
            if (a.Length != b.Length) return b.Length.CompareTo(a.Length);
            if (a.Scope != b.Scope) return ((int)a.Scope).CompareTo((int)b.Scope);
            var aApproved = a.Entry.Terminology.Status == GlossaryStatus.Approved;
            if (aApproved != (b.Entry.Terminology.Status == GlossaryStatus.Approved)) return aApproved ? -1 : 1;
            var byId = string.CompareOrdinal(a.Entry.Glossary.ItemId, b.Entry.Glossary.ItemId);
            return byId != 0 ? byId : a.Start.CompareTo(b.Start);
        }

        private static bool IsFree(bool[] taken, Candidate candidate)
        {
            for (var i = candidate.Start; i < candidate.Start + candidate.Length; i++)
            {
                if (taken[i]) return false;
            }
            return true;
        }

        private static readonly string[] NoSpaceLanguages = { "zh", "ja", "th", "lo", "km", "my" };
        private static readonly char[] CultureSeparators = { '-', '_' };

        /// <summary>Cultures written without spaces between words: terms match as plain substrings.</summary>
        public static bool IsNoSpaceCulture(string? culture)
        {
            var primary = (culture ?? "").Split(CultureSeparators)[0].ToLowerInvariant();
            return NoSpaceLanguages.Contains(primary, StringComparer.Ordinal);
        }

        /// <summary>Letters and numbers, as the client's <c>/[\p{L}\p{N}]/u</c>.</summary>
        internal static bool IsWordRune(Rune rune)
        {
            var category = Rune.GetUnicodeCategory(rune);
            return Rune.IsLetter(rune)
                || category is UnicodeCategory.DecimalDigitNumber or UnicodeCategory.LetterNumber or UnicodeCategory.OtherNumber;
        }

        /// <summary>True when the code point ending right before <paramref name="index"/> is not a letter or number.</summary>
        internal static bool IsWordStart(string text, int index)
        {
            if (index <= 0) return true;
            return Rune.DecodeLastFromUtf16(text.AsSpan(0, index), out var rune, out _) != OperationStatus.Done
                || !IsWordRune(rune);
        }

        /// <summary>True when the code point starting at <paramref name="index"/> is not a letter or number.</summary>
        internal static bool IsWordEnd(string text, int index)
        {
            if (index >= text.Length) return true;
            return Rune.DecodeFromUtf16(text.AsSpan(index), out var rune, out _) != OperationStatus.Done
                || !IsWordRune(rune);
        }

        private static bool IsTrailingUnit(string text, int index) =>
            index > 0 && index < text.Length && char.IsLowSurrogate(text[index]) && char.IsHighSurrogate(text[index - 1]);

        /// <summary>Lower-cases one code point at a time (invariant); the Greek final sigma folds to σ.</summary>
        internal static string FoldCase(string value) => FoldWithOffsets(value).Folded;

        private static (string Folded, int[] ToSource) FoldWithOffsets(string text)
        {
            var builder = new StringBuilder(text.Length);
            var map = new List<int>(text.Length + 1);
            var index = 0;
            while (index < text.Length)
            {
                var status = Rune.DecodeFromUtf16(text.AsSpan(index), out var rune, out var consumed);
                var startLength = builder.Length;
                if (status == OperationStatus.Done)
                {
                    var lower = Rune.ToLowerInvariant(rune);
                    if (lower.Value == 0x03C2) lower = new Rune(0x03C3);
                    builder.Append(lower.ToString());
                }
                else
                {
                    consumed = 1;
                    builder.Append(text[index]);
                }
                map.Add(index);
                for (var i = startLength + 1; i < builder.Length; i++) map.Add(-1);
                index += consumed;
            }
            map.Add(text.Length);
            return (builder.ToString(), map.ToArray());
        }

        /// <summary>
        /// NFC-normalizes the text chunk by chunk (a starter plus its combining marks), so every chunk boundary
        /// maps back to an original offset. Offsets inside a recomposed chunk map to -1.
        /// </summary>
        private static (string Normalized, int[] ToOriginal) NormalizeWithOffsets(string text)
        {
            if (text.IsNormalized(NormalizationForm.FormC))
            {
                var identity = new int[text.Length + 1];
                for (var i = 0; i <= text.Length; i++) identity[i] = i;
                return (text, identity);
            }

            var builder = new StringBuilder(text.Length);
            var map = new List<int>(text.Length + 1);
            var start = 0;
            while (start < text.Length)
            {
                var end = start + RuneLength(text, start);
                while (end < text.Length && ContinuesChunk(text, end)) end += RuneLength(text, end);

                var chunk = text[start..end];
                string normalizedChunk;
                try
                {
                    normalizedChunk = chunk.Normalize(NormalizationForm.FormC);
                }
                catch (ArgumentException)
                {
                    normalizedChunk = chunk; // invalid UTF-16 (lone surrogate) is left as is
                }

                map.Add(start);
                // Inner offsets map back only when the chunk was already normalized (no recomposition or reordering).
                var unchanged = string.Equals(normalizedChunk, chunk, StringComparison.Ordinal);
                for (var i = 1; i < normalizedChunk.Length; i++) map.Add(unchanged ? start + i : -1);
                builder.Append(normalizedChunk);
                start = end;
            }
            map.Add(text.Length);
            return (builder.ToString(), map.ToArray());
        }

        private static int RuneLength(string text, int index) =>
            char.IsHighSurrogate(text[index]) && index + 1 < text.Length && char.IsLowSurrogate(text[index + 1]) ? 2 : 1;

        /// <summary>Combining marks and Hangul medial/final jamo attach to the preceding chunk.</summary>
        private static bool ContinuesChunk(string text, int index)
        {
            if (Rune.DecodeFromUtf16(text.AsSpan(index), out var rune, out _) != OperationStatus.Done) return false;
            if (rune.Value is >= 0x1160 and <= 0x11FF) return true;
            return Rune.GetUnicodeCategory(rune) is UnicodeCategory.NonSpacingMark
                or UnicodeCategory.SpacingCombiningMark or UnicodeCategory.EnclosingMark;
        }

        private static IEnumerable<string> Alternatives(BlocksGlossary glossary, EffectiveTerminology terminology)
        {
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var value in new[] { glossary.Name ?? "" }.Concat(terminology.Variants ?? new List<string>()))
            {
                var text = JsText.Trim(value ?? "");
                if (text.Length == 0) continue;
                try
                {
                    text = text.Normalize(NormalizationForm.FormC);
                }
                catch (ArgumentException)
                {
                    // invalid UTF-16: keep the trimmed text
                }
                if (seen.Add(text)) yield return text;
            }
        }

        private sealed class AutomatonBuilder
        {
            private readonly Dictionary<string, List<Entry>> _patterns = new(StringComparer.Ordinal);

            public void Add(string pattern, Entry entry)
            {
                if (pattern.Length == 0) return;
                if (!_patterns.TryGetValue(pattern, out var entries))
                {
                    entries = new List<Entry>();
                    _patterns[pattern] = entries;
                }
                if (!entries.Contains(entry)) entries.Add(entry);
            }

            public Automaton ToAutomaton() => new(_patterns);
        }

        private sealed class Automaton
        {
            // Transitions of every node in one dictionary keyed by (node, char) keeps memory low.
            private readonly Dictionary<long, int> _goto = new();
            private int[] _fail = Array.Empty<int>();
            private readonly int[] _patternAt;   // pattern ending at the node, -1 if none
            private int[] _outputLink = Array.Empty<int>();  // nearest fail ancestor with a pattern, -1 if none
            private readonly int[] _patternLength;
            private readonly List<Entry>[] _patternEntries;

            public int PatternCount => _patternLength.Length;

            public Automaton(Dictionary<string, List<Entry>> patterns)
            {
                _patternLength = new int[patterns.Count];
                _patternEntries = new List<Entry>[patterns.Count];

                var patternAt = new List<int> { -1 };
                var nodeCount = 1;
                var patternId = 0;
                foreach (var (pattern, entries) in patterns)
                {
                    var node = 0;
                    foreach (var c in pattern)
                    {
                        var key = Key(node, c);
                        if (!_goto.TryGetValue(key, out var next))
                        {
                            next = nodeCount++;
                            _goto[key] = next;
                            patternAt.Add(-1);
                        }
                        node = next;
                    }
                    patternAt[node] = patternId;
                    _patternLength[patternId] = pattern.Length;
                    _patternEntries[patternId] = entries;
                    patternId++;
                }

                _patternAt = patternAt.ToArray();
                BuildFailureLinks(nodeCount);
            }

            private static long Key(int node, char c) => ((long)node << 16) | c;

            private void BuildFailureLinks(int nodeCount)
            {
                _fail = new int[nodeCount];
                _outputLink = Enumerable.Repeat(-1, nodeCount).ToArray();

                var children = new List<(char C, int Child)>[nodeCount];
                foreach (var (key, child) in _goto)
                {
                    var parent = (int)(key >> 16);
                    (children[parent] ??= new List<(char, int)>()).Add(((char)(key & 0xFFFF), child));
                }

                var queue = new Queue<int>();
                if (children[0] != null)
                {
                    foreach (var (_, child) in children[0])
                    {
                        _fail[child] = 0;
                        queue.Enqueue(child);
                    }
                }

                while (queue.Count > 0)
                {
                    var node = queue.Dequeue();
                    if (children[node] == null) continue;
                    foreach (var (c, child) in children[node])
                    {
                        var fallback = _fail[node];
                        int next;
                        while (!_goto.TryGetValue(Key(fallback, c), out next) && fallback != 0) fallback = _fail[fallback];
                        if (!_goto.TryGetValue(Key(fallback, c), out next) || next == child) next = 0;
                        _fail[child] = next;
                        _outputLink[child] = _patternAt[next] >= 0 ? next : _outputLink[next];
                        queue.Enqueue(child);
                    }
                }
            }

            /// <summary>Reports every pattern occurrence as (end offset, length, entries) in <paramref name="text"/>.</summary>
            public void Search(string text, Action<int, int, List<Entry>> report)
            {
                if (_patternLength.Length == 0) return;
                var node = 0;
                for (var i = 0; i < text.Length; i++)
                {
                    var c = text[i];
                    int next;
                    while (!_goto.TryGetValue(Key(node, c), out next) && node != 0) node = _fail[node];
                    node = _goto.TryGetValue(Key(node, c), out next) ? next : 0;

                    for (var output = _patternAt[node] >= 0 ? node : _outputLink[node]; output >= 0; output = _outputLink[output])
                    {
                        var id = _patternAt[output];
                        report(i + 1, _patternLength[id], _patternEntries[id]);
                    }
                }
            }
        }
    }
}
