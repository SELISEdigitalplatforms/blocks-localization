import { useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowLeft, Check, ChevronsUpDown, Plus } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import { langConfigureData } from "@blocks-localization/constants/language-dummy-data";
import {
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandDialog,
} from "@/components/ui-kits/command/command";
import { useSaveLanguage } from "@blocks-localization/hooks/use-language-manager";
import { toast } from "@/hooks/use-toast";
import { formatErrorMessage } from "@/lib/error";
import { ILanguageConfig } from "@blocks-localization/models/language";

// Same rule as the server's LanguageValidator, so a bad code fails here, not after the request.
const CUSTOM_LANGUAGE_CODE_PATTERN = /^([a-z]{2,3}-[A-Z]{2,10}|[a-z]{2,3}-x-[A-Za-z]{1,8})$/;

// Fix the letter case people usually get wrong: "gsw-ch" → "gsw-CH", "EN-X-Cave" → "en-x-Cave".
const normalizeLanguageCode = (code: string) => {
  const [language = "", region, ...rest] = code.trim().split("-");
  if (region === undefined) return language.toLowerCase();
  if (region.toLowerCase() === "x") return [language.toLowerCase(), "x", ...rest].join("-");
  return [language.toLowerCase(), region.toUpperCase(), ...rest].join("-");
};

interface NewLanguageProps {
  onClose: (value?: boolean) => void;
  existingLanguages?: ILanguageConfig[];
}

const NewLanguage: React.FC<NewLanguageProps> = ({ onClose, existingLanguages = [] }) => {
  const schema = z
    .object({
      isCustom: z.boolean(),
      languageCode: z.string().trim().min(1, { message: "Language is required" }),
      languageName: z.string().trim(),
    })
    .superRefine((value, ctx) => {
      if (!value.isCustom) return;
      if (value.languageName.length < 2 || value.languageName.length > 100) {
        ctx.addIssue({
          code: "custom",
          path: ["languageName"],
          message: "Language name must be between 2 and 100 characters",
        });
      }
      if (!CUSTOM_LANGUAGE_CODE_PATTERN.test(value.languageCode)) {
        ctx.addIssue({
          code: "custom",
          path: ["languageCode"],
          message: "Use a code like en-US, zho-CN or en-x-cave",
        });
      }
    });

  type LanguageFormValues = z.infer<typeof schema>;

  const form = useForm<LanguageFormValues>({
    defaultValues: { isCustom: false, languageCode: "", languageName: "" },
    resolver: zodResolver(schema),
  });

  const { isPending, mutateAsync } = useSaveLanguage();
  const [open, setOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(form.getValues("languageCode"));
  const [isCustom, setIsCustom] = useState(false);
  const [search, setSearch] = useState("");
  const addedCodes = new Set(existingLanguages.map((lang) => lang.languageCode.toLowerCase()));
  const openPicker = () => {
    setSearch("");
    setOpen(true);
  };
  const selectCatalogLanguage = (languageCode: string) => {
    setIsCustom(false);
    setSelectedLanguage(languageCode);
    form.setValue("isCustom", false);
    form.setValue("languageName", "");
    form.setValue("languageCode", languageCode, { shouldValidate: true });
    setOpen(false);
  };
  const selectCustomLanguage = (prefillName = "") => {
    setIsCustom(true);
    setSelectedLanguage("");
    form.setValue("isCustom", true);
    form.setValue("languageCode", "");
    form.setValue("languageName", prefillName.trim());
    form.clearErrors();
    setOpen(false);
  };
  const backToList = () => {
    setIsCustom(false);
    form.setValue("isCustom", false);
    form.setValue("languageName", "");
    form.setValue("languageCode", selectedLanguage);
    form.clearErrors();
  };
  const formSubmitHandler = async (data: LanguageFormValues) => {
    try {
      const languageCode = data.languageCode.trim();
      const languageName = data.isCustom
        ? data.languageName.trim()
        : langConfigureData.find((lang) => lang.languageCode === languageCode)?.languageName;
      const isDuplicate = existingLanguages.some(
        (lang) =>
          lang.languageCode.toLowerCase() === languageCode.toLowerCase() ||
          lang.languageName.toLowerCase() === languageName?.toLowerCase(),
      );
      if (isDuplicate) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Language is already added. You can't add this language.",
        });
        return;
      }
      if (!languageName) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Language not found in configuration.",
        });
        return;
      }
      const res = await mutateAsync({ languageCode, languageName });
      if (res?.success) {
        toast({
          variant: "success",
          title: "Success",
          description: "Language added successfully.",
        });
        form.reset();
        onClose(false);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: formatErrorMessage(res?.errorMessage),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: formatErrorMessage(error),
      });
    }
  };
  const selectedName = langConfigureData.find(
    (lang) => lang.languageCode === selectedLanguage,
  )?.languageName;
  const searchText = search.trim();
  return (
    <DialogContent style={{ touchAction: "auto" }}>
      <DialogHeader className="mb-4">
        <DialogTitle>New Language</DialogTitle>
      </DialogHeader>
      <div className="grid gap-2">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(formSubmitHandler)}>
            {isCustom ? (
              <div className="grid gap-4 rounded-md border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-high-emphasis">Custom language</span>
                  <Button type="button" variant="ghost" size="sm" onClick={backToList}>
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Back to list
                  </Button>
                </div>
                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="languageName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-left font-medium text-high-emphasis">
                          Language name <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Swiss German" autoFocus {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="languageCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-left font-medium text-high-emphasis">
                          Language code <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. gsw-CH"
                            {...field}
                            onBlur={() => {
                              field.onChange(normalizeLanguageCode(field.value));
                              field.onBlur();
                            }}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Format: language-REGION, like de-CH or gsw-CH. Private variant:
                          language-x-name, like en-x-cave.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ) : (
              <FormField
                control={form.control}
                name="languageCode"
                render={() => (
                  <FormItem>
                    <FormLabel className="text-left font-medium text-high-emphasis">
                      Language <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between"
                        onClick={openPicker}
                      >
                        {selectedName ?? "Select language"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                    <FormMessage />
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto justify-start p-0 text-sm"
                      onClick={() => selectCustomLanguage()}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Not in the list? Add a custom language
                    </Button>
                  </FormItem>
                )}
              />
            )}

            <CommandDialog open={open} onOpenChange={setOpen}>
              <CommandInput
                placeholder="Search by name or code..."
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                <CommandEmpty>
                  <div className="flex flex-col items-center gap-3 px-4">
                    <span className="text-medium-emphasis">
                      No language matches &quot;{searchText}&quot;.
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => selectCustomLanguage(searchText)}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add &quot;{searchText}&quot; as a custom language
                    </Button>
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  {langConfigureData.map((language) => {
                    const isAdded = addedCodes.has(language.languageCode.toLowerCase());
                    return (
                      <CommandItem
                        key={language.languageCode}
                        value={`${language.languageName} ${language.languageCode}`}
                        disabled={isAdded}
                        onSelect={() => selectCatalogLanguage(language.languageCode)}
                      >
                        <span>{language.languageName}</span>
                        <span className="ml-2 text-xs text-medium-emphasis">
                          {language.languageCode}
                        </span>
                        {isAdded && (
                          <span className="ml-auto text-xs text-medium-emphasis">Added</span>
                        )}
                        {!isAdded && selectedLanguage === language.languageCode && (
                          <Check className="ml-auto h-4 w-4" />
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
              <div className="flex items-center justify-between border-t border-border px-3 py-2">
                <span className="text-xs text-medium-emphasis">Can&apos;t find your language?</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => selectCustomLanguage(searchText)}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add custom language
                </Button>
              </div>
            </CommandDialog>

            <DialogFooter className="mt-6">
              <DialogTrigger asChild>
                <Button disabled={isPending} variant="secondary">
                  Cancel
                </Button>
              </DialogTrigger>
              <Button disabled={isPending || (!isCustom && !selectedLanguage)}>Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </div>
    </DialogContent>
  );
};

export default NewLanguage;
