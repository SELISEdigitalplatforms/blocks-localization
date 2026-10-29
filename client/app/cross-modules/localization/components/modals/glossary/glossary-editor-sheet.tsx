import { FC, KeyboardEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import {
  Check,
  ChevronDown,
  Plus,
  Sparkles,
  ChevronsUpDown,
  Info,
  LoaderCircle,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import {
  Sheet,
  SheetClose,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui-kits/command/command";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { formatErrorMessage } from "@/lib/error";
import {
  useFetchLatestGlossary,
  useGetLanguageModules,
  useGetLanguages,
  useSaveGlossary,
  useSearchGlossaries,
} from "@blocks-localization/hooks/use-language-manager";
import {
  GLOSSARY_PARTS_OF_SPEECH,
  GLOSSARY_PART_OF_SPEECH_LABELS,
  GLOSSARY_STATUSES,
  GLOSSARY_TYPE_OPTIONS,
  GlossaryPartOfSpeech,
  GlossaryStatus,
  IGlossary,
  IGlossaryTranslation,
  ILanguageConfig,
} from "@blocks-localization/models/language";
import { GlossaryMeta, GlossaryRule } from "@blocks-localization/models/glossary-meta";
import {
  findDuplicateGlossary,
  normalizeGlossaryName,
} from "@blocks-localization/utils/glossary-name";
import { parseGlossaryMeta } from "@blocks-localization/utils/glossary-meta";
import {
  getGlossaryNote,
  getGlossaryStatus,
  isUnsupportedGlossaryNote,
  toGlossaryMeta,
} from "@blocks-localization/utils/glossary-display";
import {
  getDefaultLanguage,
  getTargetLanguages,
  stripRuleMarker,
} from "@blocks-localization/utils/glossary-rule-marker";
import { useGlossaryTermSuggestion } from "@blocks-localization/hooks/use-glossary-term-suggestion";
import { GLOSSARY_LIMITS } from "@blocks-localization/constants/glossary-limits";
import { GLOSSARY_RULE_LABELS } from "@blocks-localization/components/glossary/glossary-rule-badge";
import { GLOSSARY_STATUS_LABELS } from "@blocks-localization/components/glossary/glossary-status-badge";

const DUPLICATE_CHECK_DEBOUNCE_MS = 300;

/** `validationErrors` property the server uses when the term changed since the edit started. */
const VERSION_ERROR_PROPERTY = "Version";

const isNotFoundError = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { status?: unknown }).status === 404;

export { GLOSSARY_LIMITS };

/** Select value for "no part of speech"; Radix Select items can't have an empty value. */
const NO_PART_OF_SPEECH = "none";

type GlossaryScope = "project" | "modules";

interface GlossaryEditorValues {
  name: string;
  language: string;
  type: string;
  rule: GlossaryRule;
  status: GlossaryStatus;
  caseSensitive: boolean;
  variants: string[];
  translations: Record<string, string>;
  forbidden: Record<string, string[]>;
  definition: string;
  scope: GlossaryScope;
  moduleIds: string[];
  note: string;
  /** "" = not set. */
  partOfSpeech: string;
  usageExamples: string[];
}

const RULE_OPTIONS: GlossaryRule[] = ["translate", "keep", "forbidden"];

const RULE_DESCRIPTIONS: Record<GlossaryRule, string> = {
  translate: "Always use the approved translation.",
  keep: "Leave unchanged, e.g. brand names.",
  forbidden: "Must not appear in translations.",
};

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

/**
 * Validation only covers languages shown in the editor; other stored entries pass through.
 * Variants are only validated while they are editable (flag on); otherwise they are kept as stored.
 */
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
      status: z.enum(["draft", "approved", "deprecated"]),
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
      partOfSpeech: z.string(),
      usageExamples: z.array(z.string()),
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

      const examples = values.usageExamples.map((example) => example.trim()).filter(Boolean);
      if (examples.length > GLOSSARY_LIMITS.usageExamples) {
        ctx.addIssue({
          code: "custom",
          path: ["usageExamples"],
          message: `Add at most ${GLOSSARY_LIMITS.usageExamples} usage examples`,
        });
      } else if (examples.some((example) => example.length > GLOSSARY_LIMITS.usageExample)) {
        ctx.addIssue({
          code: "custom",
          path: ["usageExamples"],
          message: `Each usage example must be ${GLOSSARY_LIMITS.usageExample} characters or fewer`,
        });
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

const getInitialValues = (
  glossary: IGlossary | undefined,
  meta: GlossaryMeta,
  note: string,
  initialName = "",
  defaultLanguageCode = "",
): GlossaryEditorValues => ({
  name: glossary?.name ?? initialName,
  // A new term starts in the project default language; an edit keeps the stored value, even "" (H9).
  language: glossary ? (glossary.language ?? "") : defaultLanguageCode,
  type: glossary?.type ?? "",
  rule: meta.rule,
  // New terms default to Approved (A1); legacy terms without a status are Approved too.
  status: glossary ? getGlossaryStatus(glossary) : "approved",
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
  partOfSpeech: glossary?.partOfSpeech ?? "",
  usageExamples: [...(glossary?.usageExamples ?? [])],
});

/**
 * The `translations` sent on save: one entry per culture with a value or forbidden values,
 * values trimmed and empty ones dropped. Cultures outside the project and values inactive
 * under the rule are sent back as loaded (C6, Phase 2 A9), so the merge never drops them.
 */
const buildTranslationsPayload = (
  translations: Record<string, string>,
  forbidden: Record<string, string[]>,
): IGlossaryTranslation[] => {
  const languages = [...new Set([...Object.keys(translations), ...Object.keys(forbidden)])];
  return languages.flatMap((language) => {
    const value = (translations[language] ?? "").trim();
    const forbiddenValues = (forbidden[language] ?? []).map((item) => item.trim()).filter(Boolean);
    return value || forbiddenValues.length > 0 ? [{ language, value, forbiddenValues }] : [];
  });
};

interface ChipInputProps {
  id?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  removeLabel: (value: string) => string;
  disabled?: boolean;
  ariaLabel?: string;
}

/** Token field: Enter or a comma turns the typed text into a removable chip inside the box. */
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
    <div className="flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50">
      {values.map((value, index) => (
        <Badge
          key={`${value}-${index}`}
          variant="secondary"
          className="h-6 max-w-full gap-1 rounded-md pr-1 font-normal"
        >
          <span className="truncate">{value}</span>
          <RemoveChipButton
            label={removeLabel(value)}
            disabled={disabled}
            onClick={() => onChange(values.filter((_, i) => i !== index))}
          />
        </Badge>
      ))}
      <Input
        id={id}
        aria-label={ariaLabel}
        value={draft}
        placeholder={values.length > 0 ? "Add another…" : placeholder}
        disabled={disabled}
        className="h-6 w-auto min-w-32 flex-1 border-0 bg-transparent px-1 py-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-100"
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

const RemoveChipButton = ({
  label,
  disabled,
  onClick,
}: Readonly<{ label: string; disabled?: boolean; onClick: () => void }>) => (
  <button
    type="button"
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className="inline-flex shrink-0 rounded-sm p-0.5 text-medium-emphasis hover:bg-muted-foreground/20 hover:text-high-emphasis focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
  >
    <X className="h-3 w-3" aria-hidden="true" />
  </button>
);

/** Info icon beside a field label; hovering or focusing it explains the field. */
const FieldInfo = ({ label, children }: Readonly<{ label: string; children: ReactNode }>) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        aria-label={`About ${label}`}
        className="inline-flex shrink-0 rounded-full text-low-emphasis transition-colors hover:text-medium-emphasis focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" align="start" className="max-w-72 text-left text-xs font-normal">
      {children}
    </TooltipContent>
  </Tooltip>
);

/** Field label row: label text plus an optional info tooltip, on one baseline. */
const LabelRow = ({ children }: Readonly<{ children: ReactNode }>) => (
  <div className="flex items-center gap-1.5">{children}</div>
);

const SectionHeading = ({
  id,
  title,
  description,
}: Readonly<{ id: string; title: string; description?: ReactNode }>) => (
  <div className="grid gap-1">
    <h3 id={id} className="text-base leading-6 font-semibold text-high-emphasis">
      {title}
    </h3>
    {description && <p className="text-sm text-medium-emphasis">{description}</p>}
  </div>
);

interface ChoiceCardProps {
  id: string;
  value: string;
  label: string;
  description: string;
}

/** Radio option as a card; the label stretches over the card so the whole card is clickable. */
const ChoiceCard = ({ id, value, label, description }: Readonly<ChoiceCardProps>) => (
  <div className="relative flex items-start gap-3 rounded-lg border border-input p-3 transition-colors hover:bg-muted/40 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
    <RadioGroupItem
      value={value}
      id={id}
      aria-describedby={`${id}-description`}
      className="mt-0.5 shrink-0"
    />
    <div className="grid min-w-0 gap-0.5">
      <Label
        htmlFor={id}
        className="cursor-pointer leading-5 text-high-emphasis after:absolute after:inset-0 after:content-['']"
      >
        {label}
      </Label>
      <p id={`${id}-description`} className="text-xs leading-4 text-medium-emphasis">
        {description}
      </p>
    </div>
  </div>
);

const CharacterCount = ({ value, max }: Readonly<{ value: string; max: number }>) => (
  <span
    className={`shrink-0 text-xs tabular-nums ${value.length > max ? "text-destructive" : "text-low-emphasis"}`}
  >
    {value.length.toLocaleString()}/{max.toLocaleString()}
  </span>
);

const FieldError = ({ message }: Readonly<{ message?: string }>) =>
  message ? <p className="text-sm font-medium text-destructive">{message}</p> : null;

interface GlossaryEditorFormProps {
  glossary?: IGlossary;
  onClose: () => void;
  /** Called with the freshly fetched term after "Reload latest"; the caller remounts the form with it. */
  onReloaded?: (glossary: IGlossary) => void;
  initialName?: string;
  onSaved?: (savedName: string) => void;
  onSelectExisting?: (glossary: IGlossary) => void;
}

const GlossaryEditorForm: FC<GlossaryEditorFormProps> = ({
  glossary,
  onClose,
  onReloaded,
  initialName,
  onSaved,
  onSelectExisting,
}) => {
  const isEditMode = !!glossary;
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const { isPending, mutateAsync } = useSaveGlossary();
  const fetchLatestGlossary = useFetchLatestGlossary();
  const [hasVersionConflict, setHasVersionConflict] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const { data: languageListData } = useGetLanguages();
  const { data: moduleListData } = useGetLanguageModules();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [modulePopoverOpen, setModulePopoverOpen] = useState(false);

  // Read once per open from the API fields: the form state is the single source of truth afterwards.
  const [stored] = useState(() => ({
    meta: toGlossaryMeta(glossary ?? {}),
    note: glossary ? getGlossaryNote(glossary) : "",
    isCorrupt: parseGlossaryMeta(glossary?.additionalNote).status === "corrupt",
  }));
  const isReadOnly = !!glossary && isUnsupportedGlossaryNote(glossary);
  const [noteOpen, setNoteOpen] = useState(() => !!stored.note);

  const targetLanguages = useMemo(() => getTargetLanguages(languageListData), [languageListData]);
  const schema = useMemo(
    () => buildSchema(targetLanguages.map((language) => language.languageCode)),
    [targetLanguages],
  );

  const defaultLanguage = getDefaultLanguage(languageListData);
  const form = useForm<GlossaryEditorValues>({
    defaultValues: getInitialValues(
      glossary,
      stored.meta,
      stored.note,
      initialName,
      defaultLanguage?.languageCode,
    ),
    resolver: zodResolver(schema),
  });
  const { control, formState } = form;
  const { suggest, suggestAll, pendingCodes, isSuggesting } = useGlossaryTermSuggestion();

  // Languages can arrive after the form mounted: preset a new term's untouched Language then.
  useEffect(() => {
    if (isEditMode || !defaultLanguage) return;
    if (form.getValues("language") || form.getFieldState("language").isDirty) return;
    form.setValue("language", defaultLanguage.languageCode);
  }, [isEditMode, defaultLanguage, form]);

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

  // Picker mode: navigating away would discard the tagging dialog, so select it instead.
  const resolveDuplicateGlossary = (duplicate: IGlossary) => {
    if (!onSelectExisting) {
      openDuplicateGlossary(duplicate.itemId);
      return;
    }
    onSelectExisting(duplicate);
    onClose();
  };

  const legacyModuleCount =
    glossary?.isGlobal && (glossary.moduleIds?.length ?? 0) > 0 ? glossary.moduleIds!.length : 0;

  const taggedModuleCount = moduleIds?.length ?? 0;
  const taggedModuleSuffix = taggedModuleCount === 1 ? "" : "s";
  const moduleTriggerLabel =
    taggedModuleCount > 0
      ? `${taggedModuleCount} module${taggedModuleSuffix} tagged`
      : "Tag modules...";

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

  const suggestionArgs = () =>
    defaultLanguage
      ? {
          name: form.getValues("name"),
          definition: form.getValues("definition"),
          defaultLanguage,
        }
      : undefined;

  const missingTargets = targetLanguages.filter(
    (language) => !(translations?.[language.languageCode] ?? "").trim(),
  );
  const canSuggest = rule === "translate" && !!trimmedName && !!defaultLanguage && !isReadOnly;

  // Fills the input only if it is still empty; nothing is saved until Save (H8, C4).
  const fillSuggestion = (code: string, value: string) => {
    if ((form.getValues("translations")[code] ?? "").trim()) return;
    setTranslation(code, value);
  };

  const suggestOne = async (language: ILanguageConfig) => {
    const args = suggestionArgs();
    if (!args) return;
    const value = await suggest(args, language);
    if (value) fillSuggestion(language.languageCode, value);
  };

  const suggestAllMissing = () => {
    const args = suggestionArgs();
    if (!args) return;
    void suggestAll(args, missingTargets, fillSuggestion);
  };

  /** Keeps Language, Rule and Scope for the next term and empties everything else (H7). */
  const resetForAnother = (data: GlossaryEditorValues) => {
    form.reset({
      ...getInitialValues(undefined, toGlossaryMeta({}), "", "", data.language),
      language: data.language,
      rule: data.rule,
      scope: data.scope,
      moduleIds: data.moduleIds,
    });
    setNoteOpen(false);
    setTimeout(() => form.setFocus("name"), 0);
  };

  const formSubmitHandler = async (data: GlossaryEditorValues, addAnother = false) => {
    // Structured fields go to the server as such: no rule marker in `context`, no JSON in the note.
    const payload = {
      ...(isEditMode && glossary?.itemId ? { itemId: glossary.itemId } : {}),
      name: data.name.trim(),
      language: data.language,
      type: data.type,
      context: data.definition.trim(),
      additionalNote: data.note?.trim() ?? "",
      isGlobal: data.scope === "project",
      moduleIds: data.scope === "project" ? [] : data.moduleIds,
      rule: data.rule,
      caseSensitive: data.caseSensitive,
      variants: data.variants.map((variant) => variant.trim()).filter(Boolean),
      translations: buildTranslationsPayload(data.translations, data.forbidden),
      status: data.status,
      // "" / [] clear the stored values; the server keeps them only when omitted (merge-on-omit).
      partOfSpeech: (data.partOfSpeech || "") as GlossaryPartOfSpeech | "",
      usageExamples: data.usageExamples.map((example) => example.trim()).filter(Boolean),
      // The version this edit started from, so the server rejects it if someone saved meanwhile.
      ...(isEditMode && typeof glossary?.version === "number" ? { version: glossary.version } : {}),
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
        onSaved?.(payload.name);
        if (addAnother) resetForAnother(data);
        else onClose();
      } else if (Array.isArray(res?.validationErrors) && res.validationErrors.length > 0) {
        // A version conflict shows the Alert (keeping the user's input); every other error is a toast.
        res.validationErrors.forEach((error) => {
          if (error.propertyName === VERSION_ERROR_PROPERTY) {
            setHasVersionConflict(true);
          } else {
            showErrorToast({ errors: error.errorMessage });
          }
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

  const reloadLatest = async () => {
    if (!glossary?.itemId || isReloading) return;
    setIsReloading(true);
    try {
      const latest = await fetchLatestGlossary(glossary.itemId);
      // Remounts this form, so the unsaved input, the Alert and the parsed stored note all reset.
      onReloaded?.(latest);
    } catch (error) {
      if (isNotFoundError(error)) {
        showErrorToast({ errors: "This term no longer exists." });
        onClose();
        return;
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: formatErrorMessage(error),
      });
    } finally {
      setIsReloading(false);
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
    const languageLabel = (htmlFor: string) => (
      <Label htmlFor={htmlFor} className="text-high-emphasis">
        {language.languageName} <span className="font-normal text-low-emphasis">({code})</span>
      </Label>
    );

    if (rule === "forbidden") {
      return (
        <div key={code} className="grid gap-2 p-4">
          {languageLabel(`glossary-forbidden-${code}`)}
          {forbiddenInput}
          <FieldError message={forbiddenError(code)} />
        </div>
      );
    }

    return (
      <div key={code} className="grid gap-2 p-4">
        {languageLabel(inputId)}
        <div className="flex items-center gap-2">
          <Input
            id={inputId}
            value={translations?.[code] ?? ""}
            onChange={(event) => setTranslation(code, event.target.value)}
            placeholder="Approved translation"
            disabled={isReadOnly}
          />
          {canSuggest && !(translations?.[code] ?? "").trim() && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  aria-label={`Suggest ${language.languageName} translation`}
                  onClick={() => void suggestOne(language)}
                  disabled={pendingCodes.has(code)}
                >
                  {pendingCodes.has(code) ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs font-normal">
                Suggest with AI
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <FieldError message={translationError(code)} />
        <Collapsible defaultOpen={forbiddenValues.length > 0} className="group/forbidden">
          <div className="flex items-center gap-1.5">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-fit gap-1 px-0 text-xs font-medium text-medium-emphasis hover:bg-transparent hover:text-high-emphasis"
              >
                Forbidden alternatives
                {forbiddenValues.length > 0 && ` (${forbiddenValues.length})`}
                <ChevronDown
                  className="h-3.5 w-3.5 transition-transform group-data-[state=open]/forbidden:rotate-180"
                  aria-hidden="true"
                />
              </Button>
            </CollapsibleTrigger>
            <FieldInfo label="forbidden alternatives">
              Translations to avoid in {language.languageName}, e.g. outdated or competitor wording.
              The AI is told not to use them.
            </FieldInfo>
          </div>
          <CollapsibleContent className="pt-2">{forbiddenInput}</CollapsibleContent>
        </Collapsible>
        <FieldError message={forbiddenError(code)} />
      </div>
    );
  };

  const renderTranslationsBody = () => {
    if (targetLanguages.length === 0) {
      return (
        <p className="rounded-lg border border-dashed border-input px-4 py-6 text-center text-sm text-medium-emphasis">
          Add another language to the project to record translations.
        </p>
      );
    }
    return (
      <div className="divide-y divide-input overflow-hidden rounded-lg border border-input">
        {targetLanguages.map(renderTranslationRow)}
      </div>
    );
  };

  return (
    <>
      <SheetHeader className="flex-row items-start justify-between gap-4 space-y-0 border-b px-6 py-5">
        <div className="grid min-w-0 gap-1">
          <SheetTitle className="leading-7 text-high-emphasis">
            {isEditMode ? "Edit Glossary" : "Add Glossary"}
          </SheetTitle>
          <SheetDescription className="text-medium-emphasis">
            Define the term, its translations, meaning and scope.
          </SheetDescription>
        </div>
        <SheetClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-mr-2 h-8 w-8 shrink-0 text-medium-emphasis hover:text-high-emphasis"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </Button>
        </SheetClose>
      </SheetHeader>

      <TooltipProvider delayDuration={200}>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => formSubmitHandler(data))}
            className="flex min-h-0 flex-1 flex-col"
            noValidate
          >
            <ScrollArea className="min-h-0 flex-1">
              <fieldset disabled={isReadOnly} className="grid min-w-0 gap-6 p-6">
                {stored.isCorrupt && (
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
                <section className="grid gap-5" aria-labelledby="glossary-section-term">
                  <SectionHeading
                    id="glossary-section-term"
                    title="Term"
                    description="The word or phrase, and how the AI should treat it."
                  />
                  <div className="grid items-start gap-5 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] sm:gap-4">
                    <FormField
                      name="name"
                      control={control}
                      render={({ field }) => (
                        <FormItem>
                          <LabelRow>
                            <FormLabel className="font-medium text-high-emphasis">
                              Name <span className="text-destructive">*</span>
                            </FormLabel>
                            <FieldInfo label="name">
                              The word or phrase this glossary entry is about, e.g.
                              &quot;Workspace&quot;. Only whole words are matched (substring for zh,
                              ja, th, lo, km, my).
                            </FieldInfo>
                          </LabelRow>
                          <FormControl>
                            <Input placeholder="Enter glossary name" {...field} />
                          </FormControl>
                          {duplicateGlossary && (
                            <FormDescription className="flex items-start gap-1.5 text-warning-700">
                              <TriangleAlert
                                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span>
                                &apos;{duplicateGlossary.name}&apos; already exists.{" "}
                                <button
                                  type="button"
                                  className="font-medium underline underline-offset-4 hover:no-underline"
                                  onClick={() => resolveDuplicateGlossary(duplicateGlossary)}
                                >
                                  {onSelectExisting ? "Select it" : "Open it"}
                                </button>
                              </span>
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
                          <LabelRow>
                            <FormLabel className="font-medium text-high-emphasis">
                              Language
                            </FormLabel>
                            <FieldInfo label="language">
                              The language the term is written in, usually your project&apos;s
                              source language.
                            </FieldInfo>
                          </LabelRow>
                          {/* Wrapper keeps space-y margins stable when the dropdown mounts. */}
                          <div>
                            <Popover open={languageOpen} onOpenChange={setLanguageOpen}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={languageOpen}
                                    className={`w-full justify-between px-3 font-normal ${selectedLanguage ? "" : "text-muted-foreground"}`}
                                  >
                                    <span className="truncate">
                                      {selectedLanguage
                                        ? (languageListData?.find(
                                            (lang) => lang.languageCode === selectedLanguage,
                                          )?.languageName ?? selectedLanguage)
                                        : "Select language"}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent
                                portalled={false}
                                className="z-60 w-[var(--radix-popover-trigger-width)] min-w-56 p-0"
                                align="start"
                              >
                                <Command>
                                  <CommandInput placeholder="Search language..." />
                                  <CommandList>
                                    <CommandEmpty>No language found.</CommandEmpty>
                                    <CommandGroup>
                                      {languageListData?.map((language) => (
                                        <CommandItem
                                          key={language.languageCode}
                                          value={`${language.languageName} ${language.languageCode}`}
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
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    name="rule"
                    control={control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-high-emphasis">Rule</FormLabel>
                        <FormControl>
                          <RadioGroup
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isReadOnly}
                            className="grid gap-2 sm:grid-cols-3"
                          >
                            {RULE_OPTIONS.map((option) => (
                              <ChoiceCard
                                key={option}
                                id={`glossary-rule-${option}`}
                                value={option}
                                label={GLOSSARY_RULE_LABELS[option]}
                                description={RULE_DESCRIPTIONS[option]}
                              />
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-high-emphasis">Status</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isReadOnly}
                        >
                          <FormControl>
                            <SelectTrigger aria-label="Status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {GLOSSARY_STATUSES.map((option) => (
                              <SelectItem key={option} value={option}>
                                {GLOSSARY_STATUS_LABELS[option]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs text-medium-emphasis">
                          Only Approved terms are sent to the AI.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    name="caseSensitive"
                    control={control}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between gap-4 space-y-0 rounded-lg border border-input p-3">
                        <div className="grid gap-0.5">
                          <FormLabel className="cursor-pointer font-medium text-high-emphasis">
                            Case-sensitive
                          </FormLabel>
                          <FormDescription className="text-xs text-medium-emphasis">
                            Only match the same capitalisation, e.g. &quot;Apple&quot; but not
                            &quot;apple&quot;. Use it for names that are also everyday words.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isReadOnly}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    name="variants"
                    control={control}
                    render={({ field }) => (
                      <FormItem>
                        <LabelRow>
                          <FormLabel
                            htmlFor="glossary-variants"
                            className="font-medium text-high-emphasis"
                          >
                            Variants
                          </FormLabel>
                          <FieldInfo label="variants">
                            Other forms of this term, such as plurals, spellings or synonyms, e.g.
                            &quot;Workspaces&quot; or &quot;work space&quot;. AI suggestions apply
                            this entry&apos;s rule to them too. Up to {GLOSSARY_LIMITS.variants}.
                          </FieldInfo>
                        </LabelRow>
                        <ChipInput
                          id="glossary-variants"
                          ariaLabel="Variants"
                          values={field.value}
                          onChange={(values) =>
                            form.setValue("variants", values, {
                              shouldValidate: formState.isSubmitted,
                            })
                          }
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
                    <section className="grid gap-5" aria-labelledby="glossary-section-translations">
                      <div className="flex items-start justify-between gap-4">
                        <SectionHeading
                          id="glossary-section-translations"
                          title="Translations"
                          description={
                            rule === "forbidden"
                              ? "Words that must not be used in each language instead of this term."
                              : "The approved translation for each project language. The AI must use it wherever the term appears."
                          }
                        />
                        {canSuggest && missingTargets.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 gap-1"
                            onClick={suggestAllMissing}
                            disabled={isSuggesting}
                          >
                            {isSuggesting ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <Sparkles className="h-4 w-4" aria-hidden="true" />
                            )}
                            Suggest all
                          </Button>
                        )}
                      </div>
                      {renderTranslationsBody()}
                    </section>
                  </>
                )}

                <Separator />

                {/* Meaning */}
                <section className="grid gap-5" aria-labelledby="glossary-section-meaning">
                  <SectionHeading
                    id="glossary-section-meaning"
                    title="Meaning"
                    description="Context that helps the AI and your team understand the term."
                  />
                  <FormField
                    name="type"
                    control={control}
                    render={({ field }) => (
                      <FormItem>
                        <LabelRow>
                          <FormLabel className="font-medium text-high-emphasis">Type</FormLabel>
                          <FieldInfo label="type">
                            What kind of term this is, e.g. an acronym or a phrase. Helps your team
                            understand and review it.
                          </FieldInfo>
                        </LabelRow>
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
                        <LabelRow>
                          <FormLabel className="font-medium text-high-emphasis">
                            Definition
                          </FormLabel>
                          <FieldInfo label="definition">
                            What the term means in your product. It is sent to the AI as context, so
                            keep it short and clear.
                          </FieldInfo>
                        </LabelRow>
                        <FormControl>
                          <Textarea
                            placeholder="What the term means"
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <div className="flex items-start justify-between gap-4">
                          <FormDescription className="text-xs">Sent to the AI</FormDescription>
                          <CharacterCount value={field.value} max={GLOSSARY_LIMITS.definition} />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="partOfSpeech"
                    control={control}
                    render={({ field }) => (
                      <FormItem>
                        <LabelRow>
                          <FormLabel className="font-medium text-high-emphasis">
                            Part of speech
                          </FormLabel>
                          <FieldInfo label="part of speech">
                            Whether the term is a noun, verb and so on. It is sent to the AI with the
                            definition, to tell apart words like &quot;Save&quot; (verb) and
                            &quot;Save&quot; (noun).
                          </FieldInfo>
                        </LabelRow>
                        <Select
                          onValueChange={(value) =>
                            field.onChange(value === NO_PART_OF_SPEECH ? "" : value)
                          }
                          value={field.value || NO_PART_OF_SPEECH}
                          disabled={isReadOnly}
                        >
                          <FormControl>
                            <SelectTrigger aria-label="Part of speech">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={NO_PART_OF_SPEECH}>Not set</SelectItem>
                            {GLOSSARY_PARTS_OF_SPEECH.map((option) => (
                              <SelectItem key={option} value={option}>
                                {GLOSSARY_PART_OF_SPEECH_LABELS[option]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="usageExamples"
                    control={control}
                    render={({ field }) => (
                      <FormItem>
                        <LabelRow>
                          <FormLabel className="font-medium text-high-emphasis">
                            Usage examples
                          </FormLabel>
                          <FieldInfo label="usage examples">
                            Sentences that show the term in use. Shown to your team on the term&apos;s
                            page; not sent to the AI. Up to {GLOSSARY_LIMITS.usageExamples}.
                          </FieldInfo>
                        </LabelRow>
                        <div className="grid gap-2">
                          {field.value.map((example, index) => (
                            // Examples have no ids; the index is their position in the list.
                            // eslint-disable-next-line react/no-array-index-key
                            <div key={index} className="flex items-center gap-2">
                              <Input
                                aria-label={`Usage example ${index + 1}`}
                                value={example}
                                maxLength={GLOSSARY_LIMITS.usageExample}
                                onChange={(event) =>
                                  field.onChange(
                                    field.value.map((item, itemIndex) =>
                                      itemIndex === index ? event.target.value : item,
                                    ),
                                  )
                                }
                                placeholder="e.g. Open your workspace to see recent files."
                                disabled={isReadOnly}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                aria-label={`Remove usage example ${index + 1}`}
                                onClick={() =>
                                  field.onChange(
                                    field.value.filter((_, itemIndex) => itemIndex !== index),
                                  )
                                }
                                disabled={isReadOnly}
                              >
                                <X className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </div>
                          ))}
                          {field.value.length < GLOSSARY_LIMITS.usageExamples && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-fit gap-1"
                              onClick={() => field.onChange([...field.value, ""])}
                              disabled={isReadOnly}
                            >
                              <Plus className="h-4 w-4" aria-hidden="true" />
                              Add example
                            </Button>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </section>

                <Separator />

                {/* Scope */}
                <section className="grid gap-5" aria-labelledby="glossary-section-scope">
                  <SectionHeading
                    id="glossary-section-scope"
                    title="Scope"
                    description="Where the term applies."
                  />
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
                            className="grid gap-2 sm:grid-cols-2"
                          >
                            <ChoiceCard
                              id="glossary-scope-project"
                              value="project"
                              label="Whole project"
                              description="Covers every key in the project."
                            />
                            <ChoiceCard
                              id="glossary-scope-modules"
                              value="modules"
                              label="Specific modules"
                              description="Only covers keys in the modules you tag."
                            />
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
                          <div>
                            <Popover open={modulePopoverOpen} onOpenChange={setModulePopoverOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  role="combobox"
                                  aria-label="Tag modules"
                                  className="w-full justify-between px-3 font-normal text-muted-foreground"
                                >
                                  {moduleTriggerLabel}
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
                                                toggleValue(
                                                  form.getValues("moduleIds"),
                                                  mod.itemId,
                                                ),
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
                          </div>
                          {(moduleIds?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {moduleIds.map((id) => {
                                const mod = moduleListData?.find((m) => m.itemId === id);
                                return (
                                  <Badge
                                    key={id}
                                    variant="secondary"
                                    className="h-6 gap-1 rounded-md pr-1 font-normal"
                                  >
                                    {mod?.moduleName ?? id}
                                    <RemoveChipButton
                                      label={`Remove module ${mod?.moduleName ?? id}`}
                                      onClick={() => {
                                        field.onChange(withoutValue(moduleIds, id));
                                        void form.trigger("moduleIds");
                                      }}
                                    />
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </section>

                <Separator />

                <Collapsible open={noteOpen} onOpenChange={setNoteOpen} className="grid gap-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <CollapsibleTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-auto gap-1.5 p-0 text-base font-semibold text-high-emphasis hover:bg-transparent"
                        >
                          Internal Note
                          <ChevronDown
                            className={`h-4 w-4 text-medium-emphasis transition-transform ${noteOpen ? "rotate-180" : ""}`}
                            aria-hidden="true"
                          />
                        </Button>
                      </CollapsibleTrigger>
                      <span className="text-xs text-low-emphasis">Optional</span>
                    </div>
                    <FieldInfo label="additional note">
                      Notes for your team, such as where the term came from or who approved it.
                      Never sent to the AI.
                    </FieldInfo>
                  </div>
                  <CollapsibleContent>
                    <FormField
                      name="note"
                      control={control}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              aria-label="Additional note"
                              placeholder="Notes for your team"
                              className="resize-none"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <div className="flex items-start justify-between gap-4">
                            <FormDescription className="text-xs">
                              Never sent to the AI
                            </FormDescription>
                            <CharacterCount value={field.value} max={GLOSSARY_LIMITS.note} />
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CollapsibleContent>
                </Collapsible>
              </fieldset>
            </ScrollArea>

            {hasVersionConflict && (
              <div className="px-6 pb-4">
                <Alert variant="destructive">
                  <TriangleAlert />
                  <AlertDescription>
                    <p>
                      This term was changed by someone else. Reload the latest version and re-apply
                      your changes.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void reloadLatest()}
                      disabled={isReloading}
                      className="mt-1"
                    >
                      {isReloading && (
                        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                      )}
                      Reload latest
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <SheetFooter className="gap-2 border-t bg-background px-6 py-4 sm:space-x-0">
              <Button type="button" variant="outline" onClick={onClose} className="sm:min-w-24">
                Cancel
              </Button>
              {!isEditMode && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending || isReadOnly}
                  onClick={form.handleSubmit((data) => formSubmitHandler(data, true))}
                >
                  Save &amp; add another
                </Button>
              )}
              <Button type="submit" disabled={isPending || isReadOnly} className="sm:min-w-24">
                {isPending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Save
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </TooltipProvider>
    </>
  );
};

interface GlossaryEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  glossary?: IGlossary;
  /** Optional trigger: when given, focus returns to it after the sheet closes. */
  trigger?: ReactNode;
  /** Pre-fills Name when creating (ignored with `glossary`). */
  initialName?: string;
  /** Called after a successful save, before the sheet closes, with the trimmed name sent. */
  onSaved?: (savedName: string) => void;
  /** When given, the duplicate-name warning offers "Select it" (calls this and closes). */
  onSelectExisting?: (glossary: IGlossary) => void;
  /** Lets a caller without `trigger` (the glossary picker) place focus after closing. */
  onCloseAutoFocus?: (event: Event) => void;
}

/**
 * Holds the term the form edits for one open of the sheet. "Reload latest" swaps in the
 * fetched term and remounts the form: it reads the stored fields once per mount, so a
 * `form.reset` alone would keep stale read-only state, rule, variants and case-sensitivity.
 */
const GlossaryEditorBody: FC<Omit<GlossaryEditorFormProps, "onReloaded">> = ({
  glossary,
  ...props
}) => {
  const [current, setCurrent] = useState(glossary);
  const [reloadCount, setReloadCount] = useState(0);

  const handleReloaded = (latest: IGlossary) => {
    setCurrent(latest);
    setReloadCount((count) => count + 1);
  };

  return (
    <GlossaryEditorForm
      key={`${current?.itemId ?? "new"}:${current?.version ?? ""}:${reloadCount}`}
      glossary={current}
      onReloaded={handleReloaded}
      {...props}
    />
  );
};

/**
 * Side-sheet editor for a glossary term. The form mounts only while open, so closing
 * discards unsaved changes and every open starts from the stored values.
 */
const GlossaryEditorSheet: FC<GlossaryEditorSheetProps> = ({
  open,
  onOpenChange,
  glossary,
  trigger,
  initialName,
  onSaved,
  onSelectExisting,
  onCloseAutoFocus,
}) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
    <SheetContent
      side="right"
      hideClose
      className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      onCloseAutoFocus={onCloseAutoFocus}
    >
      {open && (
        <GlossaryEditorBody
          glossary={glossary}
          onClose={() => onOpenChange(false)}
          initialName={initialName}
          onSaved={onSaved}
          onSelectExisting={onSelectExisting}
        />
      )}
    </SheetContent>
  </Sheet>
);

export default GlossaryEditorSheet;
