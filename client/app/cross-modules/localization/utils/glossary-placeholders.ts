/**
 * Blanks out placeholders, ICU arguments and markup so glossary values never match inside
 * them: "{user}", "{{name}}", "${id}", "{count, number}", the "{count, plural," header and its
 * selectors, HTML tags and printf specifiers. Each masked UTF-16 unit becomes a space, so
 * offsets into the result are offsets into the input. ICU branch text ("{# items}") stays
 * matchable. Same patterns as the server (Terminology/PlaceholderMask.cs).
 */
const PLACEHOLDER = new RegExp(
  [
    String.raw`\{\{[^{}]*\}\}`,
    String.raw`\$?\{[ \t]*[\p{L}\p{N}_.\-]+[ \t]*(?:,[ \t]*[\p{L}_]+[ \t]*(?:,[^{}]*)?)?\}`,
    String.raw`\{[ \t]*[\p{L}\p{N}_]+[ \t]*,[ \t]*(?:plural|selectordinal|select)[ \t]*,(?:[ \t]*offset:\d+)?`,
    String.raw`<\/?[A-Za-z][^<>]*>`,
    String.raw`%%|%(?:\d+\$)?[-+0#]*\d*(?:\.\d+)?[sdifuxXoeEgGc@]`,
  ].join("|"),
  "gu",
);

const ICU_HEADER = /\{[ \t]*[\p{L}\p{N}_]+[ \t]*,[ \t]*(?:plural|selectordinal)[ \t]*,/u;

const ICU_SELECTOR = /(?:=\d+|\b(?:zero|one|two|few|many|other))(?=[ \t]*\{)/gu;

const ICU_SELECT_HEADER = /\{[ \t]*[\p{L}\p{N}_]+[ \t]*,[ \t]*select[ \t]*,/gu;

const OPTION_WORD = /[\p{L}\p{N}_]+/uy;

const BEFORE_BRANCH = /[ \t]*\{/y;

const blank = (match: string) => " ".repeat(match.length);

const blankSelectOptions = (text: string, masked: string): string => {
  const headers = [...text.matchAll(ICU_SELECT_HEADER)];
  if (headers.length === 0) return masked;
  const units = masked.split("");
  for (const header of headers) {
    let depth = 1;
    let i = header.index + header[0].length;
    while (i < text.length && depth > 0) {
      const char = text[i];
      if (char === "{") depth++;
      else if (char === "}") depth--;
      else if (depth === 1) {
        OPTION_WORD.lastIndex = i;
        const word = OPTION_WORD.exec(text);
        if (word) {
          const end = i + word[0].length;
          BEFORE_BRANCH.lastIndex = end;
          if (BEFORE_BRANCH.test(text)) units.fill(" ", i, end);
          i = end;
          continue;
        }
      }
      i++;
    }
  }
  return units.join("");
};

export const maskPlaceholders = (text: string): string => {
  if (!text || !/[{<%]/.test(text)) return text ?? "";
  let masked = text.replaceAll(PLACEHOLDER, blank);
  if (ICU_HEADER.test(text)) masked = masked.replaceAll(ICU_SELECTOR, blank);
  return blankSelectOptions(text, masked);
};
