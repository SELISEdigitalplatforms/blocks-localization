import { useEffect, useRef, useState } from "react";
import { Check, CircleCheck, CircleDashed, Copy, TriangleAlert } from "lucide-react";
import { type TFunction, useT } from "@seliseblocks/genesis-os/i18n";
import { Button } from "@/components/ui-kits/button/button";
import { cn } from "@/lib/utils";
import { useGlossaryRuleLabels } from "@blocks-localization/components/glossary/glossary-rule-badge";
import { GlossaryRowState } from "@blocks-localization/components/glossary/glossary-violation-list";
import { distinctGlossaryMatches } from "@blocks-localization/components/glossary/highlighted-source-text";
import { useLiveGlossaryCheck } from "@blocks-localization/hooks/use-live-glossary-check";
import { GlossaryMatch } from "@blocks-localization/models/glossary-match";
import {
  applyFix,
  canApplyFix,
  getFixReplacement,
  GlossaryViolation,
  hasRuleForCulture,
} from "@blocks-localization/utils/glossary-validation";
import { findCultureEntry } from "@blocks-localization/utils/glossary-text";

const LOCALIZATION_GLOSSARY_MODULE = "localization.glossary";

type TermStatus = "pending" | "followed" | "issue" | "no-value";

/** What the target should contain for one term, read by rule (Phase 2 A9). */
const termGuidance = (t: TFunction, match: GlossaryMatch, targetCulture: string) => {
  switch (match.meta.rule) {
    case "keep":
      return { value: match.surface, note: t("GLOSSARY_TARGET_CHECKLIST.KEEP_AS_WRITTEN") };
    case "forbidden":
      return { value: null, note: t("GLOSSARY_TARGET_CHECKLIST.DO_NOT_USE") };
    default: {
      const value = findCultureEntry(match.meta.translations, targetCulture)?.trim() || null;
      if (value) return { value, note: null };
      const banned = findCultureEntry(match.meta.forbidden, targetCulture) ?? [];
      return {
        value,
        note:
          banned.length > 0
            ? t("GLOSSARY_TARGET_CHECKLIST.NO_TRANSLATION_AVOID", { words: banned.join(", ") })
            : t("GLOSSARY_TARGET_CHECKLIST.NO_TRANSLATION"),
      };
    }
  }
};

/** The short problem line under a term; the term row already shows the expected value. */
const issueText = (t: TFunction, violation: GlossaryViolation, draft: boolean) =>
  draft
    ? `${t("GLOSSARY_TARGET_CHECKLIST.DRAFT_PREFIX")} ${problemText(t, violation)}`
    : problemText(t, violation);

const problemText = (t: TFunction, violation: GlossaryViolation) => {
  switch (violation.kind) {
    case "missing-translation":
      return t("GLOSSARY_TARGET_CHECKLIST.NOT_USED_YET");
    case "missing-keep":
      return t("GLOSSARY_TARGET_CHECKLIST.MISSING_OR_CHANGED", {
        value: violation.expected ?? violation.term,
      });
    default:
      return t("GLOSSARY_TARGET_CHECKLIST.NOT_ALLOWED", {
        value: violation.found ?? violation.term,
      });
  }
};

const LOW_EMPHASIS_CLASS = "text-low-emphasis";

const STATUS_ICON: Record<TermStatus, { Icon: typeof Check; className: string }> = {
  pending: { Icon: CircleDashed, className: LOW_EMPHASIS_CLASS },
  followed: { Icon: CircleCheck, className: "text-success" },
  issue: { Icon: TriangleAlert, className: "text-warning-700" },
  "no-value": { Icon: CircleDashed, className: LOW_EMPHASIS_CLASS },
};

const statusLabel = (t: TFunction, status: TermStatus) => {
  switch (status) {
    case "pending":
      return t("GLOSSARY_TARGET_CHECKLIST.STATUS_PENDING");
    case "followed":
      return t("GLOSSARY_TARGET_CHECKLIST.STATUS_FOLLOWED");
    case "issue":
      return t("GLOSSARY_TARGET_CHECKLIST.STATUS_ISSUE");
    default:
      return t("GLOSSARY_TARGET_CHECKLIST.STATUS_NO_VALUE");
  }
};

const CopyValueButton = ({ value }: Readonly<{ value: string }>) => {
  const { t } = useT(LOCALIZATION_GLOSSARY_MODULE);
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
      aria-label={
        copied
          ? t("GLOSSARY_TARGET_CHECKLIST.COPIED_VALUE", { value })
          : t("GLOSSARY_TARGET_CHECKLIST.COPY_VALUE", { value })
      }
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

const issueCountText = (t: TFunction, count: number) =>
  t("GLOSSARY_TARGET_CHECKLIST.ISSUES", { count });

interface ChecklistCounts {
  terms: number;
  /** Terms the glossary has a rule for in this language (`hasRuleForCulture`). */
  checkable: number;
  issues: number;
}

const nothingToCheckText = (t: TFunction, language: string) =>
  t("GLOSSARY_TARGET_CHECKLIST.NOTHING_TO_CHECK", { language });

/** The announced summary: empty until the row has text and the source has terms. */
const checklistSummary = (
  t: TFunction,
  counts: ChecklistCounts,
  hasText: boolean,
  language: string,
) => {
  if (counts.terms === 0 || !hasText) return "";
  if (counts.checkable === 0) return nothingToCheckText(t, language);
  if (counts.issues > 0) return issueCountText(t, counts.issues);
  return counts.checkable < counts.terms
    ? t("GLOSSARY_TARGET_CHECKLIST.ALL_CHECKED_FOLLOWED")
    : t("GLOSSARY_TARGET_CHECKLIST.ALL_FOLLOWED");
};

/** The visible header hint next to "Glossary". */
const checklistHint = (
  t: TFunction,
  counts: ChecklistCounts,
  hasText: boolean,
  summary: string,
  language: string,
) => {
  if (counts.checkable === 0) return nothingToCheckText(t, language);
  if (!hasText) return t("GLOSSARY_TARGET_CHECKLIST.HINT_USE_TERMS");
  if (counts.issues === 0) return summary;
  return t("GLOSSARY_TARGET_CHECKLIST.HINT_CAN_SAVE", { summary });
};

const termStatus = (checkable: boolean, hasText: boolean, issueCount: number): TermStatus => {
  if (!checkable) return "no-value";
  if (!hasText) return "pending";
  return issueCount > 0 ? "issue" : "followed";
};

interface TermIssueProps {
  violation: GlossaryViolation;
  matches: GlossaryMatch[];
  culture: string;
  draft: boolean;
  disabled: boolean;
  onFix: (violation: GlossaryViolation) => void;
}

const TermIssue = ({
  violation,
  matches,
  culture,
  draft,
  disabled,
  onFix,
}: Readonly<TermIssueProps>) => {
  const { t } = useT(LOCALIZATION_GLOSSARY_MODULE);
  const fixable = canApplyFix(violation, matches, culture);
  const replacement = getFixReplacement(violation, matches, culture);
  return (
    <div className="ml-6 mt-1 flex items-center gap-2">
      <p className="min-w-0 flex-1 break-words text-xs text-warning-700">
        {issueText(t, violation, draft)}
        {fixable &&
          replacement &&
          ` · ${t("GLOSSARY_TARGET_CHECKLIST.USE_REPLACEMENT", { replacement })}`}
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
            onFix(violation);
          }}
        >
          {t("GLOSSARY_TARGET_CHECKLIST.FIX")}
        </Button>
      )}
    </div>
  );
};

interface ChecklistTermProps {
  match: GlossaryMatch;
  culture: string;
  /** This term's violations; shown only once the row has text. */
  violations: GlossaryViolation[];
  matches: GlossaryMatch[];
  hasText: boolean;
  disabled: boolean;
  onFix: (violation: GlossaryViolation) => void;
}

const ChecklistTerm = ({
  match,
  culture,
  violations,
  matches,
  hasText,
  disabled,
  onFix,
}: Readonly<ChecklistTermProps>) => {
  const { t } = useT(LOCALIZATION_GLOSSARY_MODULE);
  const ruleLabels = useGlossaryRuleLabels();
  const { value, note } = termGuidance(t, match, culture);
  const { rule } = match.meta;
  const status = termStatus(hasRuleForCulture(match.meta, culture), hasText, violations.length);
  const { Icon, className: iconClass } = STATUS_ICON[status];
  const label = statusLabel(t, status);
  const noteClass = rule === "forbidden" ? "text-error" : LOW_EMPHASIS_CLASS;
  return (
    <li className="py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className={cn("h-4 w-4 shrink-0", iconClass)} aria-hidden="true" />
        <span className="sr-only">{label}:</span>
        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-sm">
          <span className="text-medium-emphasis">{match.surface}</span>
          {value && rule === "translate" && (
            <>
              <span className="text-low-emphasis" aria-hidden="true">
                →
              </span>
              <span className="sr-only">{t("GLOSSARY_TARGET_CHECKLIST.USE")}</span>
              <span className="break-all font-medium text-high-emphasis">{value}</span>
            </>
          )}
          {note && <span className={cn("text-xs", noteClass)}>· {note}</span>}
          <span className="sr-only">({ruleLabels[rule]})</span>
        </p>
        {value && <CopyValueButton value={value} />}
      </div>
      {hasText &&
        violations.map((violation) => (
          <TermIssue
            key={`${violation.kind}-${violation.found ?? violation.expected ?? ""}`}
            violation={violation}
            matches={matches}
            culture={culture}
            draft={match.status === "draft"}
            disabled={disabled}
            onFix={onFix}
          />
        ))}
    </li>
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
  const { t } = useT(LOCALIZATION_GLOSSARY_MODULE);
  const live = useLiveGlossaryCheck({ targetText, targetCulture, matches: liveMatches });
  const fromSuggestion = row.fromSuggestion;
  const matches = fromSuggestion ? row.matches : liveMatches;
  const culture = fromSuggestion ? row.targetCulture : targetCulture;
  const violations = fromSuggestion ? row.violations : live.violations;
  const suggestionIds = new Set([
    ...row.matches.map((match) => match.glossary.itemId),
    ...row.violations.map((violation) => violation.glossaryId),
  ]);
  const terms = distinctGlossaryMatches(
    fromSuggestion
      ? liveMatches.filter((match) => suggestionIds.has(match.glossary.itemId))
      : liveMatches,
  );
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

  const language = languageName || targetCulture;
  const counts: ChecklistCounts = {
    terms: terms.length,
    checkable: terms.filter((match) => hasRuleForCulture(match.meta, culture)).length,
    issues: issueCount,
  };
  const summary = checklistSummary(t, counts, hasText, language);
  const sectionClass =
    issueCount > 0 && hasText ? "border-warning-200 bg-warning-50" : "border-border bg-muted/30";

  return (
    <div className={cn(terms.length > 0 && "mt-2", className)}>
      {/* Mounted while empty: screen readers announce changes to an existing region. */}
      <output aria-live="polite" className="sr-only">
        {summary}
      </output>
      {terms.length > 0 && (
        <section
          aria-label={t("GLOSSARY_TARGET_CHECKLIST.ARIA_TERMS_FOR", { language })}
          className={cn("rounded-md border px-3 py-2", sectionClass)}
        >
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-xs font-semibold text-medium-emphasis">
              {t("GLOSSARY_TARGET_CHECKLIST.HEADING")}
            </p>
            <p className="text-xs text-low-emphasis" aria-hidden="true">
              {checklistHint(t, counts, hasText, summary, language)}
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
                {t("GLOSSARY_TARGET_CHECKLIST.RETRY")}
              </Button>
            )}
          </div>
          <ul className="divide-y divide-border/60">
            {terms.map((match) => (
              <ChecklistTerm
                key={match.glossary.itemId}
                match={match}
                culture={culture}
                violations={violations.filter(
                  (violation) => violation.glossaryId === match.glossary.itemId,
                )}
                matches={matches}
                hasText={hasText}
                disabled={disabled}
                onFix={fixViolation}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
