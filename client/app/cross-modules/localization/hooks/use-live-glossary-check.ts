/**
 * Live glossary checks while the translator types (Phase 4, on `/Glossary/Match` since Phase 7).
 *
 * - `useSourceGlossaryMatches(options)`: the source's matches from `useGlossaryMatch` (Approved
 *   and Draft terms). Editable sources pass `debounce: true`, so `/Match` is requested only
 *   300 ms after the text stops changing (C18). `[]` while loading or after a failure (C2).
 * - `useLiveGlossaryCheck({ targetText, targetCulture, matches })`: `validateTranslation`
 *   150 ms after typing stops; `checkNow(text)` skips the debounce (after Fix). Draft terms are
 *   checked too and shown with the "Draft term:" prefix (A2).
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  MATCH_DEBOUNCE_MS,
  useGlossaryMatch,
  UseGlossaryMatchOptions,
} from "@blocks-localization/hooks/use-glossary-match";
import { GlossaryMatch } from "@blocks-localization/models/glossary-match";
import {
  GlossaryViolation,
  validateTranslation,
} from "@blocks-localization/utils/glossary-validation";

export const LIVE_CHECK_DEBOUNCE_MS = 150;
export const DRAFT_TERM_PREFIX = "Draft term:";

const NO_MATCHES: GlossaryMatch[] = [];
const NO_VIOLATIONS: GlossaryViolation[] = [];

/** Returns `value` once it has stopped changing for `delayMs`. */
export const useDebouncedValue = <T>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
};

/**
 * The source text's glossary matches. With `debounce`, the text is matched 300 ms after it stops
 * changing; meanwhile the previous matches stay, and `isCurrent` says whether they belong to the
 * text as it is now (highlights must not be drawn on stale offsets).
 */
export const useSourceGlossaryMatches = ({
  debounce = false,
  ...options
}: UseGlossaryMatchOptions & { debounce?: boolean }) => {
  const debouncedText = useDebouncedValue(options.text, debounce ? MATCH_DEBOUNCE_MS : 0);
  const text = debounce ? debouncedText : options.text;
  const { matches, matchedText } = useGlossaryMatch({ ...options, text });
  return { matches, isCurrent: matchedText !== undefined && matchedText === options.text };
};

/** True when the violation's term is a Draft in `matches` (live check only, A2). */
export const isDraftViolation = (violation: GlossaryViolation, matches: GlossaryMatch[]) =>
  matches.some(
    (match) => match.glossary.itemId === violation.glossaryId && match.status === "draft",
  );

interface UseLiveGlossaryCheckOptions {
  targetText: string;
  targetCulture: string;
  /** The source text's matches (Approved and Draft). */
  matches: GlossaryMatch[];
}

/** One instance per target culture. An empty target has no warnings (C5). */
export const useLiveGlossaryCheck = ({
  targetText,
  targetCulture,
  matches,
}: UseLiveGlossaryCheckOptions) => {
  const debouncedText = useDebouncedValue(targetText, LIVE_CHECK_DEBOUNCE_MS);
  // Set by checkNow; used until the debounced text catches up with the same value.
  const [immediateText, setImmediateText] = useState<string | null>(null);
  const checkedText =
    immediateText !== null && immediateText === targetText ? immediateText : debouncedText;
  const checkedMatches = matches.length > 0 ? matches : NO_MATCHES;

  const violations = useMemo(() => {
    if (!targetText.trim() || !checkedText.trim() || checkedMatches.length === 0)
      return NO_VIOLATIONS;
    return validateTranslation(checkedText, checkedMatches, targetCulture);
  }, [checkedText, checkedMatches, targetCulture, targetText]);

  const checkNow = useCallback((text: string) => setImmediateText(text), []);

  return { violations, checkNow };
};
