import {
  GlossaryMatch,
  isNoSpaceCulture,
  isWordStart,
} from "@blocks-localization/utils/glossary-matcher";
import {
  groupMatchesByGlossary,
  sanitizePromptText,
} from "@blocks-localization/utils/translation-prompt";

export type GlossaryViolationKind = "missing-translation" | "missing-keep" | "forbidden-used";

export interface GlossaryViolation {
  glossaryId: string;
  /** The glossary name. */
  term: string;
  kind: GlossaryViolationKind;
  /** missing-translation: the approved value; missing-keep: the source surface to keep. */
  expected?: string;
  /** forbidden-used: the text as it appears in the output. */
  found?: string;
}

interface Occurrence {
  start: number;
  length: number;
}

/** Lower-cases one code point at a time and maps every lowered index back to the original. */
const lowerWithMap = (text: string, locale: string) => {
  let lowered = "";
  const map: number[] = [];
  let index = 0;
  for (const char of text) {
    const lower = safeLower(char, locale);
    // One entry per UTF-16 unit of `lower`, so not a for-of (that iterates code points).
    map.push(...new Array<number>(lower.length).fill(index));
    lowered += lower;
    index += char.length;
  }
  map.push(index);
  return { lowered, map };
};

const safeLower = (value: string, locale: string) => {
  try {
    return value.toLocaleLowerCase(locale || undefined);
  } catch {
    return value.toLowerCase();
  }
};

/**
 * Finds `value` in `text` where it starts a word; trailing letters are allowed so
 * inflected forms ("Arbeitsbereichs") count (A11). No-space languages: plain substring.
 * Returns the first occurrence as offsets into `text`.
 */
export const findInTarget = (
  text: string,
  value: string,
  options: { caseInsensitive: boolean; targetCulture: string; anywhere?: boolean },
): Occurrence | null => {
  const needle = value.normalize("NFC");
  if (!needle || !text) return null;
  const substring = options.anywhere || isNoSpaceCulture(options.targetCulture);

  if (!options.caseInsensitive) {
    for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
      if (substring || isWordStart(text, at)) return { start: at, length: needle.length };
    }
    return null;
  }

  const { lowered, map } = lowerWithMap(text, options.targetCulture);
  const loweredNeedle = lowerWithMap(needle, options.targetCulture).lowered;
  for (
    let at = lowered.indexOf(loweredNeedle);
    at !== -1;
    at = lowered.indexOf(loweredNeedle, at + 1)
  ) {
    const start = map[at];
    if (substring || isWordStart(text, start)) {
      return { start, length: map[at + loweredNeedle.length] - start };
    }
  }
  return null;
};

const alternativesOf = (match: GlossaryMatch) =>
  [match.glossary.name ?? "", ...match.meta.variants].map((value) => value.trim()).filter(Boolean);

type ViolationBase = Pick<GlossaryViolation, "glossaryId" | "term">;

/** What every rule check of one `validateTranslation` call shares. */
interface RuleCheck {
  text: string;
  targetCulture: string;
  contains: (value: string, caseInsensitive: boolean) => Occurrence | null;
  add: (violation: GlossaryViolation) => void;
}

/** Keep rule: every matched source surface must appear unchanged. */
const checkKeep = (surfaces: string[], base: ViolationBase, { contains, add }: RuleCheck) => {
  for (const surface of surfaces) {
    if (!contains(surface, false)) add({ ...base, kind: "missing-keep", expected: surface });
  }
};

/** Translate rule: the approved translation for the target culture must appear. */
const checkTranslation = (
  match: GlossaryMatch,
  base: ViolationBase,
  { targetCulture, contains, add }: RuleCheck,
) => {
  const expected = match.meta.translations[targetCulture]?.trim();
  if (expected && !contains(expected, true)) {
    add({ ...base, kind: "missing-translation", expected });
  }
};

/**
 * Forbidden rule: the term and its variants. Translate or forbidden rule: the stored
 * forbidden values. Longest first, so "Dashboards" isn't also reported as "Dashboard".
 */
const checkForbidden = (
  match: GlossaryMatch,
  base: ViolationBase,
  { text, targetCulture, contains, add }: RuleCheck,
) => {
  const { meta } = match;
  const banned = [
    ...(meta.rule === "forbidden"
      ? alternativesOf(match).map((value) => ({ value, caseInsensitive: !meta.caseSensitive }))
      : []),
    ...(meta.forbidden[targetCulture] ?? []).map((value) => ({ value, caseInsensitive: true })),
  ].sort((a, b) => b.value.length - a.value.length);
  const reportedStarts = new Set<number>();
  for (const { value, caseInsensitive } of banned) {
    const occurrence = contains(value, caseInsensitive);
    if (!occurrence || reportedStarts.has(occurrence.start)) continue;
    reportedStarts.add(occurrence.start);
    add({
      ...base,
      kind: "forbidden-used",
      found: text.slice(occurrence.start, occurrence.start + occurrence.length),
    });
  }
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

  const violations: GlossaryViolation[] = [];
  const seen = new Set<string>();
  const check: RuleCheck = {
    text,
    targetCulture,
    contains: (value, caseInsensitive) =>
      findInTarget(text, value, { caseInsensitive, targetCulture }),
    add: (violation) => {
      const id = [
        violation.glossaryId,
        violation.kind,
        violation.found ?? violation.expected ?? "",
      ].join("\u0000");
      if (seen.has(id)) return;
      seen.add(id);
      violations.push(violation);
    },
  };

  for (const { matches: glossaryMatches, surfaces } of groupMatchesByGlossary(matches)) {
    const [match] = glossaryMatches;
    const base: ViolationBase = { glossaryId: match.glossary.itemId, term: match.glossary.name };

    if (match.meta.rule === "keep") {
      checkKeep(surfaces, base, check);
      continue;
    }
    if (match.meta.rule === "translate") checkTranslation(match, base, check);
    checkForbidden(match, base, check);
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
  return match.meta.translations[targetCulture]?.trim() || null;
};

export const canApplyFix = (
  violation: GlossaryViolation,
  matches: GlossaryMatch[],
  targetCulture: string,
): boolean => getFixReplacement(violation, matches, targetCulture) !== null;

/**
 * Fix for a forbidden-used violation: replaces the first case-insensitive occurrence of
 * the found span (preferring one at a word start) with the approved translation. Letters
 * after the span stay, so "Werkbereichs" becomes "Arbeitsbereichs". Returns null when the
 * violation has no deterministic fix or the text no longer contains the span. Re-validate
 * the result with `validateTranslation`.
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
  const occurrence =
    findInTarget(normalized, violation.found, { caseInsensitive: true, targetCulture }) ??
    findInTarget(normalized, violation.found, {
      caseInsensitive: true,
      targetCulture,
      anywhere: true,
    });
  if (!occurrence) return null;
  return (
    normalized.slice(0, occurrence.start) +
    replacement +
    normalized.slice(occurrence.start + occurrence.length)
  );
};

/** The message shown under the field for a violation. */
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

/** The correction appended to the prompt for the single retry. */
export const buildCorrectionPrompt = (prompt: string, violations: GlossaryViolation[]): string => {
  const lines = violations.map((violation) => {
    const term = sanitizePromptText(violation.term);
    switch (violation.kind) {
      case "missing-translation":
        return `- Use "${sanitizePromptText(violation.expected)}" for "${term}".`;
      case "missing-keep":
        return `- Keep "${sanitizePromptText(violation.expected) || term}" exactly as written.`;
      default:
        return `- Do not use "${sanitizePromptText(violation.found)}".`;
    }
  });
  return `${prompt}CORRECTION: Your previous answer broke these rules:\n${lines
    .map((line) => `${line}\n`)
    .join("")}Return only the corrected translation.\n`;
};
