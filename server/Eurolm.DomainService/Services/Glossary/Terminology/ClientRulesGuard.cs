namespace Eurolm.DomainService.Services
{
    /// <summary>
    /// Detects a suggestion request whose ElementDetailContext ends with a complete Phase 3 client terminology
    /// block (DATA CONTRACTS › Flag › Client-rules guard, A8). Such a request uses today's prompt path.
    /// The line formats are a contract with the client's <c>render</c> (utils/translation-prompt.ts) and
    /// <c>buildCorrectionPrompt</c> (utils/glossary-validation.ts). One pass over the lines, no regex, so the
    /// cost stays linear in the context length.
    /// </summary>
    public static class ClientRulesGuard
    {
        private static readonly string[][] RuleLineTemplates =
        {
            new[] { "- Translate \"", "\" as \"", "\"." },
            new[] { "- Keep \"", "\" exactly as written; do not translate it." },
            new[] { "- Do not use \"", "\" in the translation." },
            new[] { "- Never use \"", "\"." }
        };

        private static readonly string[][] CorrectionLineTemplates =
        {
            new[] { "- Use \"", "\" for \"", "\"." },
            new[] { "- Keep \"", "\" exactly as written." },
            new[] { "- Do not use \"", "\"." }
        };

        public static bool IsClientRuled(string? elementDetailContext)
        {
            if (string.IsNullOrEmpty(elementDetailContext)) return false;

            var lines = elementDetailContext.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n');
            var count = lines.Length;
            // A single trailing empty line from the final "\n" is allowed.
            if (count > 0 && lines[count - 1].Length == 0) count--;

            // 1. The last heading line, preceded by an empty line.
            var heading = -1;
            for (var i = count - 1; i >= 0; i--)
            {
                if (lines[i] == TerminologyPromptBuilder.RulesHeading)
                {
                    heading = i;
                    break;
                }
            }
            if (heading < 1 || lines[heading - 1].Length != 0) return false;

            // 2. One or more rule lines.
            var index = heading + 1;
            var start = index;
            while (index < count && MatchesAny(lines[index], RuleLineTemplates)) index++;
            if (index == start) return false;

            // 3. Optional meaning section: the heading, then one or more "- <term>: <definition>" lines.
            if (index < count && lines[index] == TerminologyPromptBuilder.MeaningHeading)
            {
                index++;
                start = index;
                while (index < count && IsMeaningLine(lines[index])) index++;
                if (index == start) return false;
            }

            // 4. Optional correction section (the client's retry).
            if (index < count && lines[index] == TerminologyPromptBuilder.CorrectionHeading)
            {
                index++;
                start = index;
                while (index < count && MatchesAny(lines[index], CorrectionLineTemplates)) index++;
                if (index == start) return false;
                if (index >= count || lines[index] != TerminologyPromptBuilder.CorrectionFooter) return false;
                index++;
            }

            // 5. Nothing else may follow.
            return index == count;
        }

        private static bool MatchesAny(string line, string[][] templates)
        {
            foreach (var template in templates)
            {
                if (MatchesTemplate(line, template)) return true;
            }
            return false;
        }

        /// <summary>
        /// The literals in order, with one or more characters other than <c>"</c> between consecutive literals.
        /// Every literal after a value starts with <c>"</c>, so each value ends at the next quote.
        /// </summary>
        private static bool MatchesTemplate(string line, string[] literals)
        {
            var position = 0;
            for (var i = 0; i < literals.Length; i++)
            {
                if (line.Length - position < literals[i].Length
                    || string.CompareOrdinal(line, position, literals[i], 0, literals[i].Length) != 0)
                {
                    return false;
                }
                position += literals[i].Length;
                if (i == literals.Length - 1) break;

                var quote = line.IndexOf('"', position);
                if (quote <= position) return false;
                position = quote;
            }
            return position == line.Length;
        }

        /// <summary><c>- &lt;term&gt;: &lt;definition&gt;</c> with both parts non-empty.</summary>
        private static bool IsMeaningLine(string line)
        {
            if (line.Length < 6 || !line.StartsWith("- ", StringComparison.Ordinal)) return false;
            for (var at = line.IndexOf(": ", 3, StringComparison.Ordinal); at != -1; at = line.IndexOf(": ", at + 1, StringComparison.Ordinal))
            {
                if (at + 2 < line.Length) return true;
            }
            return false;
        }
    }
}
