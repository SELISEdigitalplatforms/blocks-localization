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

        private static readonly Regex IcuArgument = new(
            @"\{[ \t]*[\p{L}\p{N}_]+[ \t]*,[ \t]*(plural|selectordinal|select)[ \t]*,(?:[ \t]*offset:\d+)?",
            RegexOptions.CultureInvariant, Timeout);

        private static readonly Regex TagName = new(
            @"^<(/?)([A-Za-z][^\s/<>]*)[^<>]*?(/?)\s*>$", RegexOptions.CultureInvariant, Timeout);

        public static string Apply(string? text)
        {
            if (string.IsNullOrEmpty(text)) return text ?? "";
            if (text.IndexOfAny(new[] { '{', '<', '%' }) < 0) return text;
            try
            {
                var masked = Placeholder.Replace(text, Blank);
                if (IcuHeader.IsMatch(text)) masked = IcuSelector.Replace(masked, Blank);
                return BlankSelectOptions(text, masked);
            }
            catch (RegexMatchTimeoutException)
            {
                return text;
            }
        }

        /// <summary>The placeholders of a text as comparable tokens, sorted (a token used twice appears twice).</summary>
        public static List<string> GetTokens(string? text)
        {
            var tokens = new List<string>();
            if (string.IsNullOrEmpty(text) || text.IndexOfAny(new[] { '{', '<', '%' }) < 0) return tokens;
            try
            {
                var branchOpens = new HashSet<int>();
                foreach (Match argument in IcuArgument.Matches(text))
                    WalkIcuArgument(text, argument.Index + argument.Length, (_, _) => { }, open => branchOpens.Add(open));

                foreach (Match match in Placeholder.Matches(text))
                {
                    if (match.Value == "%%" || branchOpens.Contains(match.Index)) continue;
                    tokens.Add(Token(match.Value));
                }
            }
            catch (RegexMatchTimeoutException)
            {
                return new List<string>();
            }
            tokens.Sort(StringComparer.Ordinal);
            return tokens;
        }

        private static string Token(string value)
        {
            if (value[0] == '%') return value;
            if (value[0] == '<')
            {
                var tag = TagName.Match(value);
                return tag.Success ? $"<{tag.Groups[1].Value}{tag.Groups[2].Value}{tag.Groups[3].Value}>" : value;
            }
            return string.Concat(value.Where(c => !char.IsWhiteSpace(c)));
        }

        private static string BlankSelectOptions(string text, string masked)
        {
            char[]? chars = null;
            foreach (Match argument in IcuArgument.Matches(text))
            {
                if (argument.Groups[1].Value != "select") continue;
                chars ??= masked.ToCharArray();
                WalkIcuArgument(text, argument.Index + argument.Length, (start, length) => Array.Fill(chars, ' ', start, length), _ => { });
            }
            return chars == null ? masked : new string(chars);
        }

        private static void WalkIcuArgument(string text, int start, Action<int, int> onOptionName, Action<int> onBranchOpen)
        {
            var depth = 1;
            var i = start;
            while (i < text.Length && depth > 0)
            {
                var c = text[i];
                if (c == '{')
                {
                    if (depth == 1) onBranchOpen(i);
                    depth++;
                }
                else if (c == '}')
                {
                    depth--;
                }
                else if (depth == 1 && IsWordChar(c))
                {
                    i = ScanOptionName(text, i, onOptionName);
                    continue;
                }
                i++;
            }
        }

        private static int ScanOptionName(string text, int start, Action<int, int> onOptionName)
        {
            var end = start;
            while (end < text.Length && IsWordChar(text[end])) end++;
            var next = end;
            while (next < text.Length && (text[next] == ' ' || text[next] == '\t')) next++;
            if (next < text.Length && text[next] == '{') onOptionName(start, end - start);
            return end;
        }

        private static bool IsWordChar(char c) => char.IsLetter(c) || char.IsNumber(c) || c == '_';

        private static string Blank(Match match) => new(' ', match.Length);
    }
}
