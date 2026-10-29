using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using FluentAssertions;
using System.Diagnostics;
using Xunit;
using static XUnitTest.Terminology.TerminologyTestData;

namespace XUnitTest.Terminology
{
    public class GlossaryMatcherTests
    {
        private static BlocksGlossary Term(string id, string name, object? meta = null, bool isGlobal = true, List<string>? modules = null, GlossaryStatus? status = null) =>
            Glossary(id, name, meta == null ? "" : Meta(meta), isGlobal: isGlobal, moduleIds: modules, status: status);

        [Fact]
        public void Matches_whole_words_only_H5()
        {
            var workspace = Term("g1", "Workspace");

            Match(new[] { workspace }, "Open your Workspace").Should().ContainSingle()
                .Which.Should().Match<GlossaryMatch>(m => m.Start == 10 && m.Length == 9 && m.Surface == "Workspace" && m.Scope == GlossaryScope.Global);
            Match(new[] { workspace }, "MyWorkspace settings").Should().BeEmpty();
            Match(new[] { workspace }, "Workspaces settings").Should().BeEmpty();
            Match(new[] { workspace }, "Workspace2").Should().BeEmpty();
            Match(new[] { workspace }, "(Workspace)").Should().ContainSingle().Which.Start.Should().Be(1);
        }

        [Fact]
        public void Matches_case_insensitively_unless_the_term_is_case_sensitive()
        {
            var workspace = Term("g1", "Workspace");
            var selise = Term("g2", "SELISE", new { rule = "keep", caseSensitive = true });

            Match(new[] { workspace }, "open the WORKSPACE").Single().Surface.Should().Be("WORKSPACE");
            Match(new[] { selise }, "Selise and SELISE").Should().ContainSingle().Which.Start.Should().Be(11);
        }

        [Fact]
        public void Matches_variants_and_reports_the_original_surface()
        {
            var workspace = Term("g1", "Workspace", new { variants = new[] { "workspaces", " Arbeitsplätze " } });

            var matches = Match(new[] { workspace }, "Two Workspaces and Arbeitsplätze");

            matches.Select(m => m.Surface).Should().Equal("Workspaces", "Arbeitsplätze");
            matches.Should().OnlyContain(m => m.Glossary.ItemId == "g1");
        }

        [Fact]
        public void The_longest_match_wins()
        {
            var portal = Term("p", "Portal");
            var customerPortal = Term("cp", "Customer Portal");

            Match(new[] { portal, customerPortal }, "Open the Customer Portal now").Should().ContainSingle()
                .Which.Glossary.ItemId.Should().Be("cp");
        }

        [Fact]
        public void Equal_spans_prefer_key_then_module_then_global_then_the_lower_id()
        {
            var global = Term("a-global", "Board");
            var module = Term("b-module", "Board", isGlobal: false, modules: new List<string> { "m1" });
            var key = Term("c-key", "Board", isGlobal: false);
            var matcher = Matcher(global, module, key);

            matcher.Match("Board", new MatchOptions { KeyGlossaryIds = new[] { "c-key" }, ModuleId = "m1" }).Single().Glossary.ItemId.Should().Be("c-key");
            matcher.Match("Board", new MatchOptions { ModuleId = "m1" }).Single().Scope.Should().Be(GlossaryScope.Module);
            matcher.Match("Board", new MatchOptions()).Single().Glossary.ItemId.Should().Be("a-global");

            var twin = Term("a-twin", "Board");
            Matcher(global, twin).Match("Board", new MatchOptions()).Single().Glossary.ItemId.Should().Be("a-global");
        }

        [Fact]
        public void Equal_span_and_scope_prefer_Approved_over_Draft_H27()
        {
            // The Draft term has the lower id, so before Phase 8 it would have won.
            var draft = Term("a-draft", "Portal", status: GlossaryStatus.Draft);
            var approved = Term("b-approved", "Portal", status: GlossaryStatus.Approved);

            Matcher(draft, approved).Match("Open the Portal", new MatchOptions()).Single().Glossary.ItemId.Should().Be("b-approved");
            Matcher(approved, draft).Match("Open the Portal", new MatchOptions()).Single().Glossary.ItemId.Should().Be("b-approved");
        }

        [Fact]
        public void Scope_and_span_still_come_before_status_Example_11()
        {
            var approvedModule = Term("a-module", "Portal", isGlobal: false, modules: new List<string> { "m1" }, status: GlossaryStatus.Approved);
            var draftKey = Term("b-key", "Portal", isGlobal: false, status: GlossaryStatus.Draft);
            var matcher = Matcher(approvedModule, draftKey);

            matcher.Match("Portal", new MatchOptions { KeyGlossaryIds = new[] { "b-key" }, ModuleId = "m1" })
                .Single().Glossary.ItemId.Should().Be("b-key");

            var draftLonger = Term("c-long", "Customer Portal", status: GlossaryStatus.Draft);
            var approvedShort = Term("d-short", "Portal", status: GlossaryStatus.Approved);
            Matcher(draftLonger, approvedShort).Match("Customer Portal", new MatchOptions()).Single().Glossary.ItemId.Should().Be("c-long");
        }

        [Fact]
        public void Equal_status_still_falls_back_to_the_lower_id()
        {
            var first = Term("a", "Portal", status: GlossaryStatus.Draft);
            var second = Term("b", "Portal", status: GlossaryStatus.Draft);

            Matcher(second, first).Match("Portal", new MatchOptions()).Single().Glossary.ItemId.Should().Be("a");
        }

        [Fact]
        public void Applicable_mode_drops_other_terms_and_all_mode_returns_them_as_other()
        {
            var other = Term("o", "Ledger", isGlobal: false);
            var matcher = Matcher(other);

            matcher.Match("The Ledger", new MatchOptions()).Should().BeEmpty();
            matcher.Match("The Ledger", new MatchOptions { Mode = GlossaryScopeMode.All }).Single().Scope.Should().Be(GlossaryScope.Other);
        }

        [Fact]
        public void No_space_source_languages_match_substrings_C15()
        {
            var term = Term("z", "工作区");

            Match(new[] { term }, "打开工作区设置", "zh-CN").Should().ContainSingle().Which.Start.Should().Be(2);
            Match(new[] { term }, "打开工作区设置", "ja").Should().ContainSingle();
            Match(new[] { term }, "打开工作区设置", "en-US").Should().BeEmpty();
        }

        [Theory]
        [InlineData("th-TH")]
        [InlineData("lo")]
        [InlineData("km_KH")]
        [InlineData("my-MM")]
        public void Every_no_space_culture_matches_inside_words(string culture)
        {
            Match(new[] { Term("t", "abc") }, "xabcx", culture).Should().ContainSingle();
        }

        [Fact]
        public void Offsets_are_UTF16_code_units_of_the_original_text_with_emoji()
        {
            var text = U(0x1F600) + " Workspace " + U(0x1F680) + " Workspace";

            var matches = Match(new[] { Term("g1", "Workspace") }, text);

            matches.Select(m => m.Start).Should().Equal(3, 16);
            matches.Should().OnlyContain(m => m.Length == 9 && text.Substring(m.Start, m.Length) == "Workspace");
        }

        [Fact]
        public void A_decomposed_source_matches_and_maps_back_to_the_original_offsets()
        {
            var nfdCafe = "Cafe" + U(0x0301);
            var text = "Open " + nfdCafe + " menu";

            var match = Match(new[] { Term("c", "Caf" + U(0x00E9)) }, text).Single();

            match.Start.Should().Be(5);
            match.Length.Should().Be(5);
            match.Surface.Should().Be(nfdCafe);
        }

        [Fact]
        public void A_decomposed_term_matches_composed_text()
        {
            Match(new[] { Term("c", "Cafe" + U(0x0301)) }, "Open Caf" + U(0x00E9) + " now").Single().Length.Should().Be(4);
        }

        [Fact]
        public void A_combining_mark_after_the_term_is_part_of_the_word()
        {
            // "Cafe" followed by a combining acute is "Café", not "Cafe".
            Match(new[] { Term("c", "Cafe") }, "Cafe" + U(0x0301) + " menu").Should().BeEmpty();
        }

        [Fact]
        public void Deprecated_and_unsupported_terms_are_excluded_but_drafts_are_kept_C4()
        {
            var deprecated = Term("d", "Ledger", status: GlossaryStatus.Deprecated);
            var unsupported = Glossary("u", "Board", "@@glossary-meta:v2@@{}");
            var draft = Term("r", "Portal", status: GlossaryStatus.Draft);

            var matches = Match(new[] { deprecated, unsupported, draft }, "Ledger Board Portal");

            matches.Should().ContainSingle().Which.Glossary.ItemId.Should().Be("r");
            matches.Single().Terminology.Status.Should().Be(GlossaryStatus.Draft);
        }

        [Fact]
        public void Empty_text_and_empty_glossaries_match_nothing()
        {
            Match(new[] { Term("g1", "Workspace") }, "").Should().BeEmpty();
            Matcher().Match("Workspace", new MatchOptions()).Should().BeEmpty();
            Match(new[] { Term("blank", "   ") }, "   ").Should().BeEmpty();
        }

        [Fact]
        public void Overlapping_occurrences_keep_the_first_longest()
        {
            var matches = Match(new[] { Term("a", "New York"), Term("b", "York City") }, "New York City");

            // Both spans are 8–9 units long; the longer one wins.
            matches.Should().ContainSingle().Which.Glossary.ItemId.Should().Be("b");
        }

        [Fact]
        public void Greek_final_sigma_folds_like_sigma()
        {
            Match(new[] { Term("g", "ΟΔΟΣ") }, "η οδος εδώ").Should().ContainSingle();
        }

        private static (GlossaryMatcher Matcher, string Text) Fixture2000()
        {
            var random = new Random(42);
            string Word(int length) => new(Enumerable.Range(0, length).Select(_ => (char)('a' + random.Next(26))).ToArray());
            var glossaries = Enumerable.Range(0, 2000).Select(i => Glossary(
                $"g{i:D4}",
                $"{Word(6)} {Word(5)}",
                Meta(new Dictionary<string, object>
                {
                    ["variants"] = new[] { Word(8), Word(7), Word(9) },
                    ["translations"] = Map(("de-DE", Word(10)), ("fr-FR", Word(10)), ("it-IT", Word(10)))
                }))).ToList();
            var matcher = GlossaryMatcher.Build(glossaries.Select(g => (g, GlossaryTerminologyResolver.Resolve(g))));

            var words = glossaries.Take(200).Select(g => g.Name).ToList();
            var builder = new System.Text.StringBuilder();
            while (builder.Length < 5000) builder.Append(words[random.Next(words.Count)]).Append(" and ").Append(Word(6)).Append(' ');
            return (matcher, builder.ToString(0, 5000));
        }

        [Fact]
        public void Builds_2000_terms_and_matches_5000_characters_within_twice_the_budget_C18()
        {
            Fixture2000(); // warm up the JIT

            var build = Stopwatch.StartNew();
            var (matcher, text) = Fixture2000();
            build.Stop();
            build.ElapsedMilliseconds.Should().BeLessThan(1000, "a cold build is budgeted at 500 ms");

            var timings = new List<double>();
            List<GlossaryMatch> result = new();
            for (var i = 0; i < 30; i++)
            {
                var watch = Stopwatch.StartNew();
                result = matcher.Match(text, new MatchOptions { SourceCulture = "en-US" });
                watch.Stop();
                timings.Add(watch.Elapsed.TotalMilliseconds);
            }
            timings.Sort();
            var p95 = timings[(int)Math.Ceiling(0.95 * timings.Count) - 1];

            result.Should().NotBeEmpty();
            p95.Should().BeLessThan(200, "/Match is budgeted at 100 ms p95 warm");
        }

        [Fact]
        public void A_2000_term_matcher_uses_at_most_20_MB()
        {
            var random = new Random(7);
            string Word(int length) => new(Enumerable.Range(0, length).Select(_ => (char)('a' + random.Next(26))).ToArray());
            var input = Enumerable.Range(0, 2000).Select(i =>
            {
                var g = Glossary($"g{i}", $"{Word(6)} {Word(5)}", Meta(new { variants = new[] { Word(8), Word(7), Word(9) } }));
                return (g, GlossaryTerminologyResolver.Resolve(g));
            }).ToList();

            var before = GC.GetTotalMemory(forceFullCollection: true);
            var matcher = GlossaryMatcher.Build(input);
            var after = GC.GetTotalMemory(forceFullCollection: true);
            GC.KeepAlive(matcher);

            (after - before).Should().BeLessThan(20L * 1024 * 1024);
            matcher.AlternativeCount.Should().Be(8000);
        }
    }
}
