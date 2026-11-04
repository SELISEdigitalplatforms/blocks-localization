namespace Eurolm.DomainService.Services
{
    /// <summary>
    /// JavaScript string semantics the terminology ports must reproduce exactly. JS <c>trim</c>
    /// treats U+FEFF as whitespace and U+0085 as not, the opposite of .NET's <see cref="string.Trim()"/>.
    /// </summary>
    internal static class JsText
    {
        /// <summary>The ECMAScript WhiteSpace and LineTerminator code points (what <c>String.prototype.trim</c> removes).</summary>
        public static bool IsWhiteSpace(char c) => (int)c switch
        {
            0x09 or 0x0A or 0x0B or 0x0C or 0x0D or 0x20 or 0xA0 or 0x1680
                or 0x2028 or 0x2029 or 0x202F or 0x205F or 0x3000 or 0xFEFF => true,
            >= 0x2000 and <= 0x200A => true,
            _ => false
        };

        public static string Trim(string text) => TrimEnd(TrimStart(text));

        public static string TrimStart(string text)
        {
            var start = 0;
            while (start < text.Length && IsWhiteSpace(text[start])) start++;
            return text[start..];
        }

        public static string TrimEnd(string text)
        {
            var end = text.Length;
            while (end > 0 && IsWhiteSpace(text[end - 1])) end--;
            return text[..end];
        }
    }
}
