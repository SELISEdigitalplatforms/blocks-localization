using Eurolm.DomainService.Repositories;
using Eurolm.DomainService.Services;
using System.Text.Json;

namespace XUnitTest.Terminology
{
    internal static class TerminologyTestData
    {
        /// <summary>A string from code points (literal escapes are avoided in these sources).</summary>
        public static string U(params int[] codePoints) => string.Concat(codePoints.Select(char.ConvertFromUtf32));

        public static string Meta(object data) => GlossaryMetaParser.Prefix + JsonSerializer.Serialize(data);

        public static BlocksGlossary Glossary(
            string id,
            string name,
            string? additionalNote = null,
            string? context = null,
            bool isGlobal = true,
            List<string>? moduleIds = null,
            GlossaryStatus? status = null) => new()
        {
            ItemId = id,
            Name = name,
            AdditionalNote = additionalNote ?? "",
            Context = context ?? "",
            IsGlobal = isGlobal,
            ModuleIds = moduleIds,
            Status = status
        };

        public static GlossaryMatcher Matcher(params BlocksGlossary[] glossaries) =>
            GlossaryMatcher.Build(glossaries.Select(g => (g, GlossaryTerminologyResolver.Resolve(g))));

        public static List<GlossaryMatch> Match(BlocksGlossary[] glossaries, string text, string culture = "en-US") =>
            Matcher(glossaries).Match(text, new MatchOptions { SourceCulture = culture });

        public static Dictionary<string, string> Map(params (string Key, string Value)[] entries) =>
            entries.ToDictionary(e => e.Key, e => e.Value);

        /// <summary>The G1 "Workspace" term of the client tests: translate de-DE / fr-FR with forbidden values.</summary>
        public static BlocksGlossary Workspace(string context = "") => Glossary(
            "g1",
            "Workspace",
            Meta(new Dictionary<string, object>
            {
                ["rule"] = "translate",
                ["variants"] = new[] { "workspaces" },
                ["translations"] = Map(("de-DE", "Arbeitsbereich"), ("fr-FR", "Espace de travail")),
                ["forbidden"] = new Dictionary<string, string[]> { ["de-DE"] = new[] { "Werkbereich" }, ["fr-FR"] = new[] { "Zone" } }
            }),
            context);

        public static SuggestLanguageRequest Request(string source, string? target = "de-DE", string? elementDetailContext = null) => new()
        {
            SourceText = source,
            CurrentLanguage = "English",
            DestinationLanguage = "German",
            DestinationLanguageCode = target,
            ElementDetailContext = elementDetailContext
        };
    }
}
