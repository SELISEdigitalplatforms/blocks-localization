import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Button } from "@/components/ui-kits/button/button";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Input } from "@/components/ui-kits/input/input";
import { Alert, AlertDescription } from "@/components/ui-kits/alert/alert";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import {
  AlertTriangle,
  Archive,
  Info,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Trash,
  TriangleAlert,
} from "lucide-react";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { formatErrorMessage, getHttpErrorMessage } from "@/lib/error";
import {
  useFetchLatestGlossary,
  useGetGlossaryById,
  useGetKeysByGlossaryId,
  useGetLanguageModules,
  useGetLanguages,
  useSaveGlossary,
} from "@blocks-localization/hooks/use-language-manager";
import { useGlossaryTermSuggestion } from "@blocks-localization/hooks/use-glossary-term-suggestion";
import GlossaryEditorSheet from "@blocks-localization/components/modals/glossary/glossary-editor-sheet";
import GlossaryRuleBadge from "@blocks-localization/components/glossary/glossary-rule-badge";
import GlossaryStatusBadge from "@blocks-localization/components/glossary/glossary-status-badge";
import { getGlossaryIssueLines } from "@blocks-localization/language-module/language-table/components/glossary-issue-badge";
import { GlossaryMeta } from "@blocks-localization/models/glossary-meta";
import {
  GLOSSARY_PART_OF_SPEECH_LABELS,
  IBlocksLanguageKey,
  IGlossary,
  IGlossaryTranslation,
  ILanguageConfig,
} from "@blocks-localization/models/language";
import {
  getGlossaryStatus,
  isUnsupportedGlossaryNote,
  toGlossaryMeta,
  toGlossarySavePayload,
} from "@blocks-localization/utils/glossary-display";
import {
  getDefaultLanguage,
  getTargetLanguages,
  stripRuleMarker,
} from "@blocks-localization/utils/glossary-rule-marker";
import { getTranslationError } from "@blocks-localization/utils/glossary-validation";
import { findCultureEntry } from "@blocks-localization/utils/glossary-text";
import DeleteGlossary from "@blocks-localization/components/modals/glossary/delete-glossary";
import { useScopedPath } from "@seliseblocks/genesis-os";
import { type TFunction, useT } from "@seliseblocks/genesis-os/i18n";

const LOCALIZATION_GLOSSARY_MODULE = "localization.glossary";

const TAGGED_KEYS_PAGE_SIZE_OPTIONS = [10, 20, 50];
const TAGGED_KEYS_SEARCH_DEBOUNCE_MS = 300;
/** Select value for "every module"; Radix Select items can't have an empty value. */
const ALL_MODULES = "all";

/** `validationErrors` property the server uses when the term changed since it was loaded. */
const VERSION_ERROR_PROPERTY = "Version";

const TAGGED_KEYS_SKELETON_ROW_KEYS = Array.from(
  { length: 5 },
  (_, rowNumber) => `tagged-key-row-skeleton-${rowNumber}`,
);

interface GlossaryDetailsProps {
  itemId: string;
}

const hasText = (value: string | null | undefined): value is string => !!value?.trim();

const formatDate = (value: string | null | undefined) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleDateString();
};

// Empty table cells show a muted dash; screen readers hear "None" instead of a stray symbol.
const EmptyCell = () => {
  const { t } = useT(LOCALIZATION_GLOSSARY_MODULE);
  return (
    <span className="text-low-emphasis">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{t("GLOSSARY_DETAILS.NONE")}</span>
    </span>
  );
};

const DetailField = ({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) => (
  <div className="grid min-w-0 content-start gap-1">
    <h3 className="text-sm font-medium text-low-emphasis">{label}</h3>
    {children}
  </div>
);

const DetailValue = ({ value }: Readonly<{ value: string | null | undefined }>) => {
  const { t } = useT(LOCALIZATION_GLOSSARY_MODULE);
  return hasText(value) ? (
    <p className="break-words text-base font-normal text-high-emphasis">{value}</p>
  ) : (
    <p className="text-base font-normal italic text-low-emphasis">
      {t("GLOSSARY_DETAILS.NOT_PROVIDED")}
    </p>
  );
};

const EmptyText = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <p className="text-base italic text-low-emphasis">{children}</p>
);

const ForbiddenList = ({ values }: Readonly<{ values: string[] }>) =>
  values.length > 0 ? (
    <div className="flex flex-wrap gap-1">
      {values.map((value) => (
        <Badge key={value} variant="error">
          {value}
        </Badge>
      ))}
    </div>
  ) : (
    <EmptyCell />
  );

const withTranslation = (
  translations: IGlossaryTranslation[],
  code: string,
  value: string,
): IGlossaryTranslation[] => {
  const trimmed = value.trim();
  // An entry under another case of the code ("de-de") is the same culture; it is replaced.
  const isCode = (translation: IGlossaryTranslation) =>
    translation.language.toLowerCase() === code.toLowerCase();
  const existing =
    translations.find((translation) => translation.language === code) ?? translations.find(isCode);
  const updated = { language: code, value: trimmed, forbiddenValues: existing?.forbiddenValues ?? [] };
  const others = translations.filter((translation) => !isCode(translation));
  return trimmed || updated.forbiddenValues.length > 0 ? [...others, updated] : others;
};

interface TranslationsTableProps {
  glossary: IGlossary;
  meta: GlossaryMeta;
  targets: ILanguageConfig[];
  defaultLanguage: ILanguageConfig | undefined;
}

/**
 * Translations with in-place edit and AI Suggest (H8, H20). A save sends the full stored term
 * with only that translation changed and its `version`; a conflict keeps the edit (C11).
 */
const TranslationsTable = ({
  glossary,
  meta,
  targets,
  defaultLanguage,
}: Readonly<TranslationsTableProps>) => {
  const { t } = useT(LOCALIZATION_GLOSSARY_MODULE);
  const showTranslation = meta.rule === "translate";
  const [editing, setEditing] = useState<{ code: string; value: string } | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const { isPending, mutateAsync } = useSaveGlossary();
  const fetchLatestGlossary = useFetchLatestGlossary();
  const { suggest, pendingCodes } = useGlossaryTermSuggestion();

  const editingError = editing
    ? getTranslationError(editing.value, findCultureEntry(meta.forbidden, editing.code) ?? [])
    : undefined;

  const save = async () => {
    if (!editing || editingError) return;
    const payload = toGlossarySavePayload(glossary);
    try {
      const res = await mutateAsync({
        ...payload,
        translations: withTranslation(payload.translations, editing.code, editing.value),
      });
      if (res?.success) {
        setEditing(null);
        setHasConflict(false);
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("GLOSSARY_DETAILS.TRANSLATION_SAVED"),
        });
      } else if (res?.validationErrors?.some((e) => e.propertyName === VERSION_ERROR_PROPERTY)) {
        setHasConflict(true);
      } else {
        showErrorToast({ errors: res?.validationErrors?.[0]?.errorMessage || res?.errorMessage });
      }
    } catch (error) {
      toast({ variant: "destructive", title: t("common:ERROR"), description: formatErrorMessage(error) });
    }
  };

  const reloadLatest = async () => {
    setIsReloading(true);
    try {
      // Refreshes the details data; the edited value stays in the input.
      await fetchLatestGlossary(glossary.itemId);
      setHasConflict(false);
    } catch (error) {
      toast({ variant: "destructive", title: t("common:ERROR"), description: formatErrorMessage(error) });
    } finally {
      setIsReloading(false);
    }
  };

  const suggestFor = async (target: ILanguageConfig) => {
    if (!defaultLanguage) return;
    const value = await suggest(
      { name: glossary.name, definition: stripRuleMarker(glossary.context), defaultLanguage },
      target,
    );
    // Fills the input only; nothing is saved until Save.
    if (value) setEditing({ code: target.languageCode, value });
  };

  const renderTranslationCell = (language: ILanguageConfig) => {
    const { languageCode, languageName } = language;
    const value = findCultureEntry(meta.translations, languageCode);
    if (editing?.code === languageCode) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={t("GLOSSARY_DETAILS.TRANSLATION_ARIA", { language: languageName })}
            value={editing.value}
            onChange={(event) => setEditing({ code: languageCode, value: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") void save();
              if (event.key === "Escape") setEditing(null);
            }}
            className="h-8 w-56"
            autoFocus
            disabled={isPending}
            aria-invalid={!!editingError}
            aria-describedby={
              editingError ? `glossary-translation-error-${languageCode}` : undefined
            }
          />
          <Button size="sm" onClick={() => void save()} disabled={isPending || !!editingError}>
            {isPending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("common:SAVE")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(null);
              setHasConflict(false);
            }}
            disabled={isPending}
          >
            {t("common:CANCEL")}
          </Button>
          {editingError && (
            <p
              id={`glossary-translation-error-${languageCode}`}
              role="alert"
              className="basis-full text-sm font-medium text-destructive"
            >
              {editingError}
            </p>
          )}
        </div>
      );
    }
    const isSuggesting = pendingCodes.has(languageCode);
    return (
      <div className="flex flex-wrap items-center gap-2">
        {value ? (
          <span className="text-high-emphasis">{value}</span>
        ) : (
          <>
            <Badge variant="warning" className="w-fit gap-1">
              <TriangleAlert className="h-3 w-3" aria-hidden="true" />
              {t("GLOSSARY_DETAILS.MISSING")}
            </Badge>
            {defaultLanguage && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2"
                onClick={() => void suggestFor(language)}
                disabled={isSuggesting || !!editing}
              >
                {isSuggesting ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {t("GLOSSARY_DETAILS.SUGGEST")}
              </Button>
            )}
          </>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label={t("GLOSSARY_DETAILS.EDIT_TRANSLATION_ARIA", { language: languageName })}
          onClick={() => setEditing({ code: languageCode, value: value ?? "" })}
          disabled={!!editing}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    );
  };

  return (
    <>
      {hasConflict && (
        <div className="pb-4">
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>
              <p>{t("GLOSSARY_DETAILS.CONFLICT")}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-1"
                onClick={() => void reloadLatest()}
                disabled={isReloading}
              >
                {isReloading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {t("GLOSSARY_DETAILS.RELOAD_LATEST")}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}
      <div className="w-full overflow-x-auto">
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="border-none hover:bg-transparent">
              <TableHead className="font-bold text-medium-emphasis">
                {t("GLOSSARY_DETAILS.LANGUAGE")}
              </TableHead>
              {showTranslation && (
                <TableHead className="font-bold text-medium-emphasis">
                  {t("GLOSSARY_DETAILS.COLUMN_TRANSLATION")}
                </TableHead>
              )}
              <TableHead className="font-bold text-medium-emphasis">
                {t("GLOSSARY_DETAILS.COLUMN_FORBIDDEN")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets.map((language) => (
              <TableRow key={language.languageCode} className="font-normal text-medium-emphasis">
                <TableCell className="text-high-emphasis">
                  {language.languageName} ({language.languageCode})
                </TableCell>
                {showTranslation && <TableCell>{renderTranslationCell(language)}</TableCell>}
                <TableCell>
                  <ForbiddenList values={findCultureEntry(meta.forbidden, language.languageCode) ?? []} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
};

function renderTranslationsContent(
  t: TFunction,
  glossary: IGlossary,
  meta: GlossaryMeta,
  isUnsupported: boolean,
  languages: ILanguageConfig[] | undefined,
) {
  if (isUnsupported) {
    return (
      <p className="text-sm text-medium-emphasis">{t("GLOSSARY_DETAILS.UNSUPPORTED_VERSION")}</p>
    );
  }
  if (meta.rule === "keep") {
    return <p className="text-sm text-medium-emphasis">{t("GLOSSARY_DETAILS.KEPT_AS_IS")}</p>;
  }
  const targets = getTargetLanguages(languages);
  if (targets.length === 0) {
    return (
      <p className="text-sm text-medium-emphasis">{t("GLOSSARY_DETAILS.NO_TARGET_LANGUAGES")}</p>
    );
  }
  return (
    <>
      {meta.rule === "forbidden" && (
        <p className="pb-4 text-sm text-medium-emphasis">{t("GLOSSARY_DETAILS.DO_NOT_USE_TERM")}</p>
      )}
      <TranslationsTable
        glossary={glossary}
        meta={meta}
        targets={targets}
        defaultLanguage={getDefaultLanguage(languages)}
      />
    </>
  );
}

const TaggedKeyIssue = ({ glossaryKey, glossaryId }: Readonly<{ glossaryKey: IBlocksLanguageKey; glossaryId: string }>) => {
  const { t } = useT(LOCALIZATION_GLOSSARY_MODULE);
  const violations = (glossaryKey.glossaryViolations ?? []).filter(
    (violation) => violation.glossaryId === glossaryId,
  );
  if (violations.length === 0) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="warning"
          tabIndex={0}
          className="w-fit cursor-default gap-1 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(event) => event.stopPropagation()}
        >
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          {t("GLOSSARY_DETAILS.ISSUE")}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm text-left">
        <ul className="space-y-0.5">
          {getGlossaryIssueLines(violations).map((line, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={`${index}-${line}`}>{line}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
};

const GlossaryDetailsSkeleton = () => (
  <div>
    <div className="hidden md:flex">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="ml-4 h-6 w-64" />
      <Skeleton className="ml-4 h-6 w-64" />
    </div>
    <div className="mt-5 flex items-center justify-between">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-20" />
      </div>
    </div>
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Skeleton className="h-48 w-full rounded-sm" />
      <div className="flex flex-col gap-6">
        <Skeleton className="h-24 w-full rounded-sm" />
        <Skeleton className="h-24 w-full rounded-sm" />
      </div>
    </div>
  </div>
);

// A module glossary also applies to every key in its modules; a global one to every key.
const getGlossaryModuleIds = (glossary: IGlossary | undefined) =>
  glossary && !glossary.isGlobal ? (glossary.moduleIds ?? []) : [];

const getScopeLabel = (t: TFunction, glossary: IGlossary, moduleCount: number) => {
  if (glossary.isGlobal) return t("GLOSSARY_DETAILS.SCOPE_WHOLE_PROJECT");
  return t("GLOSSARY_DETAILS.SCOPE_MODULES", { count: moduleCount });
};

const getKeysDescription = (t: TFunction, glossary: IGlossary, hasModuleScope: boolean) => {
  if (glossary.isGlobal) {
    return t("GLOSSARY_DETAILS.KEYS_DESCRIPTION_GLOBAL");
  }
  if (hasModuleScope) return t("GLOSSARY_DETAILS.KEYS_DESCRIPTION_MODULES");
  return t("GLOSSARY_DETAILS.KEYS_DESCRIPTION");
};

const isNotFoundError = (error: unknown) => (error as { status?: unknown } | null)?.status === 404;

const getNoKeysText = (t: TFunction, glossary: IGlossary, hasModuleScope: boolean) => {
  if (glossary.isGlobal) return t("GLOSSARY_DETAILS.TAGGED_KEYS_EMPTY_GLOBAL");
  if (hasModuleScope) return t("GLOSSARY_DETAILS.TAGGED_KEYS_EMPTY_MODULES");
  return t("GLOSSARY_DETAILS.TAGGED_KEYS_EMPTY");
};

const GlossaryDetails: React.FC<GlossaryDetailsProps> = ({ itemId }) => {
  const { t } = useT(LOCALIZATION_GLOSSARY_MODULE);
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const {
    data: glossary,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useGetGlossaryById(itemId);
  const { data: languageListData } = useGetLanguages();
  const { data: moduleListData } = useGetLanguageModules();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [keysPage, setKeysPage] = useState(0);
  const [keysPageSize, setKeysPageSize] = useState(TAGGED_KEYS_PAGE_SIZE_OPTIONS[0]);
  const [keySearchInput, setKeySearchInput] = useState("");
  const [keySearch, setKeySearch] = useState("");
  const [keyModuleId, setKeyModuleId] = useState(ALL_MODULES);
  const [targetCode, setTargetCode] = useState<string | undefined>(undefined);
  const { mutateAsync: saveGlossary, isPending: isDeprecating } = useSaveGlossary();
  const fetchLatestGlossary = useFetchLatestGlossary();

  // One `Key/Gets` per 300 ms pause, restarting at page 0 (H4).
  useEffect(() => {
    const next = keySearchInput.trim();
    if (next === keySearch) return undefined;
    const timer = setTimeout(() => {
      setKeySearch(next);
      setKeysPage(0);
    }, TAGGED_KEYS_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keySearchInput, keySearch]);

  const {
    data: taggedKeysData,
    isLoading: isTaggedKeysLoading,
    isError: isTaggedKeysError,
    isRefetching: isTaggedKeysRefetching,
    refetch: refetchTaggedKeys,
  } = useGetKeysByGlossaryId(
    itemId,
    keysPage,
    keysPageSize,
    {
      searchKey: keySearch,
      moduleIds: keyModuleId === ALL_MODULES ? [] : [keyModuleId],
      glossaryModuleIds: getGlossaryModuleIds(glossary),
    },
    !!glossary,
  );

  // Fewer tagged keys than before can leave the current page past the last one.
  const taggedKeysTotal = taggedKeysData?.totalCount;
  if (
    typeof taggedKeysTotal === "number" &&
    keysPage > 0 &&
    keysPage * keysPageSize >= taggedKeysTotal
  ) {
    setKeysPage(Math.max(0, Math.ceil(taggedKeysTotal / keysPageSize) - 1));
  }

  if (glossary?.name) {
    // eslint-disable-next-line react-hooks/immutability -- The breadcrumb reads this registry during the same render.
    BREADCRUMB_CUSTOM_TITLES[`/app/:itemId/services/glossary/${glossary.itemId}`] = glossary.name;
  }

  if (isLoading) return <GlossaryDetailsSkeleton />;

  if (!glossary && isError && !isNotFoundError(error)) {
    return (
      <div role="alert" className="mt-10 flex flex-col items-center gap-3 text-center">
        <p className="text-medium-emphasis">{t("GLOSSARY_DETAILS.LOAD_FAILED")}</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          {isFetching && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {t("common:RETRY")}
        </Button>
      </div>
    );
  }

  if (!glossary) {
    return (
      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        <p className="text-medium-emphasis">{t("GLOSSARY_DETAILS.NOT_FOUND")}</p>
        <Button type="button" variant="outline" onClick={() => navigate(scoped("services/glossary"))}>
          {t("GLOSSARY_DETAILS.BACK_TO_GLOSSARY")}
        </Button>
      </div>
    );
  }

  const defaultLanguage = languageListData?.find((l) => l.isDefault);
  const targetLanguages = getTargetLanguages(languageListData);
  const selectedTarget =
    targetLanguages.find((language) => language.languageCode === targetCode) ?? targetLanguages[0];
  const meta = toGlossaryMeta(glossary);
  const isUnsupported = isUnsupportedGlossaryNote(glossary);
  const status = getGlossaryStatus(glossary);
  const moduleCount = glossary.moduleIds?.length ?? 0;
  const scopeLabel = getScopeLabel(t, glossary, moduleCount);
  const definition = stripRuleMarker(glossary.context);
  const usageExamples = (glossary.usageExamples ?? []).filter(hasText);
  const isKeyFiltered = !!keySearch || keyModuleId !== ALL_MODULES;
  const hasModuleScope = !glossary.isGlobal && moduleCount > 0;
  const keysDescription = getKeysDescription(t, glossary, hasModuleScope);
  const noKeysText = getNoKeysText(t, glossary, hasModuleScope);

  const resolvedLanguage =
    languageListData?.find((l) => l.languageCode === glossary.language)?.languageName ||
    glossary.language;

  const deprecate = async () => {
    try {
      const res = await saveGlossary({ ...toGlossarySavePayload(glossary), status: "deprecated" });
      if (res?.success) {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("GLOSSARY_DETAILS.DEPRECATED"),
        });
      } else if (res?.validationErrors?.some((e) => e.propertyName === VERSION_ERROR_PROPERTY)) {
        await fetchLatestGlossary(glossary.itemId).catch(() => undefined);
        toast({
          variant: "destructive",
          title: t("common:ERROR"),
          description: t("DELETE_GLOSSARY.VERSION_CONFLICT"),
        });
      } else {
        showErrorToast({ errors: res?.validationErrors?.[0]?.errorMessage || res?.errorMessage });
      }
    } catch (error) {
      toast({ variant: "destructive", title: t("common:ERROR"), description: getHttpErrorMessage(error) });
    }
  };

  const renderTaggedKeysToolbar = () => (
    <div className="flex flex-col gap-2 pb-4 md:flex-row md:items-center">
      <Input
        aria-label={t("GLOSSARY_DETAILS.SEARCH_KEYS")}
        placeholder={t("GLOSSARY_DETAILS.SEARCH_KEYS")}
        value={keySearchInput}
        onChange={(event) => setKeySearchInput(event.target.value)}
        className="h-9 w-full md:w-64"
      />
      <Select
        value={keyModuleId}
        onValueChange={(value) => {
          setKeyModuleId(value);
          setKeysPage(0);
        }}
      >
        <SelectTrigger aria-label={t("GLOSSARY_DETAILS.COLUMN_MODULE")} className="h-9 w-full md:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_MODULES}>{t("GLOSSARY_DETAILS.ALL_MODULES")}</SelectItem>
          {moduleListData?.map((module) => (
            <SelectItem key={module.itemId} value={module.itemId}>
              {module.moduleName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {targetLanguages.length > 0 && (
        <Select value={selectedTarget?.languageCode} onValueChange={setTargetCode}>
          <SelectTrigger aria-label={t("GLOSSARY_DETAILS.SHOW_TRANSLATION_IN")} className="h-9 w-full md:w-52">
            <SelectValue placeholder={t("GLOSSARY_DETAILS.SHOW_TRANSLATION_IN")} />
          </SelectTrigger>
          <SelectContent>
            {targetLanguages.map((language) => (
              <SelectItem key={language.languageCode} value={language.languageCode}>
                {language.languageName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );

  const renderTaggedKeysContent = () => {
    if (isTaggedKeysLoading) {
      return (
        <div className="flex flex-col gap-2">
          {TAGGED_KEYS_SKELETON_ROW_KEYS.map((rowKey) => (
            <Skeleton key={rowKey} className="h-10 w-full rounded-sm" />
          ))}
        </div>
      );
    }

    if (isTaggedKeysError || !taggedKeysData) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-medium-emphasis">{t("GLOSSARY_DETAILS.TAGGED_KEYS_FAILED")}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void refetchTaggedKeys()}
            disabled={isTaggedKeysRefetching}
          >
            {isTaggedKeysRefetching && (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {t("common:RETRY")}
          </Button>
        </div>
      );
    }

    if (!taggedKeysData.keys?.length) {
      return (
        <p className="text-sm text-medium-emphasis">
          {isKeyFiltered ? t("GLOSSARY_DETAILS.KEYS_NO_MATCH") : noKeysText}
        </p>
      );
    }

    return (
      <>
        <div className="w-full overflow-x-auto">
          <TooltipProvider>
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="font-bold text-medium-emphasis">
                    {t("GLOSSARY_DETAILS.COLUMN_KEY_NAME")}
                  </TableHead>
                  <TableHead className="font-bold text-medium-emphasis">
                    {t("GLOSSARY_DETAILS.COLUMN_MODULE")}
                  </TableHead>
                  <TableHead className="font-bold text-medium-emphasis">
                    {defaultLanguage
                      ? t("GLOSSARY_DETAILS.COLUMN_DEFAULT_NAMED", {
                          language: defaultLanguage.languageName,
                        })
                      : t("GLOSSARY_DETAILS.COLUMN_DEFAULT_LANGUAGE")}
                  </TableHead>
                  {selectedTarget && (
                    <TableHead className="font-bold text-medium-emphasis">
                      {selectedTarget.languageName}
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {taggedKeysData.keys.map((key) => {
                  const mod = moduleListData?.find((m) => m.itemId === key.moduleId);
                  const defaultResource = key.resources?.find(
                    (r) => r.culture === defaultLanguage?.languageCode,
                  );
                  const targetResource = key.resources?.find(
                    (r) => r.culture === selectedTarget?.languageCode,
                  );
                  const openKey = () =>
                    navigate(scoped(`services/language/translations/${key.itemId}`));
                  return (
                    <TableRow
                      key={key.itemId}
                      tabIndex={0}
                      className="cursor-pointer font-normal text-medium-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      onClick={openKey}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget || event.key !== "Enter") return;
                        event.preventDefault();
                        openKey();
                      }}
                    >
                      <TableCell className="font-mono text-xs text-high-emphasis">
                        <div className="flex flex-col gap-1">
                          <span className="flex flex-wrap items-center gap-2">
                            {key.keyName}
                            {hasModuleScope && (
                              <Badge variant="outline" className="w-fit px-1.5 py-0 font-sans font-medium">
                                {key.glossaryIds?.includes(glossary.itemId)
                                  ? t("GLOSSARY_DETAILS.KEY_SOURCE_TAGGED")
                                  : t("GLOSSARY_DETAILS.KEY_SOURCE_MODULE")}
                              </Badge>
                            )}
                          </span>
                          <TaggedKeyIssue glossaryKey={key} glossaryId={glossary.itemId} />
                        </div>
                      </TableCell>
                      <TableCell>{mod?.moduleName ?? key.moduleId}</TableCell>
                      <TableCell className="line-clamp-2">
                        {hasText(defaultResource?.value) ? defaultResource.value : <EmptyCell />}
                      </TableCell>
                      {selectedTarget && (
                        <TableCell>
                          {hasText(targetResource?.value) ? targetResource.value : <EmptyCell />}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TooltipProvider>
        </div>
        <div className="flex flex-col gap-3 border-t pt-3 md:flex-row md:items-center md:justify-between">
          <span className="text-sm text-medium-emphasis">
            {t("GLOSSARY_DETAILS.KEYS_TOTAL", { count: taggedKeysData.totalCount ?? 0 })}
          </span>
          <Pagination
            page={keysPage}
            pageSize={keysPageSize}
            totalCount={taggedKeysData.totalCount ?? 0}
            pageSizeOptions={TAGGED_KEYS_PAGE_SIZE_OPTIONS}
            onChange={setKeysPage}
            onPageSizeChange={(size) => {
              setKeysPageSize(size);
              setKeysPage(0);
            }}
          />
        </div>
      </>
    );
  };

  return (
    <div>
      <div className="hidden md:flex">
        <PageBreadcrumb />
      </div>

      <div className="mt-5 flex items-start justify-between gap-4">
        <h1 className="min-w-0 break-words text-2xl font-semibold">{glossary.name}</h1>
        <div className="flex shrink-0 gap-2">
          <GlossaryEditorSheet
            open={editModalOpen}
            onOpenChange={setEditModalOpen}
            glossary={glossary}
            trigger={
              <Button size="default" variant="outline" className="gap-2">
                <Pencil className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  {t("common:EDIT")}
                </span>
              </Button>
            }
          />

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline" aria-label={t("GLOSSARY_DETAILS.MORE_ACTIONS")}>
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {status !== "deprecated" && !isUnsupported && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={isDeprecating}
                  onSelect={() => void deprecate()}
                >
                  <Archive className="mr-2 h-4 w-4" aria-hidden="true" />
                  <span>{t("GLOSSARY_DETAILS.DEPRECATE")}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-error"
                onSelect={() => setDeleteModalOpen(true)}
              >
                <Trash className="mr-2 h-4 w-4" aria-hidden="true" />
                <span>{t("common:DELETE")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
            {deleteModalOpen && (
              <DeleteGlossary
                itemId={glossary.itemId}
                glossaryName={glossary.name}
                glossary={glossary}
                onClose={() => {
                  setDeleteModalOpen(false);
                  navigate(scoped("services/glossary"));
                }}
              />
            )}
          </Dialog>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!isUnsupported && <GlossaryRuleBadge rule={meta.rule} />}
        <GlossaryStatusBadge status={status} />
        <Badge variant="outline" className="w-fit">
          {scopeLabel}
        </Badge>
        {meta.caseSensitive && (
          <Badge variant="outline" className="w-fit">
            {t("GLOSSARY_DETAILS.CASE_SENSITIVE")}
          </Badge>
        )}
      </div>
      {meta.variants.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-medium-emphasis">{t("GLOSSARY_DETAILS.VARIANTS")}</span>
          {meta.variants.map((variant, index) => (
            // Stored variants may repeat (written by other clients), so the index keeps keys unique.
            <Badge key={`${variant}-${index}`} variant="secondary" className="w-fit">
              {variant}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="rounded-sm shadow-none lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-xl">{t("GLOSSARY_DETAILS.TRANSLATIONS")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {renderTranslationsContent(t, glossary, meta, isUnsupported, languageListData)}
          </CardContent>
        </Card>

        <Card className="h-min rounded-sm shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">{t("common:DETAILS")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <DetailField label={t("GLOSSARY_DETAILS.LANGUAGE")}>
                <DetailValue value={resolvedLanguage} />
              </DetailField>
              <DetailField label={t("GLOSSARY_DETAILS.TYPE")}>
                <DetailValue value={glossary.type} />
              </DetailField>
              <DetailField label={t("GLOSSARY_DETAILS.PART_OF_SPEECH")}>
                <DetailValue
                  value={glossary.partOfSpeech ? GLOSSARY_PART_OF_SPEECH_LABELS[glossary.partOfSpeech] : undefined}
                />
              </DetailField>
              <DetailField label={t("GLOSSARY_DETAILS.CREATED_ON")}>
                <DetailValue value={formatDate(glossary.createDate)} />
              </DetailField>
              <DetailField label={t("GLOSSARY_DETAILS.LAST_UPDATED")}>
                <DetailValue value={formatDate(glossary.lastUpdateDate)} />
              </DetailField>
            </div>

            <DetailField label={t("GLOSSARY_DETAILS.TAGGED_MODULES")}>
              {moduleCount > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {glossary.moduleIds?.map((id) => {
                    const mod = moduleListData?.find((m) => m.itemId === id);
                    return (
                      <Badge key={id} variant="secondary">
                        {mod?.moduleName ?? id}
                      </Badge>
                    );
                  })}
                </div>
              ) : (
                <EmptyText>
                  {glossary.isGlobal
                    ? t("GLOSSARY_DETAILS.APPLIES_TO_ALL")
                    : t("GLOSSARY_DETAILS.NO_MODULES_TAGGED")}
                </EmptyText>
              )}
            </DetailField>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="rounded-sm shadow-none">
            <CardHeader>
              <CardTitle className="text-xl">{t("GLOSSARY_DETAILS.DEFINITION")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {hasText(definition) ? (
                <p className="whitespace-pre-wrap break-words text-base text-medium-emphasis">
                  {definition}
                </p>
              ) : (
                <EmptyText>{t("GLOSSARY_DETAILS.NO_DEFINITION")}</EmptyText>
              )}
              {usageExamples.length > 0 && (
                <DetailField label={t("GLOSSARY_DETAILS.USAGE_EXAMPLES")}>
                  <ul className="list-disc space-y-1 pl-5 text-base text-medium-emphasis">
                    {usageExamples.map((example, index) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <li key={`${index}-${example}`} className="break-words">
                        {example}
                      </li>
                    ))}
                  </ul>
                </DetailField>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-sm shadow-none">
            <CardHeader className="flex-row items-center gap-1.5">
              <CardTitle className="text-xl">{t("GLOSSARY_DETAILS.INTERNAL_NOTE")}</CardTitle>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={t("GLOSSARY_DETAILS.ABOUT_INTERNAL_NOTE")}
                      className="inline-flex shrink-0 rounded-full text-low-emphasis transition-colors hover:text-medium-emphasis focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <Info className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start" className="max-w-72 text-left text-xs font-normal">
                    {t("GLOSSARY_DETAILS.INTERNAL_NOTE_TOOLTIP")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardHeader>
            <CardContent>
              {hasText(meta.note) ? (
                <p className="whitespace-pre-wrap break-words text-base text-medium-emphasis">
                  {meta.note}
                </p>
              ) : (
                <EmptyText>{t("GLOSSARY_DETAILS.NO_INTERNAL_NOTE")}</EmptyText>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-6 rounded-sm shadow-none">
        <CardHeader className="gap-1">
          <CardTitle className="text-xl">{t("GLOSSARY_DETAILS.TAGGED_KEYS")}</CardTitle>
          <p className="text-sm text-medium-emphasis">{keysDescription}</p>
        </CardHeader>
        <CardContent className="p-0">
          {renderTaggedKeysToolbar()}
          {renderTaggedKeysContent()}
        </CardContent>
      </Card>
    </div>
  );
};

export default GlossaryDetails;
