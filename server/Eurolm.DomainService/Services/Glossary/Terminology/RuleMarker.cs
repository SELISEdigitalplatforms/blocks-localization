namespace Eurolm.DomainService.Services
{
    /// <summary>
    /// C# port of the Phase 2 client <c>stripRuleMarker</c> (utils/glossary-rule-marker.ts). It must give
    /// the same result for every input.
    /// </summary>
    public static class RuleMarker
    {
        private const string MarkerOpen = "⟦rule:";
        private const string MarkerClose = "⟧";

        /// <summary>
        /// Removes one trailing <c>⟦rule: …⟧</c> marker and trims. A linear scan instead of a regex, so
        /// untrusted text can't trigger backtracking.
        /// </summary>
        public static string Strip(string? context)
        {
            var text = JsText.TrimEnd(context ?? "");
            var markerStart = FindTrailingMarkerStart(text);
            return JsText.Trim(markerStart == -1 ? text : text[..markerStart]);
        }

        /// <summary>True when the context ends with a <c>⟦rule: …⟧</c> marker that <see cref="Strip"/> would remove.</summary>
        public static bool HasTrailingMarker(string? context) =>
            FindTrailingMarkerStart(JsText.TrimEnd(context ?? "")) != -1;

        private static int FindTrailingMarkerStart(string text)
        {
            if (!text.EndsWith(MarkerClose, StringComparison.Ordinal)) return -1;
            // The marker body can't contain ⟧, so it opens after the previous ⟧ (if any).
            var previousClose = text[..^MarkerClose.Length].LastIndexOf(MarkerClose, StringComparison.Ordinal);
            return text.IndexOf(MarkerOpen, previousClose + 1, StringComparison.Ordinal);
        }
    }
}
