import { ReactElement, ReactNode, useRef, useState } from "react";
import { Ban, Check, ExternalLink } from "lucide-react";
import { useScopedPath } from "@seliseblocks/genesis-os";

import { Button } from "@/components/ui-kits/button/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import GlossaryRuleBadge from "@blocks-localization/components/glossary/glossary-rule-badge";
import GlossaryStatusBadge from "@blocks-localization/components/glossary/glossary-status-badge";
import { GlossaryMatch } from "@blocks-localization/models/glossary-match";
import { GlossaryMeta } from "@blocks-localization/models/glossary-meta";
import { ILanguageConfig } from "@blocks-localization/models/language";
import { findInTarget } from "@blocks-localization/utils/glossary-validation";

export type TermTargetLanguage = Pick<ILanguageConfig, "languageCode" | "languageName">;

/**
 * What the popover shows and Insert inserts, read by rule (Phase 2 A9): translations are
 * active only for `translate`, so a Keep or Forbidden term's leftover values are ignored.
 */
export type GlossaryTermValue =
  | { kind: "translate"; value: string }
  /** No approved value for the culture; its banned words still apply. */
  | { kind: "missing"; alsoAvoid: string[] }
  | { kind: "keep"; value: string }
  | { kind: "forbidden"; alsoAvoid: string[] };

export const getGlossaryTermValue = (
  meta: GlossaryMeta,
  surface: string,
  targetCulture: string,
): GlossaryTermValue => {
  if (meta.rule === "keep") return { kind: "keep", value: surface };
  if (meta.rule === "forbidden") {
    return { kind: "forbidden", alsoAvoid: meta.forbidden[targetCulture] ?? [] };
  }
  const value = meta.translations[targetCulture]?.trim();
  return value
    ? { kind: "translate", value }
    : { kind: "missing", alsoAvoid: meta.forbidden[targetCulture] ?? [] };
};

const ValueCaption = ({ children }: Readonly<{ children: ReactNode }>) => (
  <p className="text-xs font-medium text-low-emphasis">{children}</p>
);

const AlsoAvoid = ({ values }: Readonly<{ values: string[] }>) =>
  values.length > 0 ? (
    <div className="space-y-1">
      <ValueCaption>Also avoid</ValueCaption>
      <ul className="flex flex-wrap gap-1">
        {values.map((value) => (
          <li
            key={value}
            className="rounded border border-border px-1.5 py-0.5 text-xs text-medium-emphasis line-through decoration-error/60"
          >
            {value}
          </li>
        ))}
      </ul>
    </div>
  ) : null;

/** The answer the translator came for: what to write in the target language. */
const TermValue = ({ term, language }: Readonly<{ term: GlossaryTermValue; language: string }>) => {
  switch (term.kind) {
    case "translate":
      return (
        <div className="space-y-0.5">
          <ValueCaption>{language}</ValueCaption>
          <p className="break-words text-base font-semibold text-high-emphasis">{term.value}</p>
        </div>
      );
    case "missing":
      return (
        <div className="space-y-1.5">
          <div className="space-y-0.5">
            <ValueCaption>{language}</ValueCaption>
            <p className="text-sm text-medium-emphasis">
              The glossary has no {language} translation for this term yet.
            </p>
          </div>
          <AlsoAvoid values={term.alsoAvoid} />
        </div>
      );
    case "keep":
      return (
        <div className="space-y-0.5">
          <ValueCaption>Keep as written</ValueCaption>
          <p className="break-words text-base font-semibold text-high-emphasis">{term.value}</p>
        </div>
      );
    default:
      return (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-error">
            <Ban className="h-4 w-4 shrink-0" aria-hidden="true" />
            Do not use
          </p>
          <AlsoAvoid values={term.alsoAvoid} />
        </div>
      );
  }
};

interface GlossaryTermPopoverProps {
  match: GlossaryMatch;
  /** The editor's target language: the value shown and inserted is for this culture. */
  targetLanguage?: TermTargetLanguage;
  /** The current target text: Insert is disabled when the value is already in it. */
  targetText?: string;
  onInsert?: (value: string) => void;
  /** The trigger (a highlighted term or a chip); it gets focus back on Escape. */
  children: ReactElement;
}

export const DRAFT_TERM_NOTICE = "Draft: not sent to the AI";

const GlossaryTermPopover = ({
  match,
  targetLanguage,
  targetText = "",
  onInsert,
  children,
}: Readonly<GlossaryTermPopoverProps>) => {
  const [open, setOpen] = useState(false);
  const insertedRef = useRef(false);
  const scoped = useScopedPath();
  const code = targetLanguage?.languageCode ?? "";
  const languageName = targetLanguage?.languageName || code;
  const term = getGlossaryTermValue(match.meta, match.surface, code);
  const firstExample = match.glossary.usageExamples?.find((example) => example.trim())?.trim();
  // Keep terms are already right in the source wording, so there is nothing to insert.
  const insertValue = term.kind === "translate" ? term.value : null;
  const alreadyUsed =
    insertValue !== null &&
    !!findInTarget(targetText, insertValue, { caseInsensitive: true, targetCulture: code });
  // Only an approved value can be inserted: no greyed-out button for a missing translation.
  const showInsert = !!onInsert && term.kind === "translate";
  const isMissing = term.kind === "missing";

  const handleInsert = () => {
    if (insertValue === null || !onInsert) return;
    insertedRef.current = true;
    onInsert(insertValue);
    setOpen(false);
  };

  // A new tab keeps the editor's unsaved text (A1).
  const openTerm = () =>
    window.open(scoped(`services/glossary/${match.glossary.itemId}`), "_blank", "noopener");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(360px,calc(100vw-2rem))] min-w-0 overflow-hidden p-0"
        aria-label={`Glossary term ${match.glossary.name}`}
        onCloseAutoFocus={(event) => {
          // After Insert the target textarea keeps focus instead of the term.
          if (insertedRef.current) {
            insertedRef.current = false;
            event.preventDefault();
          }
        }}
      >
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 break-words text-sm font-semibold text-high-emphasis">
              {match.glossary.name}
            </p>
            <div className="flex shrink-0 flex-wrap justify-end gap-1">
              {match.status === "draft" && <GlossaryStatusBadge status="draft" />}
              <GlossaryRuleBadge rule={match.meta.rule} className="shrink-0" />
            </div>
          </div>
          {match.status === "draft" && (
            <p className="text-xs text-medium-emphasis">{DRAFT_TERM_NOTICE}</p>
          )}
          <TermValue term={term} language={languageName} />
          {match.definition && (
            <p className="line-clamp-4 border-t border-border pt-3 text-sm text-medium-emphasis">
              {match.definition}
            </p>
          )}
          {firstExample && (
            <p className="line-clamp-2 text-xs italic text-medium-emphasis">
              e.g. &ldquo;{firstExample}&rdquo;
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 px-4 py-2.5">
          {showInsert && alreadyUsed && (
            <p className="flex items-center gap-1.5 text-sm text-medium-emphasis">
              <Check className="h-4 w-4 text-success" aria-hidden="true" />
              Already used
            </p>
          )}
          {showInsert && !alreadyUsed && (
            <Button type="button" size="sm" onClick={handleInsert}>
              Insert
            </Button>
          )}
          {isMissing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              aria-label={`Add the ${languageName} translation in the glossary (opens in a new tab)`}
              onClick={openTerm}
            >
              Add it in the glossary
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto gap-1.5 px-2 text-medium-emphasis hover:text-high-emphasis"
              aria-label="Open term (opens in a new tab)"
              onClick={openTerm}
            >
              Open term
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default GlossaryTermPopover;
