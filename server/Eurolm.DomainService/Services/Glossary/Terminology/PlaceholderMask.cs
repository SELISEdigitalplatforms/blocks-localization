using System.Text.RegularExpressions;

namespace Eurolm.DomainService.Services
{
    /// <summary>
    /// Blanks out placeholders, ICU arguments and markup so glossary terms never match inside them: "{user}",
    /// "{{name}}", "${id}", "{count, number}", the "{count, plural," header and its selectors, HTML tags and
    /// printf specifiers. Each masked UTF-16 unit becomes a space, so offsets into the result are offsets into the
    /// input. ICU branch text ("{# items}") stays matchable. Same patterns as the client (utils/glossary-placeholders.ts).
    /// </summary>
    public static class PlaceholderMask
    {
        private static readonly TimeSpan Timeout = TimeSpan.FromMilliseconds(100);

        private static readonly Regex Placeholder = new(
            @"\{\{[^{}]*\}\}" +
            @"|\$?\{[ \t]*[\p{L}\p{N}_.\-]+[ \t]*(?:,[ \t]*[\p{L}_]+[ \t]*(?:,[^{}]*)?)?\}" +
            @"|\{[ \t]*[\p{L}\p{N}_]+[ \t]*,[ \t]*(?:plural|selectordinal|select)[ \t]*,(?:[ \t]*offset:\d+)?" +
            @"|</?[A-Za-z][^<>]*>" +
            @"|%%|%(?:\d+\$)?[-+0#]*\d*(?:\.\d+)?[sdifuxXoeEgGc@]",
            RegexOptions.CultureInvariant, Timeout);

        private static readonly Regex IcuHeader = new(
            @"\{[ \t]*[\p{L}\p{N}_]+[ \t]*,[ \t]*(?:plural|selectordinal)[ \t]*,", RegexOptions.CultureInvariant, Timeout);

        private static readonly Regex IcuSelector = new(
            @"(?:=\d+|\b(?:zero|one|two|few|many|other))(?=[ \t]*\{)", RegexOptions.CultureInvariant, Timeout);

        public static string Apply(string? text)
        {
            if (string.IsNullOrEmpty(text)) return text ?? "";
            if (text.IndexOfAny(new[] { '{', '<', '%' }) < 0) return text;
            try
            {
                var masked = Placeholder.Replace(text, Blank);
                return IcuHeader.IsMatch(text) ? IcuSelector.Replace(masked, Blank) : masked;
            }
            catch (RegexMatchTimeoutException)
            {
                return text;
            }
        }

        private static string Blank(Match match) => new(' ', match.Length);
    }
}
