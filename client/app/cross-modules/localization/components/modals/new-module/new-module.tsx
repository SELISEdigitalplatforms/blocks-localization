import React from "react";
import { useT } from "@seliseblocks/genesis-os/i18n";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Input } from "@/components/ui-kits/input/input";
import { useSaveLanguageModule } from "@blocks-localization/hooks/use-language-manager";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { formatErrorMessage } from "@/lib/error";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ILanguageModule } from "@blocks-localization/models/language";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import {
  ModuleDescriptionField,
  moduleDescriptionSchema,
} from "@blocks-localization/components/modals/module-description-field/module-description-field";

interface NewModuleProps {
  onClose: (value?: boolean) => void;
}
interface FormValues {
  moduleName: string;
  description: string;
}

const NewModule: React.FC<NewModuleProps> = ({ onClose }) => {
  const { t } = useT("localization.modules");
  const schema = z.object({
    moduleName: z
      .string()
      .trim()
      .min(1, { message: t("NEW_MODULE.NAME_REQUIRED") })
      .max(50, { message: t("NEW_MODULE.NAME_TOO_LONG") }),
    description: moduleDescriptionSchema(t),
  });
  const { isPending, mutateAsync } = useSaveLanguageModule();

  const form = useForm<FormValues>({
    defaultValues: {
      moduleName: "",
      description: "",
    },
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const formSubmitHandler = async (data: FormValues) => {
    try {
      const payload = {
        ...data,
      } as ILanguageModule;
      const res = await mutateAsync(payload);
      if (res?.success) {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("NEW_MODULE.ADDED"),
        });
        form.reset();
        onClose(false);
      } else {
        if (Array.isArray(res?.validationErrors) && res.validationErrors.length > 0) {
          res?.validationErrors?.forEach((error) => {
            showErrorToast({ errors: formatErrorMessage(error.errorMessage) });
          });
        } else {
          showErrorToast({ errors: formatErrorMessage(res?.errorMessage) });
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
        {" "}
        <form onSubmit={form.handleSubmit(formSubmitHandler)}>
          <DialogHeader className="mb-4">
            <DialogTitle>{t("NEW_MODULE.TITLE")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField
              name="moduleName"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-left font-medium text-high-emphasis">
                    {t("NEW_MODULE.NAME_LABEL")} <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("NEW_MODULE.NAME_PLACEHOLDER")}
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
            <DialogTrigger asChild>
              <Button disabled={isPending} variant="secondary">
                {t("common:CANCEL")}
              </Button>
            </DialogTrigger>
            <Button disabled={isPending || !form.formState.isValid}>{t("common:CREATE")}</Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
};

export default NewModule;
