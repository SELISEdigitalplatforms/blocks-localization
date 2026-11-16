import React from "react";
import { useT } from "@seliseblocks/genesis-os/i18n";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Input } from "@/components/ui-kits/input/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { useSaveLanguageModule } from "@blocks-localization/hooks/use-language-manager";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { formatErrorMessage } from "@/lib/error";
import { IModuleGets } from "@blocks-localization/models/language";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  ModuleDescriptionField,
  moduleDescriptionSchema,
} from "@blocks-localization/components/modals/module-description-field/module-description-field";

interface EditModuleProps {
  module: IModuleGets;
  onClose: (open: boolean) => void;
}

interface FormValues {
  moduleName: string;
  description: string;
}

const EditModule: React.FC<EditModuleProps> = ({ module, onClose }) => {
  const { t } = useT("localization.modules");
  const schema = z.object({
    moduleName: z
      .string()
      .min(3, { message: t("EDIT_MODULE.NAME_TOO_SHORT") })
      .max(100, { message: t("EDIT_MODULE.NAME_TOO_LONG") }),
    description: moduleDescriptionSchema(t),
  });
  const { isPending, mutateAsync } = useSaveLanguageModule();

  const form = useForm<FormValues>({
    defaultValues: {
      moduleName: module.moduleName,
      description: module.description ?? "",
    },
    resolver: zodResolver(schema),
  });

  const formSubmitHandler = async (data: FormValues) => {
    try {
      const payload = {
        itemId: module.itemId,
        moduleName: data.moduleName,
        // Always sent: "" clears the description, while an omitted field would keep it.
        description: data.description,
      };
      const res = await mutateAsync(payload);
      if (res?.success) {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("EDIT_MODULE.UPDATED"),
        });
        form.reset();
        onClose(false);
      } else {
        if (Array.isArray(res?.validationErrors) && res.validationErrors.length > 0) {
          res.validationErrors.forEach((error) => {
            showErrorToast({ errors: error.errorMessage });
          });
        } else {
          showErrorToast({ errors: res?.errorMessage });
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("common:ERROR"),
        description: formatErrorMessage(error),
      });
    }
  };

  return (
    <DialogContent>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(formSubmitHandler)}>
          <DialogHeader className="mb-4">
            <DialogTitle>{t("EDIT_MODULE.TITLE")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField
              name="moduleName"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-left font-medium text-high-emphasis">
                    {t("EDIT_MODULE.NAME_LABEL")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("EDIT_MODULE.NAME_PLACEHOLDER")}
                      className="border-default col-span-3 mt-1 border shadow-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <ModuleDescriptionField control={form.control} name="description" />
          </div>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              disabled={isPending}
              variant="secondary"
              onClick={() => onClose(false)}
            >
              {t("common:CANCEL")}
            </Button>
            <Button disabled={isPending || !form.formState.isValid}>{t("common:SAVE")}</Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
};

export default EditModule;
