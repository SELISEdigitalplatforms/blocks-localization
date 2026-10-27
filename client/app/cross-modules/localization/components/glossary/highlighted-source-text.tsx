import { ReactNode } from "react";

import { GLOSSARY_RULE_LABELS } from "@blocks-localization/components/glossary/glossary-rule-badge";
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
  /** The current target text, so Insert can say "Already used". */
  targetText?: string;
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
  targetText,
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
        targetText={targetText}
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
