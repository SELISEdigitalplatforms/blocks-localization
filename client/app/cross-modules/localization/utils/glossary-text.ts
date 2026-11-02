/** Cultures written without spaces between words: terms match as plain substrings. */
export const NO_SPACE_LANGUAGES: readonly string[] = ["zh", "ja", "th", "lo", "km", "my"];

export const isNoSpaceCulture = (culture?: string): boolean =>
  NO_SPACE_LANGUAGES.includes((culture ?? "").split(/[-_]/)[0].toLowerCase());

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

const isLowSurrogate = (code: number | undefined) =>
  code !== undefined && code >= 0xdc00 && code <= 0xdfff;

/**
 * True at the second unit of a surrogate pair (or a lone low surrogate). `codePointAt` there
 * returns the low surrogate itself, so this equals a code-unit check.
 */
const isTrailingUnit = (text: string, index: number) => isLowSurrogate(text.codePointAt(index));

/** The code point ending right before `index`, or "" at the start. */
const charBefore = (text: string, index: number): string => {
  if (index <= 0) return "";
  if (isTrailingUnit(text, index - 1) && index >= 2) return text.slice(index - 2, index);
  return text[index - 1];
};

/**
 * Word boundaries are checked in code on the neighbouring characters instead of with a
 * regex lookbehind, which throws a SyntaxError on older Safari releases.
 */
export const isWordStart = (text: string, index: number): boolean =>
  !LETTER_OR_DIGIT.test(charBefore(text, index));

/** Letters and digits from `index` to the end of the word, counted up to `limit` + 1. */
export const wordLettersAfter = (text: string, index: number, limit: number): number => {
  let count = 0;
  let at = index;
  while (at < text.length && count <= limit) {
    const char = String.fromCodePoint(text.codePointAt(at) ?? 0);
    if (!LETTER_OR_DIGIT.test(char)) break;
    count++;
    at += char.length;
  }
  return count;
};

/** The letters and digits of the same word that come before `index`. */
export const wordPrefixBefore = (text: string, index: number): string => {
  let start = index;
  while (start > 0 && !isWordStart(text, start)) start -= charBefore(text, start).length;
  return text.slice(start, index);
};
