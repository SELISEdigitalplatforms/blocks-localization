import { useState } from "react";
import { useForm } from "react-hook-form";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
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
          code: z.ZodIssueCode.custom,
          path: ["languageName"],
          message: "Language name must be between 2 and 100 characters",
        });
      }
      if (!CUSTOM_LANGUAGE_CODE_PATTERN.test(value.languageCode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
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
  const selectCatalogLanguage = (languageCode: string) => {
    setIsCustom(false);
    setSelectedLanguage(languageCode);
    form.setValue("isCustom", false);
    form.setValue("languageName", "");
    form.setValue("languageCode", languageCode, { shouldValidate: true });
    setOpen(false);
  };
  const selectCustomLanguage = () => {
    setIsCustom(true);
    setSelectedLanguage("");
    form.setValue("isCustom", true);
    form.setValue("languageCode", "");
    form.clearErrors();
    setOpen(false);
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
  const getPickerLabel = () => {
    if (isCustom) return "Custom language";
    if (!selectedLanguage) return "Select language";
    return langConfigureData.find((lang) => lang.languageCode === selectedLanguage)?.languageName;
  };
  return (
    <DialogContent style={{ touchAction: "auto" }}>
      <DialogHeader className="mb-4">
        <DialogTitle>New Language</DialogTitle>
      </DialogHeader>
      <div className="grid gap-2">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(formSubmitHandler)}>
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
                      onClick={() => setOpen(true)}
                    >
                      {getPickerLabel()}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>

                  <CommandDialog open={open} onOpenChange={setOpen}>
                    <CommandInput placeholder="Search language..." />
                    <CommandList>
                      <CommandEmpty>No language found.</CommandEmpty>
                      <CommandGroup>
                        {langConfigureData.map((language) => (
                          <CommandItem
                            key={language.languageCode}
                            onSelect={() => selectCatalogLanguage(language.languageCode)}
                          >
                            {language.languageName}
                            {selectedLanguage === language.languageCode && (
                              <Check className="ml-auto h-4 w-4" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      <CommandGroup forceMount>
                        <CommandItem
                          value="custom-language"
                          forceMount
                          onSelect={selectCustomLanguage}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Custom language
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </CommandDialog>

                  {!isCustom && <FormMessage />}
                </FormItem>
              )}
            />
            {isCustom && (
              <div className="mt-4 grid gap-4">
                <FormField
                  control={form.control}
                  name="languageName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-left font-medium text-high-emphasis">
                        Language name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Swiss German" {...field} />
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
                        <Input placeholder="e.g. gsw-CH" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
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
      {/* <DialogFooter className="mt-6">
        <DialogTrigger asChild>
          <Button variant="secondary">Cancel</Button>
        </DialogTrigger>
        <Button>Save</Button>
      </DialogFooter> */}
    </DialogContent>
  );
};

export default NewLanguage;
