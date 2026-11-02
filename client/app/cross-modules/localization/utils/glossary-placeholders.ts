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

const blank = (match: string) => " ".repeat(match.length);

export const maskPlaceholders = (text: string): string => {
  if (!text || !/[{<%]/.test(text)) return text ?? "";
  const masked = text.replaceAll(PLACEHOLDER, blank);
  return ICU_HEADER.test(text) ? masked.replaceAll(ICU_SELECTOR, blank) : masked;
};
