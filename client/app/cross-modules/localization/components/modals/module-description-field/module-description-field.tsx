import { Control, FieldValues, Path } from "react-hook-form";
import { z } from "zod";
import { useT, type TFunction } from "@seliseblocks/genesis-os/i18n";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
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
          <FormLabel className="text-left font-medium text-high-emphasis">
            {t("MODULE_DESCRIPTION.LABEL")}
          </FormLabel>
          <FormControl>
            <Textarea
              placeholder={t("MODULE_DESCRIPTION.PLACEHOLDER")}
              className="border-default mt-1 border shadow-none"
              rows={4}
              {...field}
            />
          </FormControl>
          <FormDescription>{t("MODULE_DESCRIPTION.HINT")}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
