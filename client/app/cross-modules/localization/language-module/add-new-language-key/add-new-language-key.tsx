import React, { useEffect, useRef } from "react";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { Button } from "@/components/ui-kits/button/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui-kits/command/command";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import { Label } from "@/components/ui-kits/label/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui-kits/popover/popover";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import NewModule from "@blocks-localization/components/modals/new-module/new-module";
import {
  useGetLanguageModules,
  useGetLanguages,
  useGetTranslationSuggestion,
  useSaveBlocksLanguageKey,
} from "@blocks-localization/hooks/use-language-manager";
import { ILanguageConfig } from "@blocks-localization/models/language";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown, Info, Plus, Trash, Wand } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

interface MutationResponse {
  success?: boolean;
  errorMessage?: string;
  validationErrors?: Array<{
    errorMessage?: string;
  }>;
}

// Define an explicit type for your form values
interface FormValues {
  keyName: string;
  moduleId: string;
  resources: { value: string; culture: string }[];
  routes: { value: string }[];
  context?: string;
}

const schema = z.object({
  keyName: z
    .string()
    .trim()
    .min(1, { message: "Key name is required" })
    .min(3, { message: "Key name must be at least 3 characters" })
    .max(100, { message: "Key name must be 100 characters or less" }),
  moduleId: z.string().min(1, { message: "Module is required" }),
  resources: z
    .array(
      z.object({
        value: z
          .string()
          .max(199, {
            message: "Translation must be less than 200 characters",
          }),
        culture: z.string().min(1, { message: "Culture is required" }),
      }),
    )
    .superRefine((resources, ctx) => {
      if (!resources[0]?.value) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Default value is required",
          path: [0, "value"], // Path to the first resource's value
        });
      }
    }),
  routes: z
    .array(
      z.object({ value: z.string().min(1, { message: "Route is required" }) }),
    )
    .optional(),
  context: z.string().optional(),
});

function AddNewLanguageKey() {
  const { isLoading: isLanguageModulesLoading, data: languageModules } =
    useGetLanguageModules();
  const { isLoading: isLanguageListLoading, data: languageListData } =
    useGetLanguages();
  const navigate = useNavigate();
  const [isNewModuleDialogOpen, setIsNewModuleDialogOpen] =
    React.useState(false);
  const [open, setOpen] = React.useState(false);
  const inputRef = useRef(null);
  const { isPending, mutateAsync } = useSaveBlocksLanguageKey();

  const { mutateAsync: autoTranslateAsync } = useGetTranslationSuggestion();

  const [loadingIndex, setLoadingIndex] = React.useState<number | null>(null);
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";

  // Set breadcrumb title synchronously
  BREADCRUMB_CUSTOM_TITLES["/services/language/translations/new-key"] =
    "New Key";
  const form = useForm<FormValues>({
    defaultValues: {
      keyName: "",
      moduleId: "",
      resources: [],
      routes: [],
      context: "",
    },
    resolver: zodResolver(schema),
    mode: "onChange", // Validate on change to provide immediate feedback
  });

  // Field array for resources
  const { fields: resourceFields, replace: replaceResources } =
    useFieldArray<FormValues>({
      control: form.control,
      name: "resources",
    });

  // Field array for routes
  const {
    fields: routeFields,
    append: appendRoute,
    remove: removeRoute,
  } = useFieldArray<FormValues>({
    control: form.control,
    name: "routes",
  });

  React.useEffect(() => {
    if (!languageListData?.length) {
      return;
    }

    const existingResources = form.getValues("resources");

    if (existingResources.length === 0) {
      replaceResources(
        languageListData.map((lang: ILanguageConfig) => ({
          value: "",
          culture: lang.languageCode || "",
        })),
      );
      return;
    }

    if (
      existingResources.length !== languageListData.length ||
      languageListData.some(
        (lang: ILanguageConfig, index: number) =>
          existingResources[index]?.culture !== (lang.languageCode || ""),
      )
    ) {
      const mergedResources = languageListData.map(
        (lang: ILanguageConfig, index: number) => ({
          value: existingResources[index]?.value ?? "",
          culture: lang.languageCode || "",
        }),
      );

      replaceResources(mergedResources);
    }
  }, [form, languageListData, replaceResources]);

  const formSubmitHandler = async (data: FormValues) => {
    try {
      const payload = {
        keyName: data.keyName,
        moduleId: data.moduleId,
        resources: data.resources,
        routes: data.routes?.map((route) => route.value) || [],
        isPartiallyTranslated: true,
        projectKey: tenantId,
        itemId: "",
        isNewKey: true,
        context: data.context || "",
      };
      const res = await mutateAsync(payload);
      if (res?.success) {
        toast({
          variant: "success",
          title: "Success",
          description: "Language key added",
        });
        form.reset();
        navigate("/services/language", { replace: true });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: buildErrorMessage(res),
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

  const buildErrorMessage = (response: MutationResponse | undefined) => {
    if (!response) {
      return "Something went wrong";
    }

    const validationMessages = response.validationErrors
      ?.map((validationError) => validationError?.errorMessage)
      .filter(Boolean);

    if (validationMessages && validationMessages.length > 0) {
      return validationMessages.join("\n");
    }

    if (response.errorMessage) {
      return response.errorMessage;
    }

    return "Unable to save language key";
  };

  function autoTranslate(
    destinationLanguage: string | undefined,
    defaultLanguageText: string,
    index: number,
  ): React.MouseEventHandler<HTMLButtonElement> {
    return async (e) => {
      e.preventDefault();
      setLoadingIndex(index); // Set the loading state for the clicked button
      try {
        const payload = {
          sourceText: defaultLanguageText,
          destinationLanguage: destinationLanguage || "English",
          currentLanguage: "English",
          temperature: 0.1,
          // elementDetailContext: "",
          projectKey: tenantId,
        };
        const res = await autoTranslateAsync(payload);
        if (res.content) {
          toast({
            variant: "success",
            title: "Success",
            description: "Translated successfully",
          });
          // Update the resource at the given index + 1 (translations)
          form.setValue(`resources.${index + 1}.value`, res.content);
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: JSON.stringify(res?.errors),
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: JSON.stringify(error),
        });
      } finally {
        setLoadingIndex(null); // Reset the loading state.
      }
    };
  }

  if (isLanguageModulesLoading || isLanguageListLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  languageListData?.sort((a, b) => (a.isDefault && !b.isDefault ? -1 : 1));
  return (
    <div className="">
      <div className="hidden pl-5 md:flex">
        <PageBreadcrumb breadcrumbIndex={2} />
      </div>
      {/* <div className="ml-10 hidden min-h-screen max-w-80 flex-col gap-5 bg-background p-5 pt-24 md:flex">
        <div className="mx-2 my-3">
          <div className="flex gap-2">
            <Link href="/services/language">
              <X size={32} strokeWidth={1} />
            </Link>
            <p className="mt-[2px] text-lg font-semibold">New Key</p>
          </div>
          <p className="mb-7 mt-2 text-sm font-normal text-medium-emphasis">
            Add new key with details and translations
          </p>
        </div>
      </div> */}
      <div className="mt-4 h-[calc(100vh-10px)] flex-1 overflow-scroll">
        <div className="flex-1 pl-5 pr-5">
          {/* <div className="mt-10 md:mt-24"> */}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(formSubmitHandler)}>
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-semibold">Create new key</h1>
                <Button
                  variant="default"
                  type="submit"
                  disabled={isPending || !form.formState.isValid}
                >
                  Save
                </Button>
              </div>
              <Card className="mt-6 rounded-sm border border-border shadow-none">
                <CardHeader>
                  <CardTitle>About the key</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6">
                    <div className="grid grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="keyName"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel htmlFor="keyName">Key name</FormLabel>
                            <FormControl>
                              <Input
                                id="keyName"
                                type="text"
                                className="w-full shadow-none"
                                placeholder="Enter key name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-xs leading-4" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="moduleId"
                        render={({ field }) => {
                          const selectedModule = languageModules?.find(
                            (module) => module.itemId === field.value,
                          );
                          return (
                            <FormItem className="space-y-1">
                              <FormLabel htmlFor="moduleId">Module</FormLabel>
                              <Popover open={open} onOpenChange={setOpen}>
                                <PopoverTrigger asChild>
                                  <Button
                                    id="moduleId"
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={open}
                                    className="h-[37px] w-full justify-between text-low-emphasis shadow-none"
                                  >
                                    {selectedModule?.moduleName ||
                                      "Select Module..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 sm:w-[475px]">
                                  <Command>
                                    <CommandInput
                                      placeholder="Search Module..."
                                      ref={inputRef}
                                    />
                                    <CommandList>
                                      <CommandEmpty>
                                        No Module found.
                                      </CommandEmpty>
                                      <CommandGroup>
                                        <Dialog
                                          open={isNewModuleDialogOpen}
                                          onOpenChange={
                                            setIsNewModuleDialogOpen
                                          }
                                        >
                                          <DialogTrigger asChild>
                                            <div
                                              aria-expanded={open}
                                              onClick={() => {
                                                setIsNewModuleDialogOpen(true);
                                              }}
                                              className="ml-8 flex h-[37px] w-full cursor-pointer gap-2 py-2 text-sm text-medium-emphasis"
                                            >
                                              <Plus className="h-5 w-5 shrink-0 pl-[-6px] text-medium-emphasis" />
                                              <div>New Module</div>
                                            </div>
                                          </DialogTrigger>
                                          <NewModule
                                            onClose={setIsNewModuleDialogOpen}
                                          />
                                        </Dialog>
                                        <h3 className="py-2 pl-8 font-semibold text-high-emphasis">
                                          Modules
                                        </h3>
                                        {languageModules?.map((module) => {
                                          const moduleSearchValue = [
                                            module.moduleName,
                                            module.itemId,
                                          ]
                                            .filter(Boolean)
                                            .join(" ")
                                            .toLowerCase();

                                          return (
                                            <CommandItem
                                              key={module.itemId}
                                              value={moduleSearchValue}
                                              keywords={[
                                                module.moduleName ?? "",
                                                module.itemId ?? "",
                                              ]}
                                              onSelect={() => {
                                                const nextValue =
                                                  module.itemId === field.value
                                                    ? ""
                                                    : module.itemId;
                                                field.onChange(nextValue);
                                                setOpen(false);
                                                void form.trigger("moduleId");
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  field.value === module.itemId
                                                    ? "opacity-100"
                                                    : "opacity-0",
                                                )}
                                              />
                                              {module.moduleName}
                                            </CommandItem>
                                          );
                                        })}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              <FormMessage className="text-xs leading-4" />
                            </FormItem>
                          );
                        }}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="resources.0.value"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel htmlFor="defaultValue">
                            Default value ({languageListData?.[0]?.languageName}
                            )
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              id="defaultValue"
                              placeholder="Enter default value"
                              className="min-h-20 shadow-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-xs leading-4" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="context"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel htmlFor="context">Key Context</FormLabel>
                          <FormControl>
                            <Textarea
                              id="context"
                              placeholder="Enter key context (optional)"
                              className="min-h-20 shadow-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-xs leading-4" />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-4 rounded-sm border border-border shadow-none">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Translations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {resourceFields.slice(1).map((field, index) => (
                      <div key={field.id} className="grid gap-3">
                        <div className="grid grid-cols-2">
                          <Label>
                            {languageListData?.[index + 1]?.languageName}{" "}
                            Translation
                          </Label>
                          <div className="flex justify-end gap-4">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1"
                              disabled={
                                loadingIndex === index ||
                                !form.watch().resources[0].value
                              } // Disable only the clicked button.
                              onClick={autoTranslate(
                                languageListData?.[index + 1]?.languageName,
                                form.getValues().resources[0].value,
                                index,
                              )}
                            >
                              <Wand className="h-3.5 w-3.5" />
                              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                {loadingIndex === index
                                  ? "Loading..."
                                  : "Auto-Translate"}{" "}
                                {/* Show loading text */}
                              </span>
                            </Button>
                          </div>
                        </div>
                        <FormControl>
                          <Textarea
                            placeholder="Enter translation"
                            className="min-h-20 shadow-none"
                            {...form.register(`resources.${index + 1}.value`)}
                          />
                        </FormControl>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Routes Section using useFieldArray for routes */}
              <Card className="mt-4 rounded-sm border border-border shadow-none">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Routes</CardTitle>
                  <div className="flex h-7 items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="p-0 hover:bg-background"
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent
                          className="min-w-[400px] text-left"
                          side="left"
                          align="start"
                        >
                          <ul className="list-disc pl-5">
                            <li className="text-[12px]">
                              Add routes after <strong>hostname/</strong>
                            </li>
                            <li className="text-[12px]">
                              Replace dynamic parts of the route as{" "}
                              <strong>{"{{ dynamic_routing }}"}</strong>
                            </li>
                            <div className="max-w-[380px] overflow-hidden text-ellipsis whitespace-normal">
                              <p className="text-[12px]">
                                For example,
                                http://blocks.seliselocal.com/release-note/:id
                                will be added as release-note/
                                <strong>{"{{ dynamic_routing }}"}</strong>
                              </p>
                            </div>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {routeFields.map((field, index) => (
                      <div key={field.id} className="flex items-end gap-2">
                        <div className="grid w-full gap-1.5">
                          <Label htmlFor={`routes.${index}.value`}>
                            Route {index + 1}
                          </Label>
                          <Input
                            id={`routes.${index}.value`}
                            type="text"
                            className="w-full shadow-none"
                            placeholder="Enter route"
                            {...form.register(`routes.${index}.value`)}
                          />
                          {form.formState.errors.routes?.[index]?.value
                            ?.message ? (
                            <p className="text-xs text-destructive">
                              {
                                form.formState.errors.routes?.[index]?.value
                                  ?.message
                              }
                            </p>
                          ) : null}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRoute(index)}
                          aria-label="Remove Route"
                        >
                          <Trash className="h-6 w-6 text-error" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      className="w-[150px]"
                      onClick={() => appendRoute({ value: "" })}
                    >
                      <Plus className="h-5 w-5" />
                      <span>Add Route</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* <Button variant="default" className="my-5" type="submit" disabled={isPending}>
                Save
              </Button> */}
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}

export { AddNewLanguageKey };
