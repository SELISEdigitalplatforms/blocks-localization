import { useCallback, useState } from "react";
import { Info, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui-kits/button/button";
import { cn } from "@/lib/utils";
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
}

const EMPTY_ROW: GlossaryRowState = {
  violations: [],
  matches: [],
  targetCulture: "",
  glossaryUnavailable: false,
};

/**
 * `useGlossaryAwareSuggestion` plus per-row (per target language) violation state:
 * `request` stores the outcome's violations, `clearViolations` is for user edits (C11)
 * and `fix` applies a deterministic Fix and re-validates against the same matches.
 */
export const useGlossarySuggestionRows = (options: UseGlossaryAwareSuggestionOptions = {}) => {
  const { suggest, cancel, isPending, enabled } = useGlossaryAwareSuggestion(options);
  const [rows, setRows] = useState<Record<string, GlossaryRowState>>({});

  const request = useCallback(
    async (input: GlossarySuggestionInput): Promise<GlossarySuggestionOutcome> => {
      const outcome = await suggest(input);
      // A stale outcome was superseded by a newer request, so it must not touch the row.
      if (outcome.status !== "stale") {
        const row: GlossaryRowState =
          outcome.status === "success"
            ? {
                violations: outcome.violations,
                matches: outcome.matches,
                targetCulture: input.targetLanguage.languageCode,
                glossaryUnavailable: outcome.glossaryUnavailable,
              }
            : { ...EMPTY_ROW, glossaryUnavailable: outcome.glossaryUnavailable };
        setRows((previous) => ({ ...previous, [input.requestKey]: row }));
      }
      return outcome;
    },
    [suggest],
  );

  const clearViolations = useCallback((requestKey?: string) => {
    setRows((previous) => {
      const keys = requestKey === undefined ? Object.keys(previous) : [requestKey];
      if (!keys.some((key) => previous[key]?.violations.length)) return previous;
      const next = { ...previous };
      for (const key of keys) {
        if (next[key]) next[key] = { ...next[key], violations: [] };
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

  return { request, cancel, isPending, enabled, getRow, clearViolations, fix };
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
  onRetry: () => void;
  className?: string;
}

/** Glossary rule violations of a suggestion, shown directly under the target field. */
export const GlossaryViolationList = ({
  violations,
  matches,
  targetCulture,
  disabled = false,
  onFix,
  onRetry,
  className,
}: GlossaryViolationListProps) => {
  if (violations.length === 0) return null;
  return (
    <output aria-live="polite" className={cn("mt-2 block", className)}>
      <ul className="space-y-1">
        {violations.map((violation) => {
          const fixable = canApplyFix(violation, matches, targetCulture);
          return (
            <li key={violationKey(violation)} className="flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 shrink-0 text-warning-700" aria-hidden="true" />
              <span className="text-sm text-high-emphasis">
                {formatViolationMessage(violation)}
              </span>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto px-1 py-0"
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  if (fixable) onFix(violation);
                  else onRetry();
                }}
              >
                {fixable ? "Fix" : "Retry"}
              </Button>
            </li>
          );
        })}
      </ul>
    </output>
  );
};

/** C6 info line, shown under the Auto-translate button. */
export const GlossaryUnavailableNote = ({ className }: { className?: string }) => (
  <output className={cn("flex items-center gap-1 text-xs text-low-emphasis", className)}>
    <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    {GLOSSARY_UNAVAILABLE_MESSAGE}
  </output>
);
