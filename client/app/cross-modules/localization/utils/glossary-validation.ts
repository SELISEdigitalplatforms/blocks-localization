import { GLOSSARY_LIMITS } from "@blocks-localization/constants/glossary-limits";
import { GlossaryMatch } from "@blocks-localization/models/glossary-match";
import { GlossaryMeta } from "@blocks-localization/models/glossary-meta";
import { maskPlaceholders } from "@blocks-localization/utils/glossary-placeholders";
import { normalizeGlossaryName } from "@blocks-localization/utils/glossary-name";
import {
  findCultureEntry,
  isNoSpaceCulture,
  isWordStart,
  wordLettersAfter,
  wordPrefixBefore,
} from "@blocks-localization/utils/glossary-text";

export const TRANSLATION_LENGTH_ERROR = `Translation must be ${GLOSSARY_LIMITS.value} characters or fewer`;
export const FORBIDDEN_TRANSLATION_ERROR = "A translation can't also be forbidden";

/** True when the forbidden `value` is the translation itself (case-insensitive, NFC). */
export const isForbiddenTranslation = (value: string, translation: string | undefined) => {
  const normalizedTranslation = normalizeGlossaryName(translation ?? "");
  return !!normalizedTranslation && normalizeGlossaryName(value) === normalizedTranslation;
};

/** The editor's checks of one Translate-rule translation; inline edits reuse them. */
export const getTranslationError = (
  translation: string,
  forbiddenValues: string[],
): string | undefined => {
  if (translation.trim().length > GLOSSARY_LIMITS.value) return TRANSLATION_LENGTH_ERROR;
  if (forbiddenValues.some((value) => isForbiddenTranslation(value, translation))) {
    return FORBIDDEN_TRANSLATION_ERROR;
  }
  return undefined;
};

/**
 * Whether the glossary says anything for this language: Keep and Forbidden always do; a
 * translate term needs an approved value or banned words for the culture. Without one there
 * is nothing to apply or check, so UI must not offer Insert or report the term as followed.
 */
export const hasRuleForCulture = (meta: GlossaryMeta, culture: string): boolean =>
  meta.rule !== "translate" ||
  !!findCultureEntry(meta.translations, culture)?.trim() ||
  (findCultureEntry(meta.forbidden, culture)?.length ?? 0) > 0;

export type GlossaryViolationKind = "missing-translation" | "missing-keep" | "forbidden-used";

export interface GlossaryViolation {
  glossaryId: string;
  term: string;
  kind: GlossaryViolationKind;
  /** missing-translation: the approved value; missing-keep: the source surface to keep. */
  expected?: string;
  /** forbidden-used: the text as it appears in the output. */
  found?: string;
}

interface MatchedGlossaryGroup {
  matches: GlossaryMatch[];
  /** Distinct matched source surfaces, in first-occurrence order. */
  surfaces: string[];
}

/** Matches grouped per glossary in first-occurrence order. */
const groupMatchesByGlossary = (matches: GlossaryMatch[]): MatchedGlossaryGroup[] => {
  const groups = new Map<string, MatchedGlossaryGroup>();
  for (const match of [...matches].sort((a, b) => a.start - b.start)) {
    const id = match.glossary.itemId;
    let group = groups.get(id);
    if (!group) {
      group = { matches: [], surfaces: [] };
      groups.set(id, group);
    }
    group.matches.push(match);
    if (!group.surfaces.includes(match.surface)) group.surfaces.push(match.surface);
  }
  return [...groups.values()];
};

interface Occurrence {
  start: number;
  length: number;
}

/**
 * Lower-cases one code point at a time. `map` gives the original index only where a lowered
 * code point starts, so a match starting or ending inside a case expansion is
 * rejected instead of covering half a character.
 */
const lowerWithMap = (text: string, locale: string) => {
  let lowered = "";
  const map: (number | undefined)[] = [];
  let index = 0;
  for (const char of text) {
    map[lowered.length] = index;
    lowered += lowerChar(char, locale);
    index += char.length;
  }
  map[lowered.length] = index;
  return { lowered, map };
};

/**
 * The Greek final sigma "ς" folds to "σ" (same length), as "Σ" lowers to "σ" on its own. "İ"
 * lowers to "i" in every locale, as the server's culture lowering does.
 */
const lowerChar = (char: string, locale: string) => {
  if (char === "İ") return "i";
  const lower = safeLower(char, locale);
  return lower === "ς" ? "σ" : lower;
};

const safeLower = (value: string, locale: string) => {
  try {
    return value.toLocaleLowerCase(locale || undefined);
  } catch {
    return value.toLowerCase();
  }
};

type FindOptions = { caseInsensitive: boolean; targetCulture: string; anywhere?: boolean };

/** Every occurrence of `value` in `text` (see `findInTarget`), in order. */
const findAllInTarget = (text: string, value: string, options: FindOptions): Occurrence[] => {
  const needle = value.normalize("NFC");
  if (!needle || !text) return [];
  const substring = options.anywhere || isNoSpaceCulture(options.targetCulture);
  const occurrences: Occurrence[] = [];

  if (!options.caseInsensitive) {
    for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
      if (substring || isWordStart(text, at))
        occurrences.push({ start: at, length: needle.length });
    }
    return occurrences;
  }

  const { lowered, map } = lowerWithMap(text, options.targetCulture);
  const loweredNeedle = lowerWithMap(needle, options.targetCulture).lowered;
  for (
    let at = lowered.indexOf(loweredNeedle);
    at !== -1;
    at = lowered.indexOf(loweredNeedle, at + 1)
  ) {
    const start = map[at];
    const end = map[at + loweredNeedle.length];
    if (start === undefined || end === undefined) continue;
    if (substring || isWordStart(text, start)) occurrences.push({ start, length: end - start });
  }
  return occurrences;
};

/**
 * Arabic letters written onto the next word: a conjunction (و, ف), then a preposition (ب, ك, ل),
 * then the article ال; ل followed by ال is written لل.
 */
const ARABIC_PROCLITICS = /^[وف]?(?:[بكل]?ال|لل|[بكل])?$/u;
/** Hebrew prefix letters (ו, ה, ב, כ, ל, מ, ש), up to three, written onto the next word. */
const HEBREW_PROCLITICS = /^[והבכלמש]{0,3}$/u;
/** Languages that write compounds as one word ("Standardarbeitsbereich"). */
const COMPOUNDING_LANGUAGES: ReadonlySet<string> = new Set([
  "de",
  "nl",
  "sv",
  "da",
  "nb",
  "nn",
  "no",
  "is",
  "fo",
  "fi",
  "et",
  "af",
  "lb",
  "fy",
]);
/** A shorter approved translation must start a word, so "Tag" is not found inside "Vertrag". */
export const MIN_COMPOUND_PART_LENGTH = 4;

/** How the approved value may be attached to the end of a word in the target language. */
const attachmentOf = (
  approved: string,
  targetCulture: string,
): { core: string; allowsPrefix: (prefix: string) => boolean } | null => {
  const language = targetCulture.split(/[-_]/)[0].toLowerCase();
  if (language === "ar") {
    // The article may be dropped or replaced by a preposition contraction: "الحساب" in "للحساب".
    const core = approved.startsWith("ال") && approved.length > 3 ? approved.slice(2) : approved;
    return { core, allowsPrefix: (prefix) => ARABIC_PROCLITICS.test(prefix) };
  }
  if (language === "he" || language === "iw") {
    return { core: approved, allowsPrefix: (prefix) => HEBREW_PROCLITICS.test(prefix) };
  }
  if (COMPOUNDING_LANGUAGES.has(language) && [...approved].length >= MIN_COMPOUND_PART_LENGTH) {
    return { core: approved, allowsPrefix: () => true };
  }
  return null;
};

/** `containsApprovedTranslation` on a text whose placeholders are already masked. */
const containsApprovedIn = (searchable: string, approved: string, targetCulture: string) => {
  const options: FindOptions = { caseInsensitive: true, targetCulture };
  if (findAllInTarget(searchable, approved, options).length > 0) return true;
  const attachment = attachmentOf(approved.normalize("NFC").trim(), targetCulture);
  if (!attachment) return false;
  return findAllInTarget(searchable, attachment.core, { ...options, anywhere: true }).some(
    (occurrence) => attachment.allowsPrefix(wordPrefixBefore(searchable, occurrence.start)),
  );
};

/**
 * True when the approved translation is used in `text`: where it starts a word (inflected
 * endings allowed, A11), or attached to the end of a word the target language builds that
 * way — a compound ("Standardarbeitsbereich") or Arabic/Hebrew prefix letters ("بالحساب").
 * Same rule as the server's `TranslationValidator.ContainsApprovedTranslation`.
 */
export const containsApprovedTranslation = (
  text: string,
  approved: string,
  targetCulture: string,
): boolean =>
  containsApprovedIn(maskPlaceholders((text ?? "").normalize("NFC")), approved, targetCulture);

/** A shorter forbidden value must be a whole word, so "App" does not flag "Application". */
export const MIN_INFLECTED_FORBIDDEN_LENGTH = 4;
/** Letters a longer forbidden value may take as an inflected ending ("Werkbereichs"). */
export const MAX_FORBIDDEN_ENDING = 3;

/**
 * True when a forbidden `value` found at `occurrence` also ends there: a whole word, or (for a
 * value of MIN_INFLECTED_FORBIDDEN_LENGTH letters or more) one followed by at most
 * MAX_FORBIDDEN_ENDING letters. No-space languages: always. Same rule as the server's
 * `TranslationValidator.EndsForbiddenWord`.
 */
const endsForbiddenWord = (
  text: string,
  occurrence: Occurrence,
  value: string,
  targetCulture: string,
) => {
  if (isNoSpaceCulture(targetCulture)) return true;
  const ending = wordLettersAfter(text, occurrence.start + occurrence.length, MAX_FORBIDDEN_ENDING);
  if (ending === 0) return true;
  return (
    ending <= MAX_FORBIDDEN_ENDING &&
    [...value.normalize("NFC")].length >= MIN_INFLECTED_FORBIDDEN_LENGTH
  );
};

const isWithin = (inner: Occurrence, outer: Occurrence) =>
  inner.start >= outer.start && inner.start + inner.length <= outer.start + outer.length;

/**
 * Finds `value` in `text` where it starts a word; trailing letters are allowed so
 * inflected forms ("Arbeitsbereichs") count (A11). No-space languages: plain substring.
 * Returns the first occurrence as offsets into `text`. Never inside a placeholder or tag.
 */
export const findInTarget = (
  text: string,
  value: string,
  options: FindOptions,
): Occurrence | null => findAllInTarget(maskPlaceholders(text), value, options)[0] ?? null;

const alternativesOf = (match: GlossaryMatch) =>
  [match.glossary.name ?? "", ...match.meta.variants].map((value) => value.trim()).filter(Boolean);

type FindValue = (value: string, caseInsensitive: boolean) => Occurrence[];
type ContainsApproved = (value: string) => boolean;

type ViolationBase = Pick<GlossaryViolation, "glossaryId" | "term">;

/** Keep rule: every matched source surface must appear unchanged. */
const keepViolations = (
  surfaces: Iterable<string>,
  base: ViolationBase,
  find: FindValue,
): GlossaryViolation[] => {
  const violations: GlossaryViolation[] = [];
  for (const surface of surfaces) {
    if (find(surface, false).length === 0)
      violations.push({ ...base, kind: "missing-keep", expected: surface });
  }
  return violations;
};

/** Translate rule: the approved value for the target culture must appear. */
const translationViolations = (
  match: GlossaryMatch,
  targetCulture: string,
  base: ViolationBase,
  containsApproved: ContainsApproved,
): GlossaryViolation[] => {
  const expected = findCultureEntry(match.meta.translations, targetCulture)?.trim();
  if (!expected || containsApproved(expected)) return [];
  return [{ ...base, kind: "missing-translation", expected }];
};

/**
 * Forbidden rule: the term and its variants. Translate or forbidden rule: the stored
 * forbidden values. Longest first, so "Dashboards" isn't also reported as "Dashboard".
 * An occurrence inside the approved translation ("Portal" in "Portalseite") is not a use.
 */
const forbiddenViolations = (
  text: string,
  match: GlossaryMatch,
  targetCulture: string,
  base: ViolationBase,
  find: FindValue,
  findBanned: FindValue,
): GlossaryViolation[] => {
  const { meta } = match;
  const banned = [
    ...(meta.rule === "forbidden"
      ? alternativesOf(match).map((value) => ({ value, caseInsensitive: !meta.caseSensitive }))
      : []),
    ...(findCultureEntry(meta.forbidden, targetCulture) ?? []).map((value) => ({
      value,
      caseInsensitive: true,
    })),
  ].sort((a, b) => b.value.length - a.value.length);
  const approved =
    meta.rule === "translate" ? findCultureEntry(meta.translations, targetCulture)?.trim() : "";
  const approvedSpans = approved ? find(approved, true) : [];
  const violations: GlossaryViolation[] = [];
  const reportedStarts = new Set<number>();
  for (const { value, caseInsensitive } of banned) {
    const occurrence = findBanned(value, caseInsensitive).find(
      (candidate) => !approvedSpans.some((span) => isWithin(candidate, span)),
    );
    if (!occurrence || reportedStarts.has(occurrence.start)) continue;
    reportedStarts.add(occurrence.start);
    violations.push({
      ...base,
      kind: "forbidden-used",
      found: text.slice(occurrence.start, occurrence.start + occurrence.length),
    });
  }
  return violations;
};

/** All violations of one glossary's rule, before de-duplication. */
const glossaryViolations = (
  text: string,
  { matches: glossaryMatches, surfaces }: MatchedGlossaryGroup,
  targetCulture: string,
  find: FindValue,
  findBanned: FindValue,
  containsApproved: ContainsApproved,
): GlossaryViolation[] => {
  const [match] = glossaryMatches;
  const { glossary, meta } = match;
  const base: ViolationBase = { glossaryId: glossary.itemId, term: glossary.name };
  if (meta.rule === "keep") return keepViolations(surfaces, base, find);
  return [
    ...(meta.rule === "translate"
      ? translationViolations(match, targetCulture, base, containsApproved)
      : []),
    ...forbiddenViolations(text, match, targetCulture, base, find, findBanned),
  ];
};

/**
 * Checks an AI output against the rules of the matched glossaries (only the values that
 * are active for each rule, C18). One violation per (glossary, kind, found/expected).
 */
export const validateTranslation = (
  output: string,
  matches: GlossaryMatch[],
  targetCulture: string,
): GlossaryViolation[] => {
  const text = (output ?? "").normalize("NFC");
  if (!text.trim()) return [];

  // Searched with placeholders and tags blanked out (same offsets); reported from the real text.
  const searchable = maskPlaceholders(text);
  const find: FindValue = (value, caseInsensitive) =>
    findAllInTarget(searchable, value, { caseInsensitive, targetCulture });
  const findBanned: FindValue = (value, caseInsensitive) =>
    find(value, caseInsensitive).filter((occurrence) =>
      endsForbiddenWord(searchable, occurrence, value, targetCulture),
    );
  const containsApproved: ContainsApproved = (value) =>
    containsApprovedIn(searchable, value, targetCulture);
  const violations: GlossaryViolation[] = [];
  const seen = new Set<string>();
  for (const group of groupMatchesByGlossary(matches)) {
    for (const violation of glossaryViolations(
      text,
      group,
      targetCulture,
      find,
      findBanned,
      containsApproved,
    )) {
      const id = [
        violation.glossaryId,
        violation.kind,
        violation.found ?? violation.expected ?? "",
      ].join("\u0000");
      if (seen.has(id)) continue;
      seen.add(id);
      violations.push(violation);
    }
  }
  return violations;
};

const findGlossaryMatch = (matches: GlossaryMatch[], glossaryId: string) =>
  matches.find((match) => match.glossary.itemId === glossaryId);

/** The approved translation Fix would insert, or null when no deterministic fix exists (A5). */
export const getFixReplacement = (
  violation: GlossaryViolation,
  matches: GlossaryMatch[],
  targetCulture: string,
): string | null => {
  if (violation.kind !== "forbidden-used" || !violation.found) return null;
  const match = findGlossaryMatch(matches, violation.glossaryId);
  if (match?.meta.rule !== "translate") return null;
  return findCultureEntry(match.meta.translations, targetCulture)?.trim() || null;
};

export const canApplyFix = (
  violation: GlossaryViolation,
  matches: GlossaryMatch[],
  targetCulture: string,
): boolean => getFixReplacement(violation, matches, targetCulture) !== null;

/**
 * Fix for a forbidden-used violation: replaces the first case-insensitive occurrence of
 * the found span (preferring one at a word start) with the approved translation. Letters
 * after the span stay, so "Werkbereichs" becomes "Arbeitsbereichs". An occurrence inside
 * the approved translation is never replaced ("Portalseite" stays). Returns null when the
 * violation has no deterministic fix or the text no longer contains the span outside the
 * approved translation. Re-validate the result with `validateTranslation`.
 */
export const applyFix = (
  text: string,
  violation: GlossaryViolation,
  matches: GlossaryMatch[],
  targetCulture: string,
): string | null => {
  const replacement = getFixReplacement(violation, matches, targetCulture);
  if (!replacement || !violation.found) return null;
  const normalized = (text ?? "").normalize("NFC");
  // Placeholders and tags are never rewritten ("{user}" stays "{user}").
  const searchable = maskPlaceholders(normalized);
  const options: FindOptions = { caseInsensitive: true, targetCulture };
  const approvedSpans = findAllInTarget(searchable, replacement, { ...options, anywhere: true });
  const replaceable = (candidate: Occurrence) =>
    !approvedSpans.some((span) => isWithin(candidate, span));
  const occurrence =
    findAllInTarget(searchable, violation.found, options).find(replaceable) ??
    findAllInTarget(searchable, violation.found, { ...options, anywhere: true }).find(replaceable);
  if (!occurrence) return null;
  return (
    normalized.slice(0, occurrence.start) +
    replacement +
    normalized.slice(occurrence.start + occurrence.length)
  );
};

export const formatViolationMessage = (violation: GlossaryViolation): string => {
  switch (violation.kind) {
    case "missing-translation":
      return `Expected "${violation.expected ?? ""}" for "${violation.term}"`;
    case "missing-keep":
      return `Keep "${violation.expected ?? violation.term}" unchanged`;
    default:
      return `"${violation.found ?? violation.term}" is not allowed`;
  }
};
