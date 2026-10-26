import { GlossaryMeta } from "@blocks-localization/models/glossary-meta";
import { IGlossary } from "@blocks-localization/models/language";
import { parseGlossaryMeta } from "@blocks-localization/utils/glossary-meta";
import { stripRuleMarker } from "@blocks-localization/utils/glossary-rule-marker";

/** "other" is only produced in scopeMode "all". */
export type GlossaryScope = "key" | "module" | "global" | "other";

export interface GlossaryMatch {
  glossary: IGlossary;
  /** parseGlossaryMeta(glossary.additionalNote).meta */
  meta: GlossaryMeta;
  /** stripRuleMarker(glossary.context) */
  definition: string;
  start: number;
  length: number;
  /** The matched source text, as written. */
  surface: string;
  scope: GlossaryScope;
}

export interface MatchOptions {
  sourceCulture: string;
  keyGlossaryIds?: string[];
  moduleId?: string;
  scopeMode: "applicable" | "all";
}

export interface GlossaryMatcher {
  match: (text: string, opts: MatchOptions) => GlossaryMatch[];
}

/** Cultures written without spaces between words: terms match as plain substrings. */
export const NO_SPACE_LANGUAGES: readonly string[] = ["zh", "ja", "th", "lo", "km", "my"];

export const isNoSpaceCulture = (culture?: string): boolean =>
  NO_SPACE_LANGUAGES.includes((culture ?? "").split(/[-_]/)[0].toLowerCase());

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

const SCOPE_RANK: Record<GlossaryScope, number> = { key: 0, module: 1, global: 2, other: 3 };

const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/** The code point ending right before `index`, or "" at the start. */
const charBefore = (text: string, index: number): string => {
  if (index <= 0) return "";
  if (isLowSurrogate(text.charCodeAt(index - 1)) && index >= 2) return text.slice(index - 2, index);
  return text[index - 1];
};

/** The code point starting at `index`, or "" at the end. */
const charAt = (text: string, index: number): string =>
  index < text.length ? String.fromCodePoint(text.codePointAt(index) ?? 0) : "";

/**
 * Word boundaries are checked in code on the neighbouring characters instead of with a
 * regex lookbehind, which throws a SyntaxError on older Safari releases.
 */
export const isWordStart = (text: string, index: number): boolean =>
  !LETTER_OR_DIGIT.test(charBefore(text, index));

const isWordEnd = (text: string, index: number): boolean =>
  !LETTER_OR_DIGIT.test(charAt(text, index));

/** Lower-cases one code point at a time, so both sides fold the same way. */
const foldCase = (value: string) => Array.from(value, (char) => char.toLowerCase()).join("");

/**
 * The folded text plus offset maps in both directions. `toOriginal` is only set where a
 * folded character starts, so a match ending inside a multi-unit lower case is rejected.
 */
const foldWithOffsets = (text: string) => {
  let folded = "";
  const toFolded: number[] = [];
  const toOriginal: (number | undefined)[] = [];
  let index = 0;
  for (const char of text) {
    const lower = char.toLowerCase();
    toFolded[index] = folded.length;
    toOriginal[folded.length] = index;
    folded += lower;
    index += char.length;
  }
  toFolded[index] = folded.length;
  toOriginal[folded.length] = index;
  return { folded, toFolded, toOriginal };
};

interface Entry {
  glossary: IGlossary;
  meta: GlossaryMeta;
  definition: string;
}

interface Alternative {
  /** NFC text; case-folded for the case-insensitive table. */
  key: string;
  entries: Entry[];
}

/**
 * Alternatives keyed by their text (case-folded for the case-insensitive table) and
 * grouped by first character: each group lists the distinct lengths of its alternatives.
 * At a candidate position only that character's group is used, with one
 * map lookup per length, so the cost doesn't grow with the number of terms.
 */
interface AlternativeTable {
  caseInsensitive: boolean;
  lengthsByFirstChar: Map<string, number[]>;
  byKey: Map<string, Alternative>;
}

const createTable = (caseInsensitive: boolean): AlternativeTable => ({
  caseInsensitive,
  lengthsByFirstChar: new Map(),
  byKey: new Map(),
});

const addAlternative = (table: AlternativeTable, text: string, entry: Entry) => {
  const key = table.caseInsensitive ? foldCase(text) : text;
  let alternative = table.byKey.get(key);
  if (!alternative) {
    alternative = { key, entries: [] };
    table.byKey.set(key, alternative);
    const lengths = table.lengthsByFirstChar.get(key[0]);
    if (!lengths) table.lengthsByFirstChar.set(key[0], [key.length]);
    else if (!lengths.includes(key.length)) lengths.push(key.length);
  }
  if (!alternative.entries.includes(entry)) alternative.entries.push(entry);
};

const scopeOf = (glossary: IGlossary, opts: MatchOptions): GlossaryScope | null => {
  if (opts.keyGlossaryIds?.includes(glossary.itemId)) return "key";
  if (opts.moduleId && glossary.moduleIds?.includes(opts.moduleId)) return "module";
  if (glossary.isGlobal) return "global";
  return opts.scopeMode === "all" ? "other" : null;
};

const getAlternatives = (glossary: IGlossary, meta: GlossaryMeta): string[] => {
  const values = [glossary.name ?? "", ...meta.variants]
    .map((value) => value.trim().normalize("NFC"))
    .filter(Boolean);
  return [...new Set(values)];
};

interface Candidate {
  entry: Entry;
  start: number;
  length: number;
  scope: GlossaryScope;
}

const compareCandidates = (a: Candidate, b: Candidate) => {
  if (a.length !== b.length) return b.length - a.length;
  if (a.scope !== b.scope) return SCOPE_RANK[a.scope] - SCOPE_RANK[b.scope];
  if (a.entry.glossary.itemId !== b.entry.glossary.itemId) {
    return a.entry.glossary.itemId < b.entry.glossary.itemId ? -1 : 1;
  }
  return a.start - b.start;
};

/** Longer span wins, then key > module > global > other, then the lower itemId. */
const resolveOverlaps = (candidates: Candidate[]): Candidate[] => {
  const kept: Candidate[] = [];
  for (const candidate of [...candidates].sort(compareCandidates)) {
    const end = candidate.start + candidate.length;
    const overlaps = kept.some(
      (other) => candidate.start < other.start + other.length && other.start < end,
    );
    if (!overlaps) kept.push(candidate);
  }
  return kept.sort((a, b) => a.start - b.start);
};

const createMatcher = (glossaries: IGlossary[]): GlossaryMatcher => {
  const sensitive = createTable(false);
  const insensitive = createTable(true);

  for (const glossary of glossaries) {
    const parsed = parseGlossaryMeta(glossary.additionalNote ?? "");
    if (parsed.status === "unsupported-version") continue;
    const entry: Entry = {
      glossary,
      meta: parsed.meta,
      definition: stripRuleMarker(glossary.context),
    };
    const table = parsed.meta.caseSensitive ? sensitive : insensitive;
    for (const alternative of getAlternatives(glossary, parsed.meta)) {
      addAlternative(table, alternative, entry);
    }
  }

  const collectAt = (
    table: AlternativeTable,
    haystack: string,
    from: number,
    toOriginal: (to: number) => number | undefined,
    text: string,
    index: number,
    wholeWord: boolean,
    opts: MatchOptions,
    into: Candidate[],
  ) => {
    for (const length of table.lengthsByFirstChar.get(haystack[from]) ?? []) {
      if (from + length > haystack.length) continue;
      const alternative = table.byKey.get(haystack.slice(from, from + length));
      if (!alternative) continue;
      const end = toOriginal(from + length);
      if (end === undefined || (wholeWord && !isWordEnd(text, end))) continue;
      for (const entry of alternative.entries) {
        const scope = scopeOf(entry.glossary, opts);
        if (scope) into.push({ entry, start: index, length: end - index, scope });
      }
    }
  };

  return {
    match: (text, opts) => {
      if (!text) return [];
      const wholeWord = !isNoSpaceCulture(opts.sourceCulture);
      // Offsets always refer to the original text; the folded copy is only searched.
      const { folded, toFolded, toOriginal } = foldWithOffsets(text);
      const sameOffset = (to: number) => to;
      const foldedOffset = (to: number) => toOriginal[to];
      const candidates: Candidate[] = [];
      for (let index = 0; index < text.length; index++) {
        if (isLowSurrogate(text.charCodeAt(index))) continue;
        if (wholeWord && !isWordStart(text, index)) continue;
        collectAt(sensitive, text, index, sameOffset, text, index, wholeWord, opts, candidates);
        collectAt(
          insensitive,
          folded,
          toFolded[index],
          foldedOffset,
          text,
          index,
          wholeWord,
          opts,
          candidates,
        );
      }

      return resolveOverlaps(candidates).map(({ entry, start, length, scope }) => ({
        glossary: entry.glossary,
        meta: entry.meta,
        definition: entry.definition,
        start,
        length,
        surface: text.slice(start, start + length),
        scope,
      }));
    },
  };
};

const matcherCache = new WeakMap<IGlossary[], GlossaryMatcher>();

/** Builds (once per array identity) a matcher over each term's name and variants. */
export const buildGlossaryMatcher = (glossaries: IGlossary[]): GlossaryMatcher => {
  const cached = matcherCache.get(glossaries);
  if (cached) return cached;
  const matcher = createMatcher(glossaries);
  matcherCache.set(glossaries, matcher);
  return matcher;
};
