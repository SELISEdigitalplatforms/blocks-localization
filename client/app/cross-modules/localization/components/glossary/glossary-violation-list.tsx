import { useCallback, useState } from "react";
import { Info, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui-kits/button/button";
import { cn } from "@/lib/utils";
import { useLiveGlossaryCheck } from "@blocks-localization/hooks/use-live-glossary-check";
import {
  GLOSSARY_UNAVAILABLE_MESSAGE,
  GlossarySuggestionInput,
  GlossarySuggestionOutcome,
  useGlossaryAwareSuggestion,
  UseGlossaryAwareSuggestionOptions,
} from "@blocks-localization/hooks/use-glossary-aware-suggestion";
import { GlossaryMatch } from "@blocks-localization/utils/glossary-matcher";
import {
  applyFix,
  canApplyFix,
  formatViolationMessage,
  getFixReplacement,
  GlossaryViolation,
  validateTranslation,
} from "@blocks-localization/utils/glossary-validation";

/** Glossary state of one target-language row after a suggestion. */
export interface GlossaryRowState {
  violations: GlossaryViolation[];
  matches: GlossaryMatch[];
  targetCulture: string;
  /** C6: the glossary failed to load, so the suggestion was made without terminology rules. */
  glossaryUnavailable: boolean;
  /**
   * True from a successful suggestion until the user's first edit of the row: until then the
   * suggestion's violations (with Retry) are shown, afterwards the live check (Phase 4).
   */
  fromSuggestion: boolean;
}

const EMPTY_ROW: GlossaryRowState = {
  violations: [],
  matches: [],
  targetCulture: "",
  glossaryUnavailable: false,
  fromSuggestion: false,
};

/**
 * `useGlossaryAwareSuggestion` plus per-row (per target language) violation state:
 * `request` stores the outcome's violations, `clearViolations` is for user edits (C11)
 * and `fix` applies a deterministic Fix and re-validates against the same matches.
 */
export const useGlossarySuggestionRows = (options: UseGlossaryAwareSuggestionOptions = {}) => {
  const { suggest, cancel, isPending } = useGlossaryAwareSuggestion(options);
  const [rows, setRows] = useState<Record<string, GlossaryRowState>>({});

  const request = useCallback(
    async (input: GlossarySuggestionInput): Promise<GlossarySuggestionOutcome> => {
      const outcome = await suggest(input);
      if (outcome.status !== "stale") {
        const row: GlossaryRowState =
          outcome.status === "success"
            ? {
                violations: outcome.violations,
                matches: outcome.matches,
                targetCulture: input.targetLanguage.languageCode,
                glossaryUnavailable: outcome.glossaryUnavailable,
                fromSuggestion: true,
              }
            : { ...EMPTY_ROW, glossaryUnavailable: outcome.glossaryUnavailable };
        setRows((previous) => ({ ...previous, [input.requestKey]: row }));
      }
      return outcome;
    },
    [suggest],
  );

  /** A user edit: the suggestion's list gives way to the live check. */
  const clearViolations = useCallback((requestKey?: string) => {
    setRows((previous) => {
      const keys = requestKey === undefined ? Object.keys(previous) : [requestKey];
      const isStale = (key: string) =>
        !!previous[key]?.violations.length || !!previous[key]?.fromSuggestion;
      if (!keys.some(isStale)) return previous;
      const next = { ...previous };
      for (const key of keys) {
        if (next[key]) next[key] = { ...next[key], violations: [], fromSuggestion: false };
      }
      return next;
    });
  }, []);

  /** Returns the fixed text (to put in the field), or null when nothing could be replaced. */
  const fix = useCallback(
    (requestKey: string, violation: GlossaryViolation, text: string): string | null => {
      const row = rows[requestKey];
      if (!row) return null;
      const fixed = applyFix(text, violation, row.matches, row.targetCulture);
      if (fixed === null) return null;
      const violations = validateTranslation(fixed, row.matches, row.targetCulture);
      setRows((previous) => ({ ...previous, [requestKey]: { ...row, violations } }));
      return fixed;
    },
    [rows],
  );

  const getRow = useCallback(
    (requestKey: string): GlossaryRowState => rows[requestKey] ?? EMPTY_ROW,
    [rows],
  );

  return { request, cancel, isPending, getRow, clearViolations, fix };
};

const violationKey = (violation: GlossaryViolation) =>
  `${violation.glossaryId}-${violation.kind}-${violation.found ?? violation.expected ?? ""}`;

interface GlossaryViolationListProps {
  violations: GlossaryViolation[];
  matches: GlossaryMatch[];
  targetCulture: string;
  /** Disables Fix and Retry while the row's suggestion is running. */
  disabled?: boolean;
  onFix: (violation: GlossaryViolation) => void;
  /** Without it (live warnings) a violation with no deterministic Fix has no button. */
  onRetry?: () => void;
  className?: string;
}

/**
 * Glossary rule violations of a suggestion, shown directly under the target field. The
 * polite live region stays mounted (empty and visually hidden) while there are no violations:
 * screen readers announce content added to an existing region, not a region that is inserted
 * already filled.
 */
export const GlossaryViolationList = ({
  violations,
  matches,
  targetCulture,
  disabled = false,
  onFix,
  onRetry,
  className,
}: GlossaryViolationListProps) => {
  const hasViolations = violations.length > 0;
  const count = violations.length;
  return (
    <output
      aria-live="polite"
      className={
        hasViolations
          ? cn("mt-2 block rounded-md border border-warning-200 bg-warning-50 px-3 py-2", className)
          : "sr-only"
      }
    >
      {hasViolations && (
        <>
          <p className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-warning-700" aria-hidden="true" />
            <span className="font-semibold text-high-emphasis">
              {count === 1 ? "1 glossary issue" : `${count} glossary issues`}
            </span>
            <span className="text-medium-emphasis">You can still save.</span>
          </p>
          <ul className="space-y-1.5">
            {violations.map((violation) => {
              const replacement = getFixReplacement(violation, matches, targetCulture);
              const fixable = canApplyFix(violation, matches, targetCulture);
              const showAction = fixable || !!onRetry;
              return (
                <li key={violationKey(violation)} className="flex items-start gap-2">
                  <span
                    className="mt-2 h-1 w-1 shrink-0 rounded-full bg-warning-700"
                    aria-hidden="true"
                  />
                  <p className="min-w-0 flex-1 break-words">
                    <span className="text-sm text-high-emphasis">
                      {formatViolationMessage(violation)}
                    </span>
                    {fixable && replacement && (
                      <span className="text-sm text-medium-emphasis"> · use “{replacement}”</span>
                    )}
                  </p>
                  {showAction && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 bg-background px-2.5 text-xs"
                      disabled={disabled}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (fixable) onFix(violation);
                        else onRetry?.();
                      }}
                    >
                      {fixable ? "Fix" : "Retry"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </output>
  );
};

interface GlossaryTargetChecksProps {
  /** The row's suggestion state (`useGlossarySuggestionRows().getRow`). */
  row: GlossaryRowState;
  targetText: string;
  targetCulture: string;
  /** Applicable matches of the current source text, for the live check. */
  liveMatches: GlossaryMatch[];
  disabled?: boolean;
  /** Fix of a suggestion violation (re-validated against the suggestion's matches). */
  onSuggestionFix: (violation: GlossaryViolation) => void;
  onRetry: () => void;
  /** Writes a live Fix result into the field. */
  onLiveFix: (fixed: string) => void;
  className?: string;
}

/**
 * The violation list under one target field. Right after a suggestion it shows that
 * suggestion's violations (with Retry); from the user's first edit on it shows the live
 * check (no Retry), and Fix recomputes it at once. Warnings never block saving.
 */
export const GlossaryTargetChecks = ({
  row,
  targetText,
  targetCulture,
  liveMatches,
  disabled,
  onSuggestionFix,
  onRetry,
  onLiveFix,
  className,
}: GlossaryTargetChecksProps) => {
  const { violations, checkNow } = useLiveGlossaryCheck({
    targetText,
    targetCulture,
    matches: liveMatches,
  });

  if (row.fromSuggestion) {
    return (
      <GlossaryViolationList
        className={className}
        violations={row.violations}
        matches={row.matches}
        targetCulture={row.targetCulture}
        disabled={disabled}
        onFix={onSuggestionFix}
        onRetry={onRetry}
      />
    );
  }

  return (
    <GlossaryViolationList
      className={className}
      violations={violations}
      matches={liveMatches}
      targetCulture={targetCulture}
      disabled={disabled}
      onFix={(violation) => {
        const fixed = applyFix(targetText, violation, liveMatches, targetCulture);
        if (fixed === null) return;
        onLiveFix(fixed);
        checkNow(fixed);
      }}
    />
  );
};

/** C6 info line, shown under the Auto-translate button. */
export const GlossaryUnavailableNote = ({ className }: { className?: string }) => (
  <output className={cn("flex items-center gap-1 text-xs text-low-emphasis", className)}>
    <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    {GLOSSARY_UNAVAILABLE_MESSAGE}
  </output>
);
