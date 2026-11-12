import { Control, FieldValues, Path } from "react-hook-form";
import { z } from "zod";
import { Info } from "lucide-react";
import { useT, type TFunction } from "@seliseblocks/genesis-os/i18n";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { MODULE_DESCRIPTION_MAX_LENGTH } from "@blocks-localization/models/language";

export const moduleDescriptionSchema = (t: TFunction) =>
  z
    .string()
    .trim()
    .max(MODULE_DESCRIPTION_MAX_LENGTH, {
      message: t("MODULE_DESCRIPTION.TOO_LONG", { max: MODULE_DESCRIPTION_MAX_LENGTH }),
    });

interface ModuleDescriptionFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
}

export function ModuleDescriptionField<T extends FieldValues>({
  control,
  name,
}: Readonly<ModuleDescriptionFieldProps<T>>) {
  const { t } = useT("localization.modules");
  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => (
        <FormItem>
          <div className="flex items-center gap-1">
            <FormLabel className="text-left font-medium text-high-emphasis">
              {t("MODULE_DESCRIPTION.LABEL")}
            </FormLabel>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("MODULE_DESCRIPTION.INFO_LABEL")}
                    className="text-medium-emphasis hover:text-high-emphasis"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[320px] text-left text-[12px]" side="top">
                  {t("MODULE_DESCRIPTION.HINT")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <FormControl>
            <Textarea
              placeholder={t("MODULE_DESCRIPTION.PLACEHOLDER")}
              className="border-default mt-1 border shadow-none"
              rows={4}
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
