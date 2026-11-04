import { Link } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os";
import { useT } from "@seliseblocks/genesis-os/i18n";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { cn } from "@/lib/utils";
import { IGlossary } from "@blocks-localization/models/language";

/** Where a term reaches the key from; a term shows once, under its first source in this order. */
export type GlossaryTermSource = "tagged" | "module" | "global" | "suggested";

export const GLOSSARY_TERM_SOURCE_ORDER: readonly GlossaryTermSource[] = [
  "tagged",
  "module",
  "global",
  "suggested",
];

export const GLOSSARY_TERM_SOURCE_LABEL_KEYS: Record<GlossaryTermSource, string> = {
  tagged: "GLOSSARY_TERM_CHIP.SOURCE_TAGGED",
  module: "GLOSSARY_TERM_CHIP.SOURCE_MODULE",
  global: "GLOSSARY_TERM_CHIP.SOURCE_GLOBAL",
  suggested: "GLOSSARY_TERM_CHIP.SOURCE_SUGGESTED",
};

export interface SourcedGlossary {
  glossary: IGlossary;
  source: GlossaryTermSource;
}

/** One entry per glossary, under its highest source (Tagged → Module → Global → Suggested). */
export const mergeSourcedGlossaries = (
  groups: Partial<Record<GlossaryTermSource, IGlossary[]>>,
): SourcedGlossary[] => {
  const seen = new Set<string>();
  return GLOSSARY_TERM_SOURCE_ORDER.flatMap((source) =>
    (groups[source] ?? []).flatMap((glossary) => {
      if (seen.has(glossary.itemId)) return [];
      seen.add(glossary.itemId);
      return [{ glossary, source }];
    }),
  );
};

interface GlossaryTermChipProps {
  glossary: IGlossary;
  source: GlossaryTermSource;
  /** Tagged chips: untags the glossary from the key. */
  onRemove?: () => void;
  /** Suggested chips: tags the glossary to the key. */
  onAdd?: () => void;
  disabled?: boolean;
}

const GlossaryTermChip = ({
  glossary,
  source,
  onRemove,
  onAdd,
  disabled,
}: Readonly<GlossaryTermChipProps>) => {
  const { t } = useT("localization.glossary");
  const scoped = useScopedPath();
  const sourceLabel = t(GLOSSARY_TERM_SOURCE_LABEL_KEYS[source]);

  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 rounded border py-0.5 pl-2 text-xs font-medium",
        onRemove || onAdd ? "pr-0.5" : "pr-2",
        source === "suggested" && "border-dashed",
      )}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to={scoped(`services/glossary/${glossary.itemId}`)}
              className="min-w-0 truncate rounded-sm text-high-emphasis underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {glossary.name}
            </Link>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-sm font-normal">
            {sourceLabel}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <span className="sr-only">{sourceLabel}</span>
      {onRemove && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-5 w-5 shrink-0"
          aria-label={t("GLOSSARY_TERM_CHIP.REMOVE_ARIA", { name: glossary.name })}
          disabled={disabled}
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      )}
      {onAdd && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-5 w-5 shrink-0"
          aria-label={t("GLOSSARY_TERM_CHIP.TAG_ARIA", { name: glossary.name })}
          disabled={disabled}
          onClick={onAdd}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
};

export default GlossaryTermChip;
