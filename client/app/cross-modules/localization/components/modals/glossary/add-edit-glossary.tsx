import React from "react";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
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
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import {
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandDialog,
} from "@/components/ui-kits/command/command";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  useGetLanguages,
  useSaveGlossary,
} from "@blocks-localization/hooks/use-language-manager";
import { useProjectStore } from "@/store/useProjectStore";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  IGlossary,
  IGlossaryFormData,
  GLOSSARY_TYPE_OPTIONS,
} from "@blocks-localization/models/language";

interface AddEditGlossaryProps {
  onClose: () => void;
  glossary?: IGlossary;
}

const schema = z.object({
  name: z
    .string()
    .min(1, { message: "Name is required" })
    .max(200, { message: "Name must be less than 200 characters" }),
  language: z.string().optional(),
  type: z.string().optional(),
  context: z.string().optional(),
  additionalNote: z.string().optional(),
});

const AddEditGlossary: React.FC<AddEditGlossaryProps> = ({ onClose, glossary }) => {
  const isEditMode = !!glossary;
  const { isPending, mutateAsync } = useSaveGlossary();
  const { data: languageListData } = useGetLanguages();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const [languageOpen, setLanguageOpen] = React.useState(false);

  const form = useForm<IGlossaryFormData>({
    defaultValues: {
      name: glossary?.name ?? "",
      language: glossary?.language ?? "",
      type: glossary?.type ?? "",
      context: glossary?.context ?? "",
      additionalNote: glossary?.additionalNote ?? "",
    },
    resolver: zodResolver(schema),
  });

  const selectedLanguage = form.watch("language");

  const formSubmitHandler = async (data: IGlossaryFormData) => {
    try {
      const payload = {
        ...data,
        ...(isEditMode && glossary?.itemId ? { itemId: glossary.itemId } : {}),
        projectKey: tenantId,
      };
      const res = await mutateAsync(payload);

      if (res?.success) {
        toast({
          variant: "success",
          title: "Success",
          description: isEditMode ? "Glossary item updated" : "Glossary item added",
        });
        form.reset();
        onClose();
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
        title: "Error",
        description: JSON.stringify(error),
      });
    }
  };

  return (
    <DialogContent className="sm:max-w-[500px]">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(formSubmitHandler)}>
          <DialogHeader className="mb-4">
          </DialogHeader>
          <div className="grid gap-4">
            <FormField
              name="name"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-left font-medium text-high-emphasis">
                    Name <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter glossary name"
                      className="border-default col-span-3 mt-1 border shadow-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="language"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-left font-medium text-high-emphasis">
                    Language
                  </FormLabel>
                  <FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => setLanguageOpen(true)}
                    >
                      {selectedLanguage
                        ? languageListData?.find(
                            (lang) => lang.languageCode === selectedLanguage,
                          )?.languageName ?? selectedLanguage
                        : "Select language"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>

                  <CommandDialog open={languageOpen} onOpenChange={setLanguageOpen}>
                    <CommandInput placeholder="Search language..." />
                    <CommandList>
                      <CommandEmpty>No language found.</CommandEmpty>
                      <CommandGroup>
                        {languageListData?.map((language) => (
                          <CommandItem
                            key={language.languageCode}
                            onSelect={() => {
                              field.onChange(language.languageCode);
                              setLanguageOpen(false);
                            }}
                          >
                            {language.languageName}
                            {selectedLanguage === language.languageCode && (
                              <Check className="ml-auto h-4 w-4" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </CommandDialog>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="type"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-left font-medium text-high-emphasis">Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {GLOSSARY_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="context"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-left font-medium text-high-emphasis">
                    Context / Description
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter context or description"
                      className="border-default mt-1 resize-none border shadow-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="additionalNote"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-left font-medium text-high-emphasis">
                    Additional Note
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter additional notes"
                      className="border-default mt-1 resize-none border shadow-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <DialogFooter className="mt-6">
            <DialogTrigger asChild>
              <Button disabled={isPending} variant="secondary">
                Cancel
              </Button>
            </DialogTrigger>
            <Button disabled={isPending}>{isEditMode ? "Update" : "Create"}</Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
};

export default AddEditGlossary;
