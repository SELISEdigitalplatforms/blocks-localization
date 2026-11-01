import { FC, KeyboardEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os";
import { type TFunction, useT } from "@seliseblocks/genesis-os/i18n";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import {
  Check,
  ChevronDown,
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
import { useGlossaryRuleLabels } from "@blocks-localization/components/glossary/glossary-rule-badge";

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

const ruleDescription = (t: TFunction, rule: GlossaryRule) => {
  switch (rule) {
    case "translate":
      return t("GLOSSARY_EDITOR_SHEET.RULE_TRANSLATE_DESCRIPTION");
    case "keep":
      return t("GLOSSARY_EDITOR_SHEET.RULE_KEEP_DESCRIPTION");
    default:
      return t("GLOSSARY_EDITOR_SHEET.RULE_FORBIDDEN_DESCRIPTION");
  }
};

const withoutValue = (values: string[], value: string) => values.filter((item) => item !== value);

const toggleValue = (values: string[], value: string) =>
  values.includes(value) ? withoutValue(values, value) : [...values, value];

const firstVariantError = (t: TFunction, variants: string[], name: string): string | undefined => {
  if (variants.length > GLOSSARY_LIMITS.variants) {
    return t("GLOSSARY_EDITOR_SHEET.ERROR_MAX_VARIANTS", { max: GLOSSARY_LIMITS.variants });
  }
  const normalizedName = normalizeGlossaryName(name);
  const seen = new Set<string>();
  for (const variant of variants) {
    if (variant.trim().length > GLOSSARY_LIMITS.value) {
      return t("GLOSSARY_EDITOR_SHEET.ERROR_VARIANT_LENGTH", { max: GLOSSARY_LIMITS.value });
    }
    const normalized = normalizeGlossaryName(variant);
    if (normalized === normalizedName) return t("GLOSSARY_EDITOR_SHEET.ERROR_VARIANT_SAME_AS_TERM");
    if (seen.has(normalized)) return t("GLOSSARY_EDITOR_SHEET.ERROR_VARIANT_DUPLICATE");
    seen.add(normalized);
  }
  return undefined;
};

const firstForbiddenError = (
  t: TFunction,
  values: string[],
  translation: string | undefined,
  checkTranslation: boolean,
): string | undefined => {
  if (values.length > GLOSSARY_LIMITS.forbiddenPerLanguage) {
    return t("GLOSSARY_EDITOR_SHEET.ERROR_MAX_FORBIDDEN", {
      max: GLOSSARY_LIMITS.forbiddenPerLanguage,
    });
  }
  const normalizedTranslation = normalizeGlossaryName(translation ?? "");
  for (const value of values) {
    if (value.trim().length > GLOSSARY_LIMITS.value) {
      return t("GLOSSARY_EDITOR_SHEET.ERROR_FORBIDDEN_LENGTH", { max: GLOSSARY_LIMITS.value });
    }
    if (
      checkTranslation &&
      normalizedTranslation &&
      normalizeGlossaryName(value) === normalizedTranslation
    ) {
      return t("GLOSSARY_EDITOR_SHEET.ERROR_TRANSLATION_FORBIDDEN");
    }
  }
  return undefined;
};

/**
 * Validation only covers languages shown in the editor; other stored entries pass through.
 * Variants are only validated while they are editable (flag on); otherwise they are kept as stored.
 */
const buildSchema = (targetCodes: string[], t: TFunction) =>
  z
    .object({
      name: z
        .string()
        .trim()
        .min(1, { message: t("GLOSSARY_EDITOR_SHEET.ERROR_NAME_REQUIRED") })
        .max(GLOSSARY_LIMITS.name, {
          message: t("GLOSSARY_EDITOR_SHEET.ERROR_NAME_LENGTH", { max: GLOSSARY_LIMITS.name }),
        }),
      language: z.string(),
      type: z.string(),
      rule: z.enum(["translate", "keep", "forbidden"]),
      caseSensitive: z.boolean(),
      variants: z.array(z.string()),
      translations: z.record(z.string(), z.string()),
      forbidden: z.record(z.string(), z.array(z.string())),
      definition: z.string().max(GLOSSARY_LIMITS.definition, {
        message: t("GLOSSARY_EDITOR_SHEET.ERROR_DEFINITION_LENGTH"),
      }),
      scope: z.enum(["project", "modules"]),
      moduleIds: z.array(z.string()),
      note: z.string().max(GLOSSARY_LIMITS.note, {
        message: t("GLOSSARY_EDITOR_SHEET.ERROR_NOTE_LENGTH"),
      }),
    })
    .superRefine((values, ctx) => {
      const variantError = firstVariantError(t, values.variants, values.name);
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
            message: t("GLOSSARY_EDITOR_SHEET.ERROR_TRANSLATION_LENGTH"),
          });
        }
        if (values.rule !== "keep") {
          const forbiddenError = firstForbiddenError(
            t,
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
          message: t("GLOSSARY_EDITOR_SHEET.ERROR_MODULE_REQUIRED"),
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
) => ({
  name: glossary?.name ?? initialName,
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
  const { t } = useT("localization.glossary");
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
        placeholder={values.length > 0 ? t("GLOSSARY_EDITOR_SHEET.ADD_ANOTHER") : placeholder}
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
const FieldInfo = ({
  ariaLabel,
  children,
}: Readonly<{ ariaLabel: string; children: ReactNode }>) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        aria-label={ariaLabel}
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
  initialName?: string;
  onSaved?: (savedName: string) => void;
  onSelectExisting?: (glossary: IGlossary) => void;
}

const GlossaryEditorForm: FC<GlossaryEditorFormProps> = ({
  glossary,
  onClose,
  initialName,
  onSaved,
  onSelectExisting,
}) => {
  const { t } = useT("localization.glossary");
  const ruleLabels = useGlossaryRuleLabels();
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
    () =>
      buildSchema(
        targetLanguages.map((language) => language.languageCode),
        t,
      ),
    [targetLanguages, t],
  );

  const form = useForm<GlossaryEditorValues>({
    defaultValues: getInitialValues(glossary, parsed.meta, parsed.meta.note ?? "", initialName),
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
  const moduleTriggerLabel =
    taggedModuleCount > 0
      ? t("GLOSSARY_EDITOR_SHEET.MODULES_TAGGED", { count: taggedModuleCount })
      : t("GLOSSARY_EDITOR_SHEET.TAG_MODULES");

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
      form.setError("root.serialized", { message: t("GLOSSARY_EDITOR_SHEET.ERROR_TOO_MUCH_DATA") });
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
          title: t("common:SUCCESS"),
          description: isEditMode
            ? t("GLOSSARY_EDITOR_SHEET.UPDATED")
            : t("GLOSSARY_EDITOR_SHEET.ADDED"),
        });
        onSaved?.(payload.name);
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
        title: t("common:ERROR"),
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
        ariaLabel={t("GLOSSARY_EDITOR_SHEET.FORBIDDEN_FOR", { label })}
        values={forbiddenValues}
        onChange={(values) => setForbidden(code, values)}
        placeholder={t("GLOSSARY_EDITOR_SHEET.TYPE_AND_ENTER")}
        removeLabel={(value) => t("GLOSSARY_EDITOR_SHEET.REMOVE_FORBIDDEN", { value, code })}
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
        <Input
          id={inputId}
          value={translations?.[code] ?? ""}
          onChange={(event) => setTranslation(code, event.target.value)}
          placeholder={t("GLOSSARY_EDITOR_SHEET.APPROVED_TRANSLATION")}
          disabled={isReadOnly}
        />
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
                {t("GLOSSARY_EDITOR_SHEET.FORBIDDEN_ALTERNATIVES")}
                {forbiddenValues.length > 0 && ` (${forbiddenValues.length})`}
                <ChevronDown
                  className="h-3.5 w-3.5 transition-transform group-data-[state=open]/forbidden:rotate-180"
                  aria-hidden="true"
                />
              </Button>
            </CollapsibleTrigger>
            <FieldInfo ariaLabel={t("GLOSSARY_EDITOR_SHEET.ABOUT_FORBIDDEN")}>
              {t("GLOSSARY_EDITOR_SHEET.FORBIDDEN_INFO", { language: language.languageName })}
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
          {t("GLOSSARY_EDITOR_SHEET.NO_TARGET_LANGUAGES")}
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
            {isEditMode
              ? t("GLOSSARY_EDITOR_SHEET.TITLE_EDIT")
              : t("GLOSSARY_EDITOR_SHEET.TITLE_ADD")}
          </SheetTitle>
          <SheetDescription className="text-medium-emphasis">
            {t("GLOSSARY_EDITOR_SHEET.DESCRIPTION")}
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
            <span className="sr-only">{t("common:CLOSE")}</span>
          </Button>
        </SheetClose>
      </SheetHeader>

      <TooltipProvider delayDuration={200}>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(formSubmitHandler)}
            className="flex min-h-0 flex-1 flex-col"
            noValidate
          >
            <ScrollArea className="min-h-0 flex-1">
              <fieldset disabled={isReadOnly} className="grid min-w-0 gap-6 p-6">
                {parsed.status === "corrupt" && (
                  <Alert className="border-warning-200 bg-warning-50 text-warning-700">
                    <TriangleAlert />
                    <AlertDescription className="text-warning-700">
                      {t("GLOSSARY_EDITOR_SHEET.CORRUPT_DATA")}
                    </AlertDescription>
                  </Alert>
                )}
                {isReadOnly && (
                  <Alert className="border-warning-200 bg-warning-50 text-warning-700">
                    <TriangleAlert />
                    <AlertDescription className="text-warning-700">
                      {t("GLOSSARY_EDITOR_SHEET.READ_ONLY")}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Term */}
                <section className="grid gap-5" aria-labelledby="glossary-section-term">
                  <SectionHeading
                    id="glossary-section-term"
                    title={t("GLOSSARY_EDITOR_SHEET.SECTION_TERM")}
                    description={t("GLOSSARY_EDITOR_SHEET.SECTION_TERM_DESCRIPTION")}
                  />
                  <div className="grid items-start gap-5 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] sm:gap-4">
                    <FormField
                      name="name"
                      control={control}
                      render={({ field }) => (
                        <FormItem>
                          <LabelRow>
                            <FormLabel className="font-medium text-high-emphasis">
                              {t("GLOSSARY_EDITOR_SHEET.NAME")}{" "}
                              <span className="text-destructive">*</span>
                            </FormLabel>
                            <FieldInfo ariaLabel={t("GLOSSARY_EDITOR_SHEET.ABOUT_NAME")}>
                              {t("GLOSSARY_EDITOR_SHEET.NAME_INFO")}
                            </FieldInfo>
                          </LabelRow>
                          <FormControl>
                            <Input
                              placeholder={t("GLOSSARY_EDITOR_SHEET.NAME_PLACEHOLDER")}
                              {...field}
                            />
                          </FormControl>
                          {duplicateGlossary && (
                            <FormDescription className="flex items-start gap-1.5 text-warning-700">
                              <TriangleAlert
                                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span>
                                {t("GLOSSARY_EDITOR_SHEET.DUPLICATE_EXISTS", {
                                  name: duplicateGlossary.name,
                                })}{" "}
                                <button
                                  type="button"
                                  className="font-medium underline underline-offset-4 hover:no-underline"
                                  onClick={() => resolveDuplicateGlossary(duplicateGlossary)}
                                >
                                  {onSelectExisting
                                    ? t("GLOSSARY_EDITOR_SHEET.SELECT_IT")
                                    : t("GLOSSARY_EDITOR_SHEET.OPEN_IT")}
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
                              {t("GLOSSARY_EDITOR_SHEET.LANGUAGE")}
                            </FormLabel>
                            <FieldInfo ariaLabel={t("GLOSSARY_EDITOR_SHEET.ABOUT_LANGUAGE")}>
                              {t("GLOSSARY_EDITOR_SHEET.LANGUAGE_INFO")}
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
                                        : t("GLOSSARY_EDITOR_SHEET.SELECT_LANGUAGE")}
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
                                  <CommandInput
                                    placeholder={t("GLOSSARY_EDITOR_SHEET.SEARCH_LANGUAGE")}
                                  />
                                  <CommandList>
                                    <CommandEmpty>
                                      {t("GLOSSARY_EDITOR_SHEET.NO_LANGUAGE_FOUND")}
                                    </CommandEmpty>
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
                        <FormLabel className="font-medium text-high-emphasis">
                          {t("GLOSSARY_EDITOR_SHEET.RULE")}
                        </FormLabel>
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
                                label={ruleLabels[option]}
                                description={ruleDescription(t, option)}
                              />
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
                      <FormItem className="flex flex-row items-center justify-between gap-4 space-y-0 rounded-lg border border-input p-3">
                        <div className="grid gap-0.5">
                          <FormLabel className="cursor-pointer font-medium text-high-emphasis">
                            {t("GLOSSARY_EDITOR_SHEET.CASE_SENSITIVE")}
                          </FormLabel>
                          <FormDescription className="text-xs text-medium-emphasis">
                            {t("GLOSSARY_EDITOR_SHEET.CASE_SENSITIVE_INFO")}
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
                            {t("GLOSSARY_EDITOR_SHEET.VARIANTS")}
                          </FormLabel>
                          <FieldInfo ariaLabel={t("GLOSSARY_EDITOR_SHEET.ABOUT_VARIANTS")}>
                            {t("GLOSSARY_EDITOR_SHEET.VARIANTS_INFO", {
                              max: GLOSSARY_LIMITS.variants,
                            })}
                          </FieldInfo>
                        </LabelRow>
                        <ChipInput
                          id="glossary-variants"
                          ariaLabel={t("GLOSSARY_EDITOR_SHEET.VARIANTS")}
                          values={field.value}
                          onChange={(values) =>
                            form.setValue("variants", values, {
                              shouldValidate: formState.isSubmitted,
                            })
                          }
                          placeholder={t("GLOSSARY_EDITOR_SHEET.VARIANTS_PLACEHOLDER")}
                          removeLabel={(value) =>
                            t("GLOSSARY_EDITOR_SHEET.REMOVE_VARIANT", { value })
                          }
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
                      <SectionHeading
                        id="glossary-section-translations"
                        title={t("GLOSSARY_EDITOR_SHEET.SECTION_TRANSLATIONS")}
                        description={
                          rule === "forbidden"
                            ? t("GLOSSARY_EDITOR_SHEET.SECTION_TRANSLATIONS_FORBIDDEN")
                            : t("GLOSSARY_EDITOR_SHEET.SECTION_TRANSLATIONS_DESCRIPTION")
                        }
                      />
                      {renderTranslationsBody()}
                    </section>
                  </>
                )}

                <Separator />

                {/* Meaning */}
                <section className="grid gap-5" aria-labelledby="glossary-section-meaning">
                  <SectionHeading
                    id="glossary-section-meaning"
                    title={t("GLOSSARY_EDITOR_SHEET.SECTION_MEANING")}
                    description={t("GLOSSARY_EDITOR_SHEET.SECTION_MEANING_DESCRIPTION")}
                  />
                  <FormField
                    name="type"
                    control={control}
                    render={({ field }) => (
                      <FormItem>
                        <LabelRow>
                          <FormLabel className="font-medium text-high-emphasis">
                            {t("GLOSSARY_EDITOR_SHEET.TYPE")}
                          </FormLabel>
                          <FieldInfo ariaLabel={t("GLOSSARY_EDITOR_SHEET.ABOUT_TYPE")}>
                            {t("GLOSSARY_EDITOR_SHEET.TYPE_INFO")}
                          </FieldInfo>
                        </LabelRow>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isReadOnly}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("GLOSSARY_EDITOR_SHEET.SELECT_TYPE")} />
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
                            {t("GLOSSARY_EDITOR_SHEET.DEFINITION")}
                          </FormLabel>
                          <FieldInfo ariaLabel={t("GLOSSARY_EDITOR_SHEET.ABOUT_DEFINITION")}>
                            {t("GLOSSARY_EDITOR_SHEET.DEFINITION_INFO")}
                          </FieldInfo>
                        </LabelRow>
                        <FormControl>
                          <Textarea
                            placeholder={t("GLOSSARY_EDITOR_SHEET.DEFINITION_PLACEHOLDER")}
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <div className="flex items-start justify-between gap-4">
                          <FormDescription className="text-xs">
                            {t("GLOSSARY_EDITOR_SHEET.SENT_TO_AI")}
                          </FormDescription>
                          <CharacterCount value={field.value} max={GLOSSARY_LIMITS.definition} />
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
                    title={t("GLOSSARY_EDITOR_SHEET.SECTION_SCOPE")}
                    description={t("GLOSSARY_EDITOR_SHEET.SECTION_SCOPE_DESCRIPTION")}
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
                            aria-label={t("GLOSSARY_EDITOR_SHEET.SECTION_SCOPE")}
                            className="grid gap-2 sm:grid-cols-2"
                          >
                            <ChoiceCard
                              id="glossary-scope-project"
                              value="project"
                              label={t("GLOSSARY_EDITOR_SHEET.SCOPE_PROJECT")}
                              description={t("GLOSSARY_EDITOR_SHEET.SCOPE_PROJECT_DESCRIPTION")}
                            />
                            <ChoiceCard
                              id="glossary-scope-modules"
                              value="modules"
                              label={t("GLOSSARY_EDITOR_SHEET.SCOPE_MODULES")}
                              description={t("GLOSSARY_EDITOR_SHEET.SCOPE_MODULES_DESCRIPTION")}
                            />
                          </RadioGroup>
                        </FormControl>
                        {scope === "project" && legacyModuleCount > 0 && (
                          <FormDescription>
                            {t("GLOSSARY_EDITOR_SHEET.LEGACY_LINKS", { count: legacyModuleCount })}
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
                                  aria-label={t("GLOSSARY_EDITOR_SHEET.TAG_MODULES")}
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
                                  <CommandInput
                                    placeholder={t("GLOSSARY_EDITOR_SHEET.SEARCH_MODULES")}
                                  />
                                  <CommandList>
                                    <CommandEmpty>
                                      {t("GLOSSARY_EDITOR_SHEET.NO_MODULES_FOUND")}
                                    </CommandEmpty>
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
                                      label={t("GLOSSARY_EDITOR_SHEET.REMOVE_MODULE", {
                                        name: mod?.moduleName ?? id,
                                      })}
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
                          {t("GLOSSARY_EDITOR_SHEET.INTERNAL_NOTE")}
                          <ChevronDown
                            className={`h-4 w-4 text-medium-emphasis transition-transform ${noteOpen ? "rotate-180" : ""}`}
                            aria-hidden="true"
                          />
                        </Button>
                      </CollapsibleTrigger>
                      <span className="text-xs text-low-emphasis">
                        {t("GLOSSARY_EDITOR_SHEET.OPTIONAL")}
                      </span>
                    </div>
                    <FieldInfo ariaLabel={t("GLOSSARY_EDITOR_SHEET.ABOUT_NOTE")}>
                      {t("GLOSSARY_EDITOR_SHEET.NOTE_INFO")}
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
                              aria-label={t("GLOSSARY_EDITOR_SHEET.NOTE_ARIA")}
                              placeholder={t("GLOSSARY_EDITOR_SHEET.NOTE_PLACEHOLDER")}
                              className="resize-none"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <div className="flex items-start justify-between gap-4">
                            <FormDescription className="text-xs">
                              {t("GLOSSARY_EDITOR_SHEET.NEVER_SENT_TO_AI")}
                            </FormDescription>
                            <CharacterCount value={field.value} max={GLOSSARY_LIMITS.note} />
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CollapsibleContent>
                </Collapsible>

                <FieldError message={formState.errors.root?.serialized?.message} />
              </fieldset>
            </ScrollArea>

            <SheetFooter className="gap-2 border-t bg-background px-6 py-4 sm:space-x-0">
              <Button type="button" variant="outline" onClick={onClose} className="sm:min-w-24">
                {t("common:CANCEL")}
              </Button>
              <Button type="submit" disabled={isPending || isReadOnly} className="sm:min-w-24">
                {isPending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {t("common:SAVE")}
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
        <GlossaryEditorForm
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
