import { Link } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { IGlossary, ILanguageConfig } from "@blocks-localization/models/language";
import GlossaryRuleBadge from "@blocks-localization/components/glossary/glossary-rule-badge";
import GlossaryTranslationChips from "@blocks-localization/components/glossary/glossary-translation-chips";
import {
  isUnsupportedGlossaryNote,
  toGlossaryMeta,
} from "@blocks-localization/utils/glossary-display";
import { stripRuleMarker } from "@blocks-localization/utils/glossary-rule-marker";

/** Where a term reaches the key from; a term shows once, under its first source in this order. */
export type GlossaryTermSource = "tagged" | "module" | "global" | "suggested";

export const GLOSSARY_TERM_SOURCE_ORDER: readonly GlossaryTermSource[] = [
  "tagged",
  "module",
  "global",
  "suggested",
];

export const GLOSSARY_TERM_SOURCE_LABELS: Record<GlossaryTermSource, string> = {
  tagged: "Tagged",
  module: "Module",
  global: "Global",
  suggested: "Suggested",
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

interface GlossaryTermCardProps {
  glossary: IGlossary;
  source: GlossaryTermSource;
  languages: ILanguageConfig[] | undefined;
  /** Tagged cards: untags the term from the key. */
  onRemove?: () => void;
  /** Suggested cards: tags the term to the key. */
  onAdd?: () => void;
  disabled?: boolean;
}

const GlossaryTermCard = ({
  glossary,
  source,
  languages,
  onRemove,
  onAdd,
  disabled,
}: Readonly<GlossaryTermCardProps>) => {
  const scoped = useScopedPath();
  const isUnsupported = isUnsupportedGlossaryNote(glossary);
  const meta = toGlossaryMeta(glossary);
  const definition = stripRuleMarker(glossary.context);

  return (
    <Card className="rounded-sm shadow-none">
      <CardContent className="grid gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Link
              to={scoped(`services/glossary/${glossary.itemId}`)}
              className="break-words font-medium text-high-emphasis underline-offset-4 hover:underline"
            >
              {glossary.name}
            </Link>
            {!isUnsupported && <GlossaryRuleBadge rule={meta.rule} />}
            <Badge variant="outline">{GLOSSARY_TERM_SOURCE_LABELS[source]}</Badge>
          </div>
          {onRemove && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0"
              aria-label={`Remove ${glossary.name} from key`}
              disabled={disabled}
              onClick={onRemove}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          {onAdd && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 shrink-0 gap-1 px-2"
              aria-label={`Tag ${glossary.name} to key`}
              disabled={disabled}
              onClick={onAdd}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add
            </Button>
          )}
        </div>
        {!isUnsupported && meta.rule === "translate" && (
          <GlossaryTranslationChips meta={meta} languages={languages} max={3} />
        )}
        {definition && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p
                  tabIndex={0}
                  className="line-clamp-2 rounded-sm text-sm text-medium-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {definition}
                </p>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="max-w-80 whitespace-pre-wrap text-sm font-normal"
              >
                {definition}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
};

export default GlossaryTermCard;
