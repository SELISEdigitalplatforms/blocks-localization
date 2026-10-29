using Eurolm.DomainService.Repositories;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Eurolm.DomainService.Services
{
    /// <summary>
    /// C# port of the Phase 2 client <c>parseGlossaryMeta</c> (utils/glossary-meta.ts). It must give the
    /// same status, meta and note for every input. Tolerates plain notes, hand-edited or broken JSON and
    /// unknown versions, because the extension and the CLI edit the same field as raw text.
    /// </summary>
    public static class GlossaryMetaParser
    {
        public const string Prefix = "@@glossary-meta:v1@@";

        /// <summary>The anchored pattern is linear and settles within the prefix, so this bound is never reached in practice.</summary>
        private static readonly TimeSpan PrefixMatchTimeout = TimeSpan.FromSeconds(1);

        // [0-9], not \d: JavaScript's \d is ASCII-only, .NET's matches every Unicode digit.
        private static readonly Regex PrefixPattern = new(@"^@@glossary-meta:v([0-9]+)@@", RegexOptions.CultureInvariant, PrefixMatchTimeout);

        public static ParsedGlossaryMeta Parse(string? additionalNote)
        {
            var raw = additionalNote ?? "";
            if (raw.Length == 0)
                return new ParsedGlossaryMeta { Status = GlossaryMetaStatus.Plain, Raw = "" };

            var match = PrefixPattern.Match(raw);
            if (!match.Success)
                return new ParsedGlossaryMeta { Meta = new GlossaryMeta { Note = raw }, Status = GlossaryMetaStatus.Plain, Raw = raw };

            if (match.Groups[1].Value != "1")
                return new ParsedGlossaryMeta { Status = GlossaryMetaStatus.UnsupportedVersion, Raw = raw };

            JsonDocument? document = null;
            try
            {
                document = JsonDocument.Parse(raw[match.Length..]);
            }
            catch (JsonException)
            {
                document = null;
            }

            using (document)
            {
                if (document == null || document.RootElement.ValueKind != JsonValueKind.Object)
                    return new ParsedGlossaryMeta { Meta = new GlossaryMeta { Note = raw }, Status = GlossaryMetaStatus.Corrupt, Raw = raw };

                var data = Properties(document.RootElement);
                var meta = new GlossaryMeta
                {
                    Rule = ToRule(data.GetValueOrDefault("rule")),
                    CaseSensitive = data.TryGetValue("caseSensitive", out var caseSensitive) && caseSensitive.ValueKind == JsonValueKind.True,
                    Variants = ToStringList(data.GetValueOrDefault("variants")),
                    Translations = ToTranslations(data.GetValueOrDefault("translations")),
                    Forbidden = ToForbidden(data.GetValueOrDefault("forbidden"))
                };
                if (data.TryGetValue("note", out var note) && note.ValueKind == JsonValueKind.String)
                {
                    var text = JsText.Trim(note.GetString() ?? "");
                    if (text.Length > 0) meta.Note = text;
                }
                return new ParsedGlossaryMeta { Meta = meta, Status = GlossaryMetaStatus.Structured, Raw = raw };
            }
        }

        /// <summary>Object properties with JavaScript semantics: a repeated key keeps its first position and its last value.</summary>
        private static Dictionary<string, JsonElement> Properties(JsonElement element)
        {
            var result = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
            foreach (var property in element.EnumerateObject())
                result[property.Name] = property.Value;
            return result;
        }

        private static List<KeyValuePair<string, JsonElement>> OrderedProperties(JsonElement element)
        {
            var order = new List<string>();
            var values = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
            foreach (var property in element.EnumerateObject())
            {
                if (!values.ContainsKey(property.Name)) order.Add(property.Name);
                values[property.Name] = property.Value;
            }
            // JavaScript lists integer-like keys first, in ascending order.
            var integerKeys = order.Where(IsArrayIndex).OrderBy(k => uint.Parse(k, System.Globalization.CultureInfo.InvariantCulture));
            return integerKeys.Concat(order.Where(k => !IsArrayIndex(k)))
                .Select(k => new KeyValuePair<string, JsonElement>(k, values[k]))
                .ToList();
        }

        private static bool IsArrayIndex(string key) =>
            key.Length > 0 && key.Length <= 10 && key.All(char.IsAsciiDigit) && (key == "0" || key[0] != '0')
            && uint.TryParse(key, System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture, out var n)
            && n < uint.MaxValue;

        private static GlossaryRule ToRule(JsonElement value) =>
            value.ValueKind != JsonValueKind.String ? GlossaryRule.Translate : value.GetString() switch
            {
                "keep" => GlossaryRule.Keep,
                "forbidden" => GlossaryRule.Forbidden,
                _ => GlossaryRule.Translate
            };

        private static List<string> ToStringList(JsonElement value)
        {
            var result = new List<string>();
            if (value.ValueKind != JsonValueKind.Array) return result;
            foreach (var item in value.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.String) continue;
                var text = JsText.Trim(item.GetString() ?? "");
                if (text.Length > 0) result.Add(text);
            }
            return result;
        }

        private static List<KeyValuePair<string, string>> ToTranslations(JsonElement value)
        {
            var result = new List<KeyValuePair<string, string>>();
            if (value.ValueKind != JsonValueKind.Object) return result;
            foreach (var (code, text) in OrderedProperties(value))
            {
                if (text.ValueKind != JsonValueKind.String) continue;
                var trimmed = JsText.Trim(text.GetString() ?? "");
                if (trimmed.Length > 0) result.Add(new(code, trimmed));
            }
            return result;
        }

        private static List<KeyValuePair<string, List<string>>> ToForbidden(JsonElement value)
        {
            var result = new List<KeyValuePair<string, List<string>>>();
            if (value.ValueKind != JsonValueKind.Object) return result;
            foreach (var (code, list) in OrderedProperties(value))
            {
                var items = ToStringList(list);
                if (items.Count > 0) result.Add(new(code, items));
            }
            return result;
        }
    }
}
