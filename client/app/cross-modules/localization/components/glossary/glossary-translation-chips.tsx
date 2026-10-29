import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { GlossaryMeta } from "@blocks-localization/models/glossary-meta";
import { ILanguageConfig } from "@blocks-localization/models/language";
import { getTargetLanguages } from "@blocks-localization/utils/glossary-rule-marker";

export const MAX_TRANSLATION_CHIPS = 4;

interface GlossaryTranslationChipsProps {
  meta: GlossaryMeta;
  languages: ILanguageConfig[] | undefined;
  /** Chips shown before "+N" (the glossary picker shows 3). */
  max?: number;
}

const GlossaryTranslationChips = ({
  meta,
  languages,
  max = MAX_TRANSLATION_CHIPS,
}: Readonly<GlossaryTranslationChipsProps>) => {
  const targets = getTargetLanguages(languages);
  if (meta.rule !== "translate" || targets.length === 0) {
    return <span>—</span>;
  }

  const visible = targets.slice(0, max);
  const hiddenCount = targets.length - visible.length;

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-1">
        {visible.map(({ languageCode }) => {
          const value = meta.translations[languageCode];
          if (!value) {
            return (
              <Badge key={languageCode} variant="warning" className="gap-1 whitespace-nowrap">
                <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                {languageCode} missing
              </Badge>
            );
          }
          return (
            <Tooltip key={languageCode}>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="whitespace-nowrap" tabIndex={0}>
                  {languageCode}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-80 text-sm font-normal">
                {value}
              </TooltipContent>
            </Tooltip>
          );
        })}
        {hiddenCount > 0 && <span className="text-xs text-medium-emphasis">+{hiddenCount}</span>}
      </div>
    </TooltipProvider>
  );
};

export default GlossaryTranslationChips;
