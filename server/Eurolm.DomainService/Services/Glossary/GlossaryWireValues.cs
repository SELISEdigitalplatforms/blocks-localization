using Eurolm.DomainService.Repositories;

namespace Eurolm.DomainService.Services
{
    /// <summary>The lower-case wire spellings of <see cref="GlossaryRule"/> and <see cref="GlossaryStatus"/>.</summary>
    public static class GlossaryWireValues
    {
        public static string ToWire(GlossaryRule rule) => rule switch
        {
            GlossaryRule.Keep => "keep",
            GlossaryRule.Forbidden => "forbidden",
            _ => "translate"
        };

        public static string ToWire(GlossaryStatus status) => status switch
        {
            GlossaryStatus.Draft => "draft",
            GlossaryStatus.Deprecated => "deprecated",
            _ => "approved"
        };

        public static bool TryParseRule(string? value, out GlossaryRule rule)
        {
            switch (value?.ToLowerInvariant())
            {
                case "translate": rule = GlossaryRule.Translate; return true;
                case "keep": rule = GlossaryRule.Keep; return true;
                case "forbidden": rule = GlossaryRule.Forbidden; return true;
                default: rule = GlossaryRule.Translate; return false;
            }
        }

        public static readonly IReadOnlyList<string> PartsOfSpeech = new[] { "noun", "verb", "adjective", "adverb", "phrase", "other" };

        /// <summary>The stored form of a part of speech: lower case, or null for "" (clears it). False when not allowed.</summary>
        public static bool TryParsePartOfSpeech(string? value, out string? partOfSpeech)
        {
            var trimmed = (value ?? "").Trim().ToLowerInvariant();
            partOfSpeech = trimmed.Length == 0 ? null : trimmed;
            return partOfSpeech == null || PartsOfSpeech.Contains(partOfSpeech);
        }

        public static bool TryParseStatus(string? value, out GlossaryStatus status)
        {
            switch (value?.ToLowerInvariant())
            {
                case "draft": status = GlossaryStatus.Draft; return true;
                case "approved": status = GlossaryStatus.Approved; return true;
                case "deprecated": status = GlossaryStatus.Deprecated; return true;
                default: status = GlossaryStatus.Approved; return false;
            }
        }
    }
}
