import { ReactNode } from "react";

import { Button } from "@/components/ui-kits/button/button";
import {
  GLOSSARY_RULE_LABELS,
  GlossaryRuleIcon,
} from "@blocks-localization/components/glossary/glossary-rule-badge";
import GlossaryTermPopover, {
  TermTargetLanguage,
} from "@blocks-localization/components/glossary/glossary-term-popover";
import { GlossaryMatch } from "@blocks-localization/utils/glossary-matcher";

const termLabel = (match: GlossaryMatch) =>
  `Glossary term ${match.surface}: ${GLOSSARY_RULE_LABELS[match.meta.rule]}`;

interface HighlightedSourceTextProps {
  text: string;
  /** `useApplicableGlossaryMatches` of `text`; empty while the glossary loads or failed (C2). */
  matches: GlossaryMatch[];
  targetLanguage?: TermTargetLanguage;
  onInsert?: (value: string) => void;
}

/**
 * Static source text with each matched term as a dotted-underlined button that opens the
 * term popover. The text content stays exactly `text`.
 */
export const HighlightedSourceText = ({
  text,
  matches,
  targetLanguage,
  onInsert,
}: Readonly<HighlightedSourceTextProps>) => {
  if (matches.length === 0) return <>{text}</>;

  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) continue;
    if (match.start > cursor) parts.push(text.slice(cursor, match.start));
    parts.push(
      <GlossaryTermPopover
        key={`${match.start}-${match.glossary.itemId}`}
        match={match}
        targetLanguage={targetLanguage}
        onInsert={onInsert}
      >
        <button
          type="button"
          aria-label={termLabel(match)}
          className="cursor-pointer rounded-sm bg-transparent p-0 text-inherit underline decoration-primary/70 decoration-dotted decoration-2 underline-offset-4 transition-colors hover:bg-primary/10 hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-primary/10 data-[state=open]:decoration-primary"
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

interface GlossaryTermChipsProps {
  /** Matches of the (debounced) editable source; the row is hidden when empty. */
  matches: GlossaryMatch[];
  /** The last-focused target row's language, or the first target row's. */
  getTargetLanguage: () => TermTargetLanguage | undefined;
  onInsert?: (value: string) => void;
  className?: string;
}

/**
 * "Glossary terms" chips for editors whose source is an editable field, where inline
 * highlights are impossible (A5). One chip per distinct glossary; each opens the popover.
 */
export const GlossaryTermChips = ({
  matches,
  getTargetLanguage,
  onInsert,
  className,
}: Readonly<GlossaryTermChipsProps>) => {
  const distinct = distinctGlossaryMatches(matches);
  if (distinct.length === 0) return null;
  const targetLanguage = getTargetLanguage();
  return (
    <div className={className}>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-xs font-medium text-medium-emphasis">Glossary terms</p>
        {onInsert && targetLanguage?.languageName && (
          <p className="text-xs text-low-emphasis">Insert goes to {targetLanguage.languageName}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {distinct.map((match) => (
          <GlossaryTermPopover
            key={match.glossary.itemId}
            match={match}
            targetLanguage={targetLanguage}
            showInsertTarget
            onInsert={onInsert}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 max-w-full gap-1.5 rounded-full px-2.5 text-xs font-normal text-high-emphasis data-[state=open]:border-primary data-[state=open]:bg-primary/10"
              aria-label={termLabel(match)}
              onClick={(event) => event.stopPropagation()}
            >
              <GlossaryRuleIcon rule={match.meta.rule} className="text-medium-emphasis" />
              <span className="truncate">{match.surface}</span>
            </Button>
          </GlossaryTermPopover>
        ))}
      </div>
    </div>
  );
};
