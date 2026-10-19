import { FC, KeyboardEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Check, ChevronDown, ChevronsUpDown, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui-kits/sheet/sheet";
import { ScrollArea } from "@/components/ui-kits/scroll-area/scroll-area";
import { Separator } from "@/components/ui-kits/separator/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";
import { Switch } from "@/components/ui-kits/switch/switch";
import { Label } from "@/components/ui-kits/label/label";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Alert, AlertDescription } from "@/components/ui-kits/alert/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui-kits/collapsible/collapsible";
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
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui-kits/command/command";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { formatErrorMessage } from "@/lib/error";
import {
  useGetLanguageModules,
  useGetLanguages,
  useSaveGlossary,
  useSearchGlossaries,
} from "@blocks-localization/hooks/use-language-manager";
import {
  GLOSSARY_TYPE_OPTIONS,
  IGlossary,
  ILanguageConfig,
} from "@blocks-localization/models/language";
import { GlossaryMeta, GlossaryRule } from "@blocks-localization/models/glossary-meta";
import {
  findDuplicateGlossary,
  normalizeGlossaryName,
} from "@blocks-localization/utils/glossary-name";
import { parseGlossaryMeta, serializeGlossaryMeta } from "@blocks-localization/utils/glossary-meta";
import {
  buildGlossaryContext,
  buildRuleMarker,
  getTargetLanguages,
  stripRuleMarker,
} from "@blocks-localization/utils/glossary-rule-marker";
import { GLOSSARY_RULE_LABELS } from "@blocks-localization/components/glossary/glossary-rule-badge";

const DUPLICATE_CHECK_DEBOUNCE_MS = 300;

export const GLOSSARY_LIMITS = {
  name: 200,
  variants: 20,
  value: 200,
  forbiddenPerLanguage: 10,
  definition: 1000,
  note: 2000,
  serialized: 20000,
} as const;

type GlossaryScope = "project" | "modules";

interface GlossaryEditorValues {
  name: string;
  language: string;
  type: string;
  rule: GlossaryRule;
  caseSensitive: boolean;
  variants: string[];
  translations: Record<string, string>;
  forbidden: Record<string, string[]>;
  definition: string;
  scope: GlossaryScope;
  moduleIds: string[];
  note: string;
}

const RULE_OPTIONS: GlossaryRule[] = ["translate", "keep", "forbidden"];

const withoutValue = (values: string[], value: string) => values.filter((item) => item !== value);

const toggleValue = (values: string[], value: string) =>
  values.includes(value) ? withoutValue(values, value) : [...values, value];

const firstVariantError = (variants: string[], name: string): string | undefined => {
  if (variants.length > GLOSSARY_LIMITS.variants) {
    return `Add at most ${GLOSSARY_LIMITS.variants} variants`;
  }
  const normalizedName = normalizeGlossaryName(name);
  const seen = new Set<string>();
  for (const variant of variants) {
    if (variant.trim().length > GLOSSARY_LIMITS.value) {
      return `Variant must be ${GLOSSARY_LIMITS.value} characters or fewer`;
    }
    const normalized = normalizeGlossaryName(variant);
    if (normalized === normalizedName) return "Variant can't be the same as the term";
    if (seen.has(normalized)) return "Variant already listed";
    seen.add(normalized);
  }
  return undefined;
};

const firstForbiddenError = (
  values: string[],
  translation: string | undefined,
  checkTranslation: boolean,
): string | undefined => {
  if (values.length > GLOSSARY_LIMITS.forbiddenPerLanguage) {
    return `Add at most ${GLOSSARY_LIMITS.forbiddenPerLanguage} forbidden alternatives per language`;
  }
  const normalizedTranslation = normalizeGlossaryName(translation ?? "");
  for (const value of values) {
    if (value.trim().length > GLOSSARY_LIMITS.value) {
      return `Forbidden alternative must be ${GLOSSARY_LIMITS.value} characters or fewer`;
    }
    if (
      checkTranslation &&
      normalizedTranslation &&
      normalizeGlossaryName(value) === normalizedTranslation
    ) {
      return "A translation can't also be forbidden";
    }
  }
  return undefined;
};

/** Validation only covers languages shown in the editor; other stored entries pass through. */
const buildSchema = (targetCodes: string[]) =>
  z
    .object({
      name: z
        .string()
        .trim()
        .min(1, { message: "Name is required" })
        .max(GLOSSARY_LIMITS.name, {
          message: `Name must be ${GLOSSARY_LIMITS.name} characters or fewer`,
        }),
      language: z.string(),
      type: z.string(),
      rule: z.enum(["translate", "keep", "forbidden"]),
      caseSensitive: z.boolean(),
      variants: z.array(z.string()),
      translations: z.record(z.string(), z.string()),
      forbidden: z.record(z.string(), z.array(z.string())),
      definition: z.string().max(GLOSSARY_LIMITS.definition, {
        message: "Definition must be 1,000 characters or fewer",
      }),
      scope: z.enum(["project", "modules"]),
      moduleIds: z.array(z.string()),
      note: z.string().max(GLOSSARY_LIMITS.note, {
        message: "Note must be 2,000 characters or fewer",
      }),
    })
    .superRefine((values, ctx) => {
      const variantError = firstVariantError(values.variants, values.name);
      if (variantError) {
        ctx.addIssue({ code: "custom", path: ["variants"], message: variantError });
      }

      for (const code of targetCodes) {
        const translation = values.translations[code];
        if (
          values.rule === "translate" &&
          (translation ?? "").trim().length > GLOSSARY_LIMITS.value
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["translations", code],
            message: "Translation must be 200 characters or fewer",
          });
        }
        if (values.rule !== "keep") {
          const forbiddenError = firstForbiddenError(
            values.forbidden[code] ?? [],
            translation,
            values.rule === "translate",
          );
          if (forbiddenError) {
            ctx.addIssue({ code: "custom", path: ["forbidden", code], message: forbiddenError });
          }
        }
      }

      if (values.scope === "modules" && values.moduleIds.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["moduleIds"],
          message: "Select at least one module",
        });
      }
    });

const getInitialScope = (glossary?: IGlossary): GlossaryScope => {
  if (!glossary || glossary.isGlobal) return "project";
  return "modules";
};

const getInitialValues = (glossary: IGlossary | undefined, meta: GlossaryMeta, note: string) => ({
  name: glossary?.name ?? "",
  language: glossary?.language ?? "",
  type: glossary?.type ?? "",
  rule: meta.rule,
  caseSensitive: meta.caseSensitive,
  variants: [...meta.variants],
  translations: { ...meta.translations },
  forbidden: Object.fromEntries(
    Object.entries(meta.forbidden).map(([code, values]) => [code, [...values]]),
  ),
  definition: stripRuleMarker(glossary?.context),
  scope: getInitialScope(glossary),
  moduleIds: glossary?.moduleIds ?? [],
  note,
});

interface ChipInputProps {
  id?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  removeLabel: (value: string) => string;
  disabled?: boolean;
  ariaLabel?: string;
}

/** Text input where Enter or a comma turns the text into a removable chip. */
const ChipInput = ({
  id,
  values,
  onChange,
  placeholder,
  removeLabel,
  disabled,
  ariaLabel,
}: Readonly<ChipInputProps>) => {
  const [draft, setDraft] = useState("");

  const addValues = (items: string[]) => {
    const next = items.map((item) => item.trim()).filter(Boolean);
    if (next.length > 0) onChange([...values, ...next]);
  };

  const handleChange = (text: string) => {
    if (!text.includes(",")) {
      setDraft(text);
      return;
    }
    const parts = text.split(",");
    setDraft(parts.pop() ?? "");
    addValues(parts);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addValues([draft]);
    setDraft("");
  };

  return (
    <div className="grid gap-2">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((value, index) => (
            <Badge key={`${value}-${index}`} variant="secondary" className="gap-1 pr-1">
              {value}
              <button
                type="button"
                aria-label={removeLabel(value)}
                disabled={disabled}
                onClick={() => onChange(values.filter((_, i) => i !== index))}
                className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        id={id}
        aria-label={ariaLabel}
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        className="border-default border shadow-none"
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          addValues([draft]);
          setDraft("");
        }}
      />
    </div>
  );
};

const FieldError = ({ message }: Readonly<{ message?: string }>) =>
  message ? <p className="text-sm font-medium text-destructive">{message}</p> : null;

interface GlossaryEditorFormProps {
  glossary?: IGlossary;
  onClose: () => void;
}

const GlossaryEditorForm: FC<GlossaryEditorFormProps> = ({ glossary, onClose }) => {
  const isEditMode = !!glossary;
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const { isPending, mutateAsync } = useSaveGlossary();
  const { data: languageListData } = useGetLanguages();
  const { data: moduleListData } = useGetLanguageModules();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [modulePopoverOpen, setModulePopoverOpen] = useState(false);

  // Parsed once per open: the form state is the single source of truth afterwards.
  const [parsed] = useState(() => parseGlossaryMeta(glossary?.additionalNote));
  const isReadOnly = parsed.status === "unsupported-version";
  const [noteOpen, setNoteOpen] = useState(() => !!parsed.meta.note);

  const targetLanguages = useMemo(() => getTargetLanguages(languageListData), [languageListData]);
  const schema = useMemo(
    () => buildSchema(targetLanguages.map((language) => language.languageCode)),
    [targetLanguages],
  );

  const form = useForm<GlossaryEditorValues>({
    defaultValues: getInitialValues(glossary, parsed.meta, parsed.meta.note ?? ""),
    resolver: zodResolver(schema),
  });
  const { control, formState } = form;

  const [selectedLanguage, rule, scope, rawName, moduleIds, translations, forbidden] = useWatch({
    control,
    name: ["language", "rule", "scope", "name", "moduleIds", "translations", "forbidden"],
  });

  const trimmedName = (rawName ?? "").trim();
  const [debouncedName, setDebouncedName] = useState(trimmedName);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedName(trimmedName), DUPLICATE_CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmedName]);

  // Advisory only: the warning never blocks submit, and a failed or superseded check shows nothing.
  const isNameSettled = !!debouncedName && debouncedName === trimmedName;
  const { data: nameMatches, isError: isDuplicateCheckError } = useSearchGlossaries(
    debouncedName,
    isNameSettled,
  );
  const duplicateGlossary =
    isNameSettled && !isDuplicateCheckError
      ? findDuplicateGlossary(debouncedName, nameMatches?.items, glossary?.itemId)
      : undefined;

  const openDuplicateGlossary = (itemId: string) => {
    onClose();
    navigate(scoped(`services/glossary/${itemId}`));
  };

  const legacyModuleCount =
    glossary?.isGlobal && (glossary.moduleIds?.length ?? 0) > 0 ? glossary.moduleIds!.length : 0;

  const translationError = (code: string) => formState.errors.translations?.[code]?.message;
  const forbiddenError = (code: string) =>
    (formState.errors.forbidden?.[code] as { message?: string } | undefined)?.message;

  // Re-validate record fields live once the user has tried to save, like the other fields.
  const setTranslation = (code: string, value: string) =>
    form.setValue(
      "translations",
      { ...form.getValues("translations"), [code]: value },
      { shouldValidate: formState.isSubmitted },
    );
  const setForbidden = (code: string, values: string[]) =>
    form.setValue(
      "forbidden",
      { ...form.getValues("forbidden"), [code]: values },
      { shouldValidate: formState.isSubmitted },
    );

  const formSubmitHandler = async (data: GlossaryEditorValues) => {
    const meta: GlossaryMeta = {
      rule: data.rule,
      caseSensitive: data.caseSensitive,
      variants: data.variants,
      translations: data.translations,
      forbidden: data.forbidden,
      note: data.note,
    };
    const additionalNote = serializeGlossaryMeta(meta);
    if (additionalNote.length > GLOSSARY_LIMITS.serialized) {
      form.setError("root.serialized", { message: "Too much terminology data for one term" });
      return;
    }

    const languages: ILanguageConfig[] = languageListData ?? [];
    const payload = {
      ...(isEditMode && glossary?.itemId ? { itemId: glossary.itemId } : {}),
      name: data.name.trim(),
      language: data.language,
      type: data.type,
      context: buildGlossaryContext(
        data.definition,
        buildRuleMarker(parseGlossaryMeta(additionalNote).meta, languages),
      ),
      additionalNote,
      isGlobal: data.scope === "project",
      moduleIds: data.scope === "project" ? [] : data.moduleIds,
    };

    try {
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
      } else if (Array.isArray(res?.validationErrors) && res.validationErrors.length > 0) {
        res.validationErrors.forEach((error) => {
          showErrorToast({ errors: error.errorMessage });
        });
      } else {
        showErrorToast({ errors: res?.errorMessage });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: formatErrorMessage(error),
      });
    }
  };

  const renderTranslationRow = (language: ILanguageConfig) => {
    const code = language.languageCode;
    const label = `${language.languageName} (${code})`;
    const inputId = `glossary-translation-${code}`;
    const forbiddenValues = forbidden?.[code] ?? [];
    const forbiddenInput = (
      <ChipInput
        id={`glossary-forbidden-${code}`}
        ariaLabel={`Forbidden alternatives for ${label}`}
        values={forbiddenValues}
        onChange={(values) => setForbidden(code, values)}
        placeholder="Type and press Enter"
        removeLabel={(value) => `Remove forbidden alternative ${value} for ${code}`}
        disabled={isReadOnly}
      />
    );

    if (rule === "forbidden") {
      return (
        <div key={code} className="grid gap-2">
          <Label htmlFor={`glossary-forbidden-${code}`} className="text-high-emphasis">
            {label}
          </Label>
          {forbiddenInput}
          <FieldError message={forbiddenError(code)} />
        </div>
      );
    }

    return (
      <div key={code} className="grid gap-2">
        <Label htmlFor={inputId} className="text-high-emphasis">
          {label}
        </Label>
        <Input
          id={inputId}
          value={translations?.[code] ?? ""}
          onChange={(event) => setTranslation(code, event.target.value)}
          placeholder="Approved translation"
          className="border-default border shadow-none"
          disabled={isReadOnly}
        />
        <FieldError message={translationError(code)} />
        <Collapsible defaultOpen={forbiddenValues.length > 0}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-fit gap-1 px-2 text-medium-emphasis"
            >
              Forbidden alternatives
              {forbiddenValues.length > 0 && ` (${forbiddenValues.length})`}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">{forbiddenInput}</CollapsibleContent>
        </Collapsible>
        <FieldError message={forbiddenError(code)} />
      </div>
    );
  };

  const renderTranslationsBody = () => {
    if (targetLanguages.length === 0) {
      return (
        <p className="text-sm text-medium-emphasis">
          Add another language to the project to record translations.
        </p>
      );
    }
    return (
      <>
        {rule === "forbidden" && (
          <p className="text-sm text-medium-emphasis">
            Alternatives that must not be used, per language.
          </p>
        )}
        {targetLanguages.map(renderTranslationRow)}
      </>
    );
  };

  return (
    <>
      <SheetHeader className="px-6 pt-6 pb-4">
        <SheetTitle>{isEditMode ? "Edit term" : "Add term"}</SheetTitle>
        <SheetDescription className="sr-only">
          Define the term, its translations, meaning and scope.
        </SheetDescription>
      </SheetHeader>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(formSubmitHandler)}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
        >
          <ScrollArea className="min-h-0 flex-1">
            <fieldset disabled={isReadOnly} className="grid min-w-0 gap-6 px-6 pb-6">
              {parsed.status === "corrupt" && (
                <Alert className="border-warning-200 bg-warning-50 text-warning-700">
                  <TriangleAlert />
                  <AlertDescription className="text-warning-700">
                    Stored terminology data could not be read. Saving will replace it.
                  </AlertDescription>
                </Alert>
              )}
              {isReadOnly && (
                <Alert className="border-warning-200 bg-warning-50 text-warning-700">
                  <TriangleAlert />
                  <AlertDescription className="text-warning-700">
                    This term was saved by a newer version and can&apos;t be edited here.
                  </AlertDescription>
                </Alert>
              )}

              {/* Term */}
              <section className="grid gap-4" aria-labelledby="glossary-section-term">
                <h3 id="glossary-section-term" className="text-sm font-medium text-high-emphasis">
                  Term
                </h3>
                <FormField
                  name="name"
                  control={control}
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
                      {duplicateGlossary && (
                        <FormDescription className="text-warning-700">
                          &apos;{duplicateGlossary.name}&apos; already exists.{" "}
                          <button
                            type="button"
                            className="font-medium underline underline-offset-4 hover:no-underline"
                            onClick={() => openDuplicateGlossary(duplicateGlossary.itemId)}
                          >
                            Open it
                          </button>
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="language"
                  control={control}
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
                            ? (languageListData?.find(
                                (lang) => lang.languageCode === selectedLanguage,
                              )?.languageName ?? selectedLanguage)
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
                  name="rule"
                  control={control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-left font-medium text-high-emphasis">
                        Rule
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={isReadOnly}
                          className="flex flex-wrap gap-4"
                        >
                          {RULE_OPTIONS.map((option) => (
                            <div key={option} className="flex items-center gap-2">
                              <RadioGroupItem value={option} id={`glossary-rule-${option}`} />
                              <Label htmlFor={`glossary-rule-${option}`} className="cursor-pointer">
                                {GLOSSARY_RULE_LABELS[option]}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="caseSensitive"
                  control={control}
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isReadOnly}
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer text-left font-medium text-high-emphasis">
                        Case-sensitive
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  name="variants"
                  control={control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel
                        htmlFor="glossary-variants"
                        className="text-left font-medium text-high-emphasis"
                      >
                        Variants
                      </FormLabel>
                      <ChipInput
                        id="glossary-variants"
                        values={field.value}
                        onChange={field.onChange}
                        placeholder="Plurals, synonyms… press Enter or comma"
                        removeLabel={(value) => `Remove variant ${value}`}
                        disabled={isReadOnly}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

              {rule !== "keep" && (
                <>
                  <Separator />
                  <section className="grid gap-4" aria-labelledby="glossary-section-translations">
                    <h3
                      id="glossary-section-translations"
                      className="text-sm font-medium text-high-emphasis"
                    >
                      Translations
                    </h3>
                    {renderTranslationsBody()}
                  </section>
                </>
              )}

              <Separator />

              {/* Meaning */}
              <section className="grid gap-4" aria-labelledby="glossary-section-meaning">
                <h3
                  id="glossary-section-meaning"
                  className="text-sm font-medium text-high-emphasis"
                >
                  Meaning
                </h3>
                <FormField
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-left font-medium text-high-emphasis">
                        Type
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isReadOnly}
                      >
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
                  name="definition"
                  control={control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-left font-medium text-high-emphasis">
                        Definition
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What the term means"
                          className="border-default resize-none border shadow-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Sent to the AI</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

              <Separator />

              {/* Scope */}
              <section className="grid gap-4" aria-labelledby="glossary-section-scope">
                <h3 id="glossary-section-scope" className="text-sm font-medium text-high-emphasis">
                  Scope
                </h3>
                <FormField
                  name="scope"
                  control={control}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            if (formState.isSubmitted) void form.trigger("moduleIds");
                          }}
                          disabled={isReadOnly}
                          aria-label="Scope"
                          className="flex flex-wrap gap-4"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="project" id="glossary-scope-project" />
                            <Label htmlFor="glossary-scope-project" className="cursor-pointer">
                              Whole project
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="modules" id="glossary-scope-modules" />
                            <Label htmlFor="glossary-scope-modules" className="cursor-pointer">
                              Specific modules
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      {scope === "project" && legacyModuleCount > 0 && (
                        <FormDescription>
                          Also linked to {legacyModuleCount} module
                          {legacyModuleCount === 1 ? "" : "s"}. Saving as Whole project removes
                          those links.
                        </FormDescription>
                      )}
                    </FormItem>
                  )}
                />

                {scope === "modules" && (
                  <FormField
                    name="moduleIds"
                    control={control}
                    render={({ field }) => (
                      <FormItem>
                        {(moduleIds?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {moduleIds.map((id) => {
                              const mod = moduleListData?.find((m) => m.itemId === id);
                              return (
                                <Badge key={id} variant="secondary" className="gap-1 pr-1">
                                  {mod?.moduleName ?? id}
                                  <button
                                    type="button"
                                    aria-label={`Remove module ${mod?.moduleName ?? id}`}
                                    onClick={() => {
                                      field.onChange(withoutValue(moduleIds, id));
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
                              aria-label="Tag modules"
                              className="w-full justify-between font-normal"
                            >
                              Tag modules...
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            portalled={false}
                            className="z-60 w-[var(--radix-popover-trigger-width)] p-0"
                            align="start"
                          >
                            <Command>
                              <CommandInput placeholder="Search modules..." />
                              <CommandList>
                                <CommandEmpty>No modules found.</CommandEmpty>
                                <CommandGroup>
                                  {moduleListData?.map((mod) => {
                                    const isSelected = moduleIds.includes(mod.itemId);
                                    return (
                                      <CommandItem
                                        key={mod.itemId}
                                        value={[mod.moduleName, mod.itemId]
                                          .filter(Boolean)
                                          .join(" ")
                                          .toLowerCase()}
                                        keywords={[mod.moduleName ?? "", mod.itemId ?? ""]}
                                        onSelect={() => {
                                          field.onChange(
                                            toggleValue(form.getValues("moduleIds"), mod.itemId),
                                          );
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
                )}
              </section>

              <Separator />

              {/* Internal note */}
              <Collapsible open={noteOpen} onOpenChange={setNoteOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto w-full justify-between p-0 text-sm font-medium text-high-emphasis hover:bg-transparent"
                  >
                    Internal note
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${noteOpen ? "rotate-180" : ""}`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <FormField
                    name="note"
                    control={control}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            aria-label="Internal note"
                            placeholder="Notes for your team"
                            className="border-default resize-none border shadow-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>Not sent to the AI</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CollapsibleContent>
              </Collapsible>

              <FieldError message={formState.errors.root?.serialized?.message} />
            </fieldset>
          </ScrollArea>

          <SheetFooter className="gap-2 border-t bg-background px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || isReadOnly}>
              {isPending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save
            </Button>
          </SheetFooter>
        </form>
      </Form>
    </>
  );
};

interface GlossaryEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  glossary?: IGlossary;
  /** Optional trigger: when given, focus returns to it after the sheet closes. */
  trigger?: ReactNode;
}

/**
 * Side-sheet editor for a glossary term. The form mounts only while open, so closing
 * discards unsaved changes and every open starts from the stored values.
 */
const GlossaryEditorSheet: FC<GlossaryEditorSheetProps> = ({
  open,
  onOpenChange,
  glossary,
  trigger,
}) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
    <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
      {open && <GlossaryEditorForm glossary={glossary} onClose={() => onOpenChange(false)} />}
    </SheetContent>
  </Sheet>
);

export default GlossaryEditorSheet;
