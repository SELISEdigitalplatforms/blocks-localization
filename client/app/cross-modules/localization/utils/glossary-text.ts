/** Cultures written without spaces between words: terms match as plain substrings. */
export const NO_SPACE_LANGUAGES: readonly string[] = ["zh", "ja", "th", "lo", "km", "my"];

export const isNoSpaceCulture = (culture?: string): boolean =>
  NO_SPACE_LANGUAGES.includes((culture ?? "").split(/[-_]/)[0].toLowerCase());

const LETTER_OR_DIGIT = /[\p{L}\p{M}\p{N}]/u;

const sameCode = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * The entry for `culture`: the exact code, else the same code in another case ("de-de"), else
 * the bare language ("de" for "de-DE"). Same order as the server's `EffectiveTerminology.Find`.
 */
export const findCultureEntry = <T>(
  record: Readonly<Record<string, T>>,
  culture: string,
): T | undefined => {
  if (Object.hasOwn(record, culture)) return record[culture];
  const codes = Object.keys(record);
  const anyCase = codes.find((code) => sameCode(code, culture));
  if (anyCase !== undefined) return record[anyCase];
  const separator = culture.search(/[-_]/);
  if (separator <= 0) return undefined;
  const bare = codes.find((code) => sameCode(code, culture.slice(0, separator)));
  return bare === undefined ? undefined : record[bare];
};

const languageOf = (code: string) => code.split(/[-_]/)[0];

const projectCultureFor = (code: string, cultures: readonly string[]): string | undefined => {
  const anyCase = cultures.find((culture) => sameCode(culture, code));
  if (anyCase !== undefined || /[-_]/.test(code)) return anyCase;
  const sameLanguage = cultures.filter(
    (culture) => /[-_]/.test(culture) && sameCode(languageOf(culture), code),
  );
  return sameLanguage.length === 1 ? sameLanguage[0] : undefined;
};

/**
 * Moves entries stored under another case of a project culture ("de-de"), or under the bare
 * language of exactly one project culture ("de"), onto that culture ("de-DE"), merging with
 * `merge` when both exist. An entry under the exact code wins, then one in another case.
 */
export const alignCultureKeys = <T>(
  record: Readonly<Record<string, T>>,
  cultures: readonly string[],
  merge: (kept: T, moved: T) => T,
): Record<string, T> => {
  const aligned: Record<string, T> = {};
  const rank = (code: string) => {
    if (cultures.includes(code)) return 0;
    return cultures.some((culture) => sameCode(culture, code)) ? 1 : 2;
  };
  const ordered = Object.entries(record)
    .map((entry, index) => ({ entry, index, rank: rank(entry[0]) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ entry }) => entry);
  for (const [code, value] of ordered) {
    const target = projectCultureFor(code, cultures) ?? code;
    aligned[target] = Object.hasOwn(aligned, target) ? merge(aligned[target], value) : value;
  }
  return aligned;
};

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
