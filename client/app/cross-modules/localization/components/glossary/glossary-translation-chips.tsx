import { Check, TriangleAlert } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os/i18n";
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
import { findCultureEntry } from "@blocks-localization/utils/glossary-text";

export const MAX_TRANSLATION_CHIPS = 4;

const MISSING_CHIP_CLASS =
  "gap-1 whitespace-nowrap border-dashed border-warning-400 bg-transparent font-medium text-warning-700";

interface GlossaryTranslationChipsProps {
  meta: GlossaryMeta;
  languages: ILanguageConfig[] | undefined;
  max?: number;
}

const GlossaryTranslationChips = ({
  meta,
  languages,
  max = MAX_TRANSLATION_CHIPS,
}: Readonly<GlossaryTranslationChipsProps>) => {
  const { t } = useT("localization.glossary");
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
          const value = findCultureEntry(meta.translations, languageCode);
          // The chip shows only the code; "is missing" is in the tooltip and read by screen readers.
          if (!value) {
            return (
              <Tooltip key={languageCode}>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className={MISSING_CHIP_CLASS} tabIndex={0}>
                    <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                    {languageCode}
                    <span className="sr-only"> {t("GLOSSARY_TRANSLATION_CHIPS.SR_MISSING")}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-sm font-normal">
                  {t("GLOSSARY_TRANSLATION_CHIPS.MISSING", { code: languageCode })}
                </TooltipContent>
              </Tooltip>
            );
          }
          return (
            <Tooltip key={languageCode}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="gap-1 whitespace-nowrap font-medium"
                  tabIndex={0}
                >
                  <Check className="h-3 w-3 text-success" aria-hidden="true" />
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
