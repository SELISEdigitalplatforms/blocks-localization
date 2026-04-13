import { CONFIGURE_LANGUAGE_OPTIONS } from "@/features/uilm/constants/configure-languages";
import { useUilmSaveLanguage } from "@/features/uilm/hooks/use-uilm-queries";
import { Button } from "@/platform/ui/components/button/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/platform/ui/components/command/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/platform/ui/components/dialog/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/platform/ui/components/form/form";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  languageCode: z.string().min(1, { message: "Language is required" }),
});

type FormValues = z.infer<typeof schema>;

interface NewLanguageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectKey: string;
  /** Language codes already in the project — hidden from the picker. */
  existingLanguageCodes: string[];
}

export function NewLanguageModal({
  open,
  onOpenChange,
  projectKey,
  existingLanguageCodes,
}: NewLanguageModalProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const saveLang = useUilmSaveLanguage();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { languageCode: "" },
  });

  const languageCode = form.watch("languageCode");

  const availableOptions = useMemo(
    () =>
      CONFIGURE_LANGUAGE_OPTIONS.filter((l) => !existingLanguageCodes.includes(l.languageCode)),
    [existingLanguageCodes],
  );

  const selectedLabel = useMemo(() => {
    if (!languageCode) return null;
    return CONFIGURE_LANGUAGE_OPTIONS.find((l) => l.languageCode === languageCode)?.languageName ?? null;
  }, [languageCode]);

  useEffect(() => {
    if (open) {
      form.reset({ languageCode: "" });
      setPickerOpen(false);
    }
  }, [open, form]);

  const onSubmit = async (data: FormValues) => {
    const row = CONFIGURE_LANGUAGE_OPTIONS.find((l) => l.languageCode === data.languageCode);
    if (!row) {
      showErrorToast({ errors: "Select a valid language" });
      return;
    }
    try {
      const res = await saveLang.mutateAsync({
        languageName: row.languageName,
        languageCode: row.languageCode,
        projectKey,
      });
      if (res?.success) {
        showSuccessToast({ title: "Success", description: "Language added" });
        onOpenChange(false);
        form.reset({ languageCode: "" });
      } else {
        showErrorToast({
          errors: res?.errorMessage != null ? String(res.errorMessage) : "Could not save language",
        });
      }
    } catch (e) {
      showErrorToast({ errors: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Language</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="languageCode"
              render={({ field }) => (
                <>
                  <FormItem>
                    <FormLabel>Language</FormLabel>
                    <FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between font-normal"
                        onClick={() => setPickerOpen(true)}
                      >
                        <span className={selectedLabel ? "text-foreground" : "text-muted-foreground"}>
                          {selectedLabel ?? "Select language"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
                      </Button>
                    </FormControl>
                    <FormMessage />
                  </FormItem>

                  <CommandDialog open={pickerOpen} onOpenChange={setPickerOpen}>
                    <CommandInput placeholder="Search language..." />
                    <CommandList>
                      <CommandEmpty>No language found.</CommandEmpty>
                      <CommandGroup>
                        {availableOptions.map((language) => (
                          <CommandItem
                            key={language.languageCode}
                            value={`${language.languageName} ${language.languageCode}`}
                            onSelect={() => {
                              field.onChange(language.languageCode);
                              setPickerOpen(false);
                            }}
                          >
                            {language.languageName}
                            {languageCode === language.languageCode ? (
                              <Check className="ml-auto h-4 w-4" aria-hidden />
                            ) : null}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </CommandDialog>
                </>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saveLang.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saveLang.isPending || !languageCode}>
                {saveLang.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
