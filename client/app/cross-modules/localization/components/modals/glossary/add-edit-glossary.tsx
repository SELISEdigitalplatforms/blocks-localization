import { FC, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
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
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandDialog,
} from "@/components/ui-kits/command/command";
import { Check, ChevronsUpDown, CircleAlert, X } from "lucide-react";
import {
  useGetLanguageModules,
  useGetLanguages,
  useSaveGlossary,
} from "@blocks-localization/hooks/use-language-manager";
import { useProjectStore } from "@seliseblocks/genesis-os";
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
  isOpen?: boolean;
}

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(200, { message: "Name must be less than 200 characters" }),
  language: z.string().optional(),
  type: z.string().optional(),
  isGlobal: z.boolean().optional(),
  moduleIds: z.array(z.string()).optional(),
  context: z.string().optional(),
  additionalNote: z.string().optional(),
});

const AddEditGlossary: FC<AddEditGlossaryProps> = ({ onClose, glossary, isOpen }) => {
  const isEditMode = !!glossary;
  const prevIsOpenRef = useRef(false);
  const { isPending, mutateAsync } = useSaveGlossary();
  const { data: languageListData } = useGetLanguages();
  const { data: moduleListData } = useGetLanguageModules();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const [languageOpen, setLanguageOpen] = useState(false);
  const [modulePopoverOpen, setModulePopoverOpen] = useState(false);

  const form = useForm<IGlossaryFormData>({
    defaultValues: {
      name: glossary?.name ?? "",
      language: glossary?.language ?? "",
      type: glossary?.type ?? "",
      isGlobal: glossary?.isGlobal ?? false,
      moduleIds: glossary?.moduleIds ?? [],
      context: glossary?.context ?? "",
      additionalNote: glossary?.additionalNote ?? "",
    },
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    // Reset form when dialog opens in add mode (isOpen goes from false to true)
    if (isOpen && !prevIsOpenRef.current && !glossary) {
      form.reset({
        name: "",
        language: "",
        type: "",
        isGlobal: false,
        moduleIds: [],
        context: "",
        additionalNote: "",
      });
    }
    prevIsOpenRef.current = isOpen ?? false;
  }, [form, glossary, isOpen]);

  useEffect(() => {
    form.reset({
      name: glossary?.name ?? "",
      language: glossary?.language ?? "",
      type: glossary?.type ?? "",
      isGlobal: glossary?.isGlobal ?? false,
      moduleIds: glossary?.moduleIds ?? [],
      context: glossary?.context ?? "",
      additionalNote: glossary?.additionalNote ?? "",
    });
  }, [form, glossary]);

  const selectedLanguage = form.watch("language");

  const formSubmitHandler = async (data: IGlossaryFormData) => {
    try {
      const payload = {
        ...data,
        ...(isEditMode && glossary?.itemId ? { itemId: glossary.itemId } : {}),
      };
      const res = await mutateAsync(payload);

      if (res?.success) {
        toast({
          variant: "success",
          title: "Success",
          description: isEditMode
            ? "Glossary item updated successfully."
            : "Glossary item added successfully.",
        });
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
    <DialogContent className="sm:max-w-[500px] max-h-[93vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">
          {isEditMode ? "Edit Glossary" : "Add Glossary"}
        </DialogTitle>
        <DialogDescription />
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(formSubmitHandler)} className="space-y-4">
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
                    className="border-default border shadow-none"
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
                <FormLabel className="text-left font-medium text-high-emphasis">Language</FormLabel>
                <FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => setLanguageOpen(true)}
                  >
                    {selectedLanguage
                      ? (languageListData?.find((lang) => lang.languageCode === selectedLanguage)
                          ?.languageName ?? selectedLanguage)
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
                <Select onValueChange={field.onChange} value={field.value}>
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
            name="isGlobal"
            control={form.control}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="cursor-pointer text-left font-medium text-high-emphasis">
                  Add to global context
                </FormLabel>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="moduleIds"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-left font-medium text-high-emphasis">
                  Tagged Modules
                </FormLabel>
                {field.value && field.value.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {field.value.map((id) => {
                      const mod = moduleListData?.find((m) => m.itemId === id);
                      return (
                        <Badge key={id} variant="secondary" className="gap-1 pr-1">
                          {mod?.moduleName ?? id}
                          <button
                            type="button"
                            onClick={() => {
                              const current = field.value || [];
                              const next = current.includes(id)
                                ? current.filter((mid) => mid !== id)
                                : [...current, id];
                              field.onChange(next);
                              void form.trigger("moduleIds");
                            }}
                            className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
                <Popover open={modulePopoverOpen} onOpenChange={setModulePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      Tag modules...
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent portalled={false} className="z-[60] w-[420px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search modules..." />
                      <CommandList>
                        <CommandEmpty>No modules found.</CommandEmpty>
                        <CommandGroup>
                          {moduleListData?.map((mod) => {
                            const moduleSearchValue = [mod.moduleName, mod.itemId]
                              .filter(Boolean)
                              .join(" ")
                              .toLowerCase();
                            const selectedModuleIds = field.value ?? [];
                            const isSelected = selectedModuleIds.includes(mod.itemId);

                            return (
                              <CommandItem
                                key={mod.itemId}
                                value={moduleSearchValue}
                                keywords={[mod.moduleName ?? "", mod.itemId ?? ""]}
                                onSelect={() => {
                                  const current = form.getValues("moduleIds") ?? [];
                                  const next = current.includes(mod.itemId)
                                    ? current.filter((id) => id !== mod.itemId)
                                    : [...current, mod.itemId];
                                  field.onChange(next);
                                  void form.trigger("moduleIds");
                                }}
                              >
                                {mod.moduleName}
                                {isSelected && <Check className="ml-auto h-4 w-4" />}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="context"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-left font-medium text-high-emphasis">Context</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter context or description"
                    className="border-default resize-none border shadow-none"
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <FormLabel className="flex w-fit cursor-help items-center gap-1.5 text-left font-medium text-high-emphasis">
                        Additional Notes
                        <CircleAlert className="h-4 w-4 text-medium-emphasis" />
                      </FormLabel>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-80 text-sm font-normal">
                      Not utilized for auto translation, only given for additional comments by the
                      user
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <FormControl>
                  <Textarea
                    placeholder="Enter additional user notes"
                    className="border-default resize-none border shadow-none"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isEditMode ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
};

export default AddEditGlossary;
