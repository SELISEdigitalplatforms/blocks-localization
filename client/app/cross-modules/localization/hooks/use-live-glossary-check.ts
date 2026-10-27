/**
 * Live glossary checks while the translator types (Phase 4).
 *
 * - `useLoadedGlossaries(loadGlossaries)`: resolves the shared `useLoadAllGlossaries` loader
 *   once per loader. `undefined` while loading or after a failure (C2: plain text, no warnings,
 *   no toast). Uses no query itself, so it works wherever the loader is passed as a prop.
 * - `useApplicableGlossaryMatches(glossaries, opts)`: the memoized Phase 3 matcher in
 *   `applicable` scope; `[]` until the glossary is loaded.
 * - `useLiveGlossaryCheck({ targetText, targetCulture, matches })`: `validateTranslation`
 *   150 ms after typing stops; `checkNow(text)` skips the debounce (after Fix).
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import { IGlossary } from "@blocks-localization/models/language";
import {
  buildGlossaryMatcher,
  GlossaryMatch,
  MatchOptions,
} from "@blocks-localization/utils/glossary-matcher";
import {
  GlossaryViolation,
  validateTranslation,
} from "@blocks-localization/utils/glossary-validation";

export const LIVE_CHECK_DEBOUNCE_MS = 150;

const NO_MATCHES: GlossaryMatch[] = [];
const NO_VIOLATIONS: GlossaryViolation[] = [];

export const useLoadedGlossaries = (
  loadGlossaries?: () => Promise<IGlossary[]>,
): IGlossary[] | undefined => {
  const [loaded, setLoaded] = useState<{
    loader?: () => Promise<IGlossary[]>;
    glossaries?: IGlossary[];
  }>({});

  useEffect(() => {
    if (!loadGlossaries) return;
    let active = true;
    loadGlossaries().then(
      (glossaries) => {
        if (active) setLoaded({ loader: loadGlossaries, glossaries });
      },
      () => {
        if (active) setLoaded({ loader: loadGlossaries });
      },
    );
    return () => {
      active = false;
    };
  }, [loadGlossaries]);

  return loaded.loader === loadGlossaries ? loaded.glossaries : undefined;
};

/** Returns `value` once it has stopped changing for `delayMs`. */
export const useDebouncedValue = <T>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
};

export const useApplicableGlossaryMatches = (
  glossaries: IGlossary[] | undefined,
  text: string,
  { sourceCulture, keyGlossaryIds, moduleId }: Omit<MatchOptions, "scopeMode">,
): GlossaryMatch[] => {
  // Joined so a new array with the same ids doesn't recompute.
  const keyIds = (keyGlossaryIds ?? []).join("\u0000");
  return useMemo(() => {
    if (!glossaries?.length || !text.trim()) return NO_MATCHES;
    return buildGlossaryMatcher(glossaries).match(text, {
      scopeMode: "applicable",
      sourceCulture,
      keyGlossaryIds: keyIds ? keyIds.split("\u0000") : [],
      moduleId,
    });
  }, [glossaries, text, sourceCulture, keyIds, moduleId]);
};

interface UseLiveGlossaryCheckOptions {
  targetText: string;
  targetCulture: string;
  /** The applicable matches of the current source text. */
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

  const violations = useMemo(() => {
    if (!targetText.trim() || !checkedText.trim() || matches.length === 0) return NO_VIOLATIONS;
    return validateTranslation(checkedText, matches, targetCulture);
  }, [checkedText, matches, targetCulture, targetText]);

  const checkNow = useCallback((text: string) => setImmediateText(text), []);

  return { violations, checkNow };
};
