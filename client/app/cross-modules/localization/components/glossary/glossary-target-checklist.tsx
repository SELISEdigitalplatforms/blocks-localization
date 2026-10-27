import { useEffect, useRef, useState } from "react";
import { Check, CircleCheck, CircleDashed, Copy, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui-kits/button/button";
import { cn } from "@/lib/utils";
import { GLOSSARY_RULE_LABELS } from "@blocks-localization/components/glossary/glossary-rule-badge";
import { GlossaryRowState } from "@blocks-localization/components/glossary/glossary-violation-list";
import { distinctGlossaryMatches } from "@blocks-localization/components/glossary/highlighted-source-text";
import { useLiveGlossaryCheck } from "@blocks-localization/hooks/use-live-glossary-check";
import { GlossaryMatch } from "@blocks-localization/utils/glossary-matcher";
import {
  applyFix,
  canApplyFix,
  getFixReplacement,
  GlossaryViolation,
} from "@blocks-localization/utils/glossary-validation";

type TermStatus = "pending" | "followed" | "issue" | "no-value";

/** What the target should contain for one term, read by rule (Phase 2 A9). */
const termGuidance = (match: GlossaryMatch, targetCulture: string) => {
  switch (match.meta.rule) {
    case "keep":
      return { value: match.surface, note: "Keep as written" };
    case "forbidden":
      return { value: null, note: "Do not use" };
    default: {
      const value = match.meta.translations[targetCulture]?.trim() || null;
      return { value, note: value ? null : "No translation in the glossary" };
    }
  }
};

/** The short problem line under a term; the term row already shows the expected value. */
const issueText = (violation: GlossaryViolation) => {
  switch (violation.kind) {
    case "missing-translation":
      return "Not used yet";
    case "missing-keep":
      return `"${violation.expected ?? violation.term}" is missing or changed`;
    default:
      return `"${violation.found ?? violation.term}" is not allowed`;
  }
};

const STATUS_ICON: Record<TermStatus, { Icon: typeof Check; className: string; label: string }> = {
  pending: { Icon: CircleDashed, className: "text-low-emphasis", label: "Not checked yet" },
  followed: { Icon: CircleCheck, className: "text-success", label: "Followed" },
  issue: { Icon: TriangleAlert, className: "text-warning-700", label: "Needs attention" },
  "no-value": { Icon: CircleDashed, className: "text-low-emphasis", label: "No rule to check" },
};

const CopyValueButton = ({ value }: Readonly<{ value: string }>) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = () => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-6 w-6 shrink-0 p-0 text-low-emphasis hover:text-high-emphasis"
      aria-label={copied ? `Copied "${value}"` : `Copy "${value}"`}
      onClick={(event) => {
        event.stopPropagation();
        copy();
      }}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </Button>
  );
};

interface GlossaryTargetChecklistProps {
  /** The row's suggestion state (`useGlossarySuggestionRows().getRow`). */
  row: GlossaryRowState;
  targetText: string;
  targetCulture: string;
  /** Names the list for screen readers ("Glossary terms for German"). */
  languageName?: string;
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
 * The glossary terms of the source, checked against one target language: what to write for
 * each term and whether this translation follows it. Used where every language is edited
 * at once (inline editor, new-key screen), so each row carries its own status instead of a
 * shared Insert. Right after a suggestion it shows that suggestion's result (with Retry);
 * from the user's first edit on it follows the live check. Issues never block saving.
 */
export const GlossaryTargetChecklist = ({
  row,
  targetText,
  targetCulture,
  languageName,
  liveMatches,
  disabled = false,
  onSuggestionFix,
  onRetry,
  onLiveFix,
  className,
}: Readonly<GlossaryTargetChecklistProps>) => {
  const live = useLiveGlossaryCheck({ targetText, targetCulture, matches: liveMatches });
  const fromSuggestion = row.fromSuggestion;
  const matches = fromSuggestion ? row.matches : liveMatches;
  const culture = fromSuggestion ? row.targetCulture : targetCulture;
  const violations = fromSuggestion ? row.violations : live.violations;
  const terms = distinctGlossaryMatches(matches);
  const hasText = !!targetText.trim();
  const issueCount = violations.length;
  const canRetry = fromSuggestion && violations.some((v) => !canApplyFix(v, matches, culture));

  const fixViolation = (violation: GlossaryViolation) => {
    if (fromSuggestion) {
      onSuggestionFix(violation);
      return;
    }
    const fixed = applyFix(targetText, violation, liveMatches, targetCulture);
    if (fixed === null) return;
    onLiveFix(fixed);
    live.checkNow(fixed);
  };

  let summary = "";
  if (terms.length > 0 && hasText) {
    summary =
      issueCount === 0
        ? "All glossary terms followed"
        : `${issueCount === 1 ? "1 glossary issue" : `${issueCount} glossary issues`}`;
  }

  return (
    <div className={cn(terms.length > 0 && "mt-2", className)}>
      {/* Mounted while empty: screen readers announce changes to an existing region. */}
      <output aria-live="polite" className="sr-only">
        {summary}
      </output>
      {terms.length > 0 && (
        <section
          aria-label={`Glossary terms for ${languageName || targetCulture}`}
          className={cn(
            "rounded-md border px-3 py-2",
            issueCount > 0 && hasText
              ? "border-warning-200 bg-warning-50"
              : "border-border bg-muted/30",
          )}
        >
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-xs font-semibold text-medium-emphasis">Glossary</p>
            <p className="text-xs text-low-emphasis" aria-hidden="true">
              {hasText
                ? summary + (issueCount > 0 ? " · you can still save" : "")
                : "Use these terms in this translation"}
            </p>
            {canRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-auto h-6 bg-background px-2 text-xs"
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  onRetry();
                }}
              >
                Retry
              </Button>
            )}
          </div>
          <ul className="divide-y divide-border/60">
            {terms.map((match) => {
              const { value, note } = termGuidance(match, culture);
              const termViolations = violations.filter(
                (violation) => violation.glossaryId === match.glossary.itemId,
              );
              let status: TermStatus = "pending";
              if (!value && match.meta.rule === "translate") status = "no-value";
              else if (hasText) status = termViolations.length > 0 ? "issue" : "followed";
              const { Icon, className: iconClass, label } = STATUS_ICON[status];
              return (
                <li key={match.glossary.itemId} className="py-1.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className={cn("h-4 w-4 shrink-0", iconClass)} aria-hidden="true" />
                    <span className="sr-only">{label}:</span>
                    <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-sm">
                      <span className="text-medium-emphasis">{match.surface}</span>
                      {value && match.meta.rule === "translate" && (
                        <>
                          <span className="text-low-emphasis" aria-hidden="true">
                            →
                          </span>
                          <span className="sr-only">use</span>
                          <span className="break-all font-medium text-high-emphasis">{value}</span>
                        </>
                      )}
                      {note && (
                        <span
                          className={cn(
                            "text-xs",
                            match.meta.rule === "forbidden" ? "text-error" : "text-low-emphasis",
                          )}
                        >
                          · {note}
                        </span>
                      )}
                      <span className="sr-only">({GLOSSARY_RULE_LABELS[match.meta.rule]})</span>
                    </p>
                    {value && <CopyValueButton value={value} />}
                  </div>
                  {hasText &&
                    termViolations.map((violation) => {
                      const fixable = canApplyFix(violation, matches, culture);
                      const replacement = getFixReplacement(violation, matches, culture);
                      return (
                        <div
                          key={`${violation.kind}-${violation.found ?? violation.expected ?? ""}`}
                          className="ml-6 mt-1 flex items-center gap-2"
                        >
                          <p className="min-w-0 flex-1 break-words text-xs text-warning-700">
                            {issueText(violation)}
                            {fixable && replacement && ` · use "${replacement}"`}
                          </p>
                          {fixable && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 shrink-0 bg-background px-2 text-xs"
                              disabled={disabled}
                              onClick={(event) => {
                                event.stopPropagation();
                                fixViolation(violation);
                              }}
                            >
                              Fix
                            </Button>
                          )}
                        </div>
                      );
                    })}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
};
