import { ReactNode } from "react";
import { useT } from "@seliseblocks/genesis-os/i18n";

import { useGlossaryRuleLabels } from "@blocks-localization/components/glossary/glossary-rule-badge";
import GlossaryTermPopover, {
  isGlossaryMatchUsed,
  TermTargetLanguage,
} from "@blocks-localization/components/glossary/glossary-term-popover";
import { cn } from "@/lib/utils";
import { GlossaryMatch } from "@blocks-localization/models/glossary-match";
import { hasRuleForCulture } from "@blocks-localization/utils/glossary-validation";

const TERM_CLASS =
  "cursor-pointer rounded-sm bg-transparent p-0 text-inherit underline decoration-dotted decoration-2 underline-offset-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
/** A term the glossary can apply to the target language. */
const ACTIVE_TERM_CLASS =
  "decoration-primary/70 hover:bg-primary/10 hover:decoration-primary data-[state=open]:bg-primary/10 data-[state=open]:decoration-primary";
/** Already in the target text: nothing left to do for it. */
const USED_TERM_CLASS =
  "decoration-success/80 decoration-solid hover:bg-success/10 hover:decoration-success data-[state=open]:bg-success/10";
/** No rule for the target language: still explorable, but visibly nothing to apply. */
const INACTIVE_TERM_CLASS =
  "decoration-low-emphasis/50 hover:bg-muted hover:decoration-low-emphasis data-[state=open]:bg-muted";

const termStateClass = (used: boolean, inactive: boolean) => {
  if (used) return USED_TERM_CLASS;
  return inactive ? INACTIVE_TERM_CLASS : ACTIVE_TERM_CLASS;
};

interface HighlightedSourceTextProps {
  text: string;
  /** `/Glossary/Match` matches of exactly `text`; empty while loading or after a failure (C2). */
  matches: GlossaryMatch[];
  targetLanguage?: TermTargetLanguage;
  /** The current target text, so used terms are marked and Insert can say "Already used". */
  targetText?: string;
  onInsert?: (value: string, replacing?: string) => void;
}

/**
 * Static source text with each matched term as a dotted-underlined button that opens the
 * term popover. The text content stays exactly `text`.
 */
export const HighlightedSourceText = ({
  text,
  matches,
  targetLanguage,
  targetText,
  onInsert,
}: Readonly<HighlightedSourceTextProps>) => {
  const { t } = useT("localization.glossary");
  const ruleLabels = useGlossaryRuleLabels();
  if (matches.length === 0) return <>{text}</>;

  const termLabel = (match: GlossaryMatch, used: boolean, missingFor?: string) => {
    if (used)
      return t("HIGHLIGHTED_SOURCE_TEXT.ARIA_TERM_USED", {
        term: match.surface,
        rule: ruleLabels[match.meta.rule],
      });
    return missingFor
      ? t("HIGHLIGHTED_SOURCE_TEXT.ARIA_TERM_MISSING", {
          term: match.surface,
          rule: ruleLabels[match.meta.rule],
          language: missingFor,
        })
      : t("HIGHLIGHTED_SOURCE_TEXT.ARIA_TERM", {
          term: match.surface,
          rule: ruleLabels[match.meta.rule],
        });
  };

  const parts: ReactNode[] = [];
  let cursor = 0;
  // Offsets come from the server: out-of-range or overlapping matches are left as plain text.
  for (const match of [...matches].sort((a, b) => a.start - b.start)) {
    if (match.start < cursor || match.length <= 0 || match.start + match.length > text.length)
      continue;
    if (match.start > cursor) parts.push(text.slice(cursor, match.start));
    const inactive =
      !!targetLanguage && !hasRuleForCulture(match.meta, targetLanguage.languageCode);
    const used =
      !!targetLanguage && isGlossaryMatchUsed(match, targetText ?? "", targetLanguage.languageCode);
    parts.push(
      <GlossaryTermPopover
        key={`${match.start}-${match.glossary.itemId}`}
        match={match}
        targetLanguage={targetLanguage}
        targetText={targetText}
        onInsert={onInsert}
      >
        <button
          type="button"
          aria-label={termLabel(
            match,
            used,
            inactive ? targetLanguage?.languageName || targetLanguage?.languageCode : undefined,
          )}
          className={cn(TERM_CLASS, termStateClass(used, inactive))}
        >
          {text.slice(match.start, match.start + match.length)}
        </button>
      </GlossaryTermPopover>,
    );
    cursor = match.start + match.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
};

/** The first match of each glossary, in source order. */
export const distinctGlossaryMatches = (matches: GlossaryMatch[]): GlossaryMatch[] => {
  const seen = new Set<string>();
  return matches.filter((match) => {
    if (seen.has(match.glossary.itemId)) return false;
    seen.add(match.glossary.itemId);
    return true;
  });
};
