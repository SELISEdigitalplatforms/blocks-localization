import { ReactElement, useRef, useState } from "react";
import { useScopedPath } from "@seliseblocks/genesis-os";

import { Button } from "@/components/ui-kits/button/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import GlossaryRuleBadge from "@blocks-localization/components/glossary/glossary-rule-badge";
import { GlossaryMeta } from "@blocks-localization/models/glossary-meta";
import { ILanguageConfig } from "@blocks-localization/models/language";
import { GlossaryMatch } from "@blocks-localization/utils/glossary-matcher";

export type TermTargetLanguage = Pick<ILanguageConfig, "languageCode" | "languageName">;

/**
 * What the popover shows and Insert inserts, read by rule (Phase 2 A9): translations are
 * active only for `translate`, so a Keep or Forbidden term's leftover values are ignored.
 */
export type GlossaryTermValue =
  | { kind: "translate"; value: string }
  | { kind: "missing" }
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
  return value ? { kind: "translate", value } : { kind: "missing" };
};

const TermValue = ({ term, code }: Readonly<{ term: GlossaryTermValue; code: string }>) => {
  switch (term.kind) {
    case "translate":
      return <p className="text-sm font-medium text-high-emphasis">{term.value}</p>;
    case "missing":
      return <p className="text-sm text-medium-emphasis">No {code} translation</p>;
    case "keep":
      return <p className="text-sm text-high-emphasis">Keep as written</p>;
    default:
      return (
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-error">Do not use</p>
          {term.alsoAvoid.length > 0 && (
            <p className="text-sm text-medium-emphasis">Also avoid: {term.alsoAvoid.join(", ")}</p>
          )}
        </div>
      );
  }
};

interface GlossaryTermPopoverProps {
  match: GlossaryMatch;
  /** The editor's target language: the value shown and inserted is for this culture. */
  targetLanguage?: TermTargetLanguage;
  /** Multi-row editors name the target row: "Insert into <languageName>". */
  showInsertTarget?: boolean;
  onInsert?: (value: string) => void;
  /** The trigger (a highlighted term or a chip); it gets focus back on Escape. */
  children: ReactElement;
}

/** Term, rule, target value and definition, with Insert and Open term. */
const GlossaryTermPopover = ({
  match,
  targetLanguage,
  showInsertTarget = false,
  onInsert,
  children,
}: Readonly<GlossaryTermPopoverProps>) => {
  const [open, setOpen] = useState(false);
  const insertedRef = useRef(false);
  const scoped = useScopedPath();
  const code = targetLanguage?.languageCode ?? "";
  const term = getGlossaryTermValue(match.meta, match.surface, code);
  const insertValue = term.kind === "translate" || term.kind === "keep" ? term.value : null;
  const insertLabel =
    showInsertTarget && targetLanguage?.languageName
      ? `Insert into ${targetLanguage.languageName}`
      : "Insert";

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
        className="w-[min(360px,calc(100vw-2rem))] min-w-0 space-y-3"
        aria-label={`Glossary term ${match.glossary.name}`}
        onCloseAutoFocus={(event) => {
          // After Insert the target textarea keeps focus instead of the term.
          if (insertedRef.current) {
            insertedRef.current = false;
            event.preventDefault();
          }
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="break-words font-medium text-high-emphasis">{match.glossary.name}</p>
          <GlossaryRuleBadge rule={match.meta.rule} />
        </div>
        <TermValue term={term} code={code} />
        {match.definition && (
          <p className="line-clamp-4 text-sm text-medium-emphasis">{match.definition}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {term.kind !== "forbidden" && onInsert && (
            <Button type="button" size="sm" disabled={insertValue === null} onClick={handleInsert}>
              {insertLabel}
            </Button>
          )}
          <Button type="button" variant="link" size="sm" className="px-1" onClick={openTerm}>
            Open term
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default GlossaryTermPopover;
