import React from "react";
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
import { langConfigureData } from "@blocks-localization/constants/language-dummy-data";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandDialog,
} from "@/components/ui-kits/command/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { useSaveLanguage } from "@blocks-localization/hooks/use-language-manager";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { toast } from "@/hooks/use-toast";
import { ILanguageConfig } from "@blocks-localization/models/language";

interface NewLanguageProps {
  onClose: (value?: boolean) => void;
  existingLanguages?: ILanguageConfig[];
}

const NewLanguage: React.FC<NewLanguageProps> = ({ onClose, existingLanguages = [] }) => {
  const schema = z.object({
    languageCode: z.string().min(1, { message: "Language is required" }),
  });
  const form = useForm({
    defaultValues: { languageCode: "" },
    resolver: zodResolver(schema),
  });

  const { isPending, mutateAsync } = useSaveLanguage();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const [open, setOpen] = React.useState(false);
  const [selectedLanguage, setSelectedLanguage] = React.useState(form.getValues("languageCode"));
  const formSubmitHandler = async (data: any) => {
    try {
      const isDuplicate = existingLanguages.some((lang) => lang.languageCode === data.languageCode);
      if (isDuplicate) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Language is already added. You can't add this language.",
        });
        return;
      }
      const payload = {
        ...data,
        languageName: langConfigureData.find((lang) => lang.languageCode === data.languageCode)
          ?.languageName,
      };
      const res = await mutateAsync(payload);
      onClose();
      if (res?.success) {
        toast({
          variant: "success",
          title: "Success",
          description: "Language added",
        });
        form.reset();
        onClose(false);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: JSON.stringify(res?.errorMessage),
        });
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
                      onClick={() => setOpen(true)}
                    >
                      {selectedLanguage
                        ? langConfigureData.find((lang) => lang.languageCode === selectedLanguage)
                            ?.languageName
                        : "Select language"}
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
                            onSelect={() => {
                              setSelectedLanguage(language.languageCode);
                              field.onChange(language.languageCode);
                              setOpen(false);
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
            <DialogFooter className="mt-6">
              <DialogTrigger asChild>
                <Button disabled={isPending} variant="secondary">
                  Cancel
                </Button>
              </DialogTrigger>
              <Button disabled={isPending}>Save</Button>
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
