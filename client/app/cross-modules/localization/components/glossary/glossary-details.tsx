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
  RefreshCw,
  Sparkles,
  Trash,
  TriangleAlert,
} from "lucide-react";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { formatErrorMessage } from "@/lib/error";
import {
  useFetchLatestGlossary,
  useGetGlossaryById,
  useGetKeysByGlossaryId,
  useGetLanguageModules,
  useGetLanguages,
  useRecheckGlossary,
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
import DeleteGlossary from "@blocks-localization/components/modals/glossary/delete-glossary";
import { useScopedPath } from "@seliseblocks/genesis-os";

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

const NOT_PROVIDED = "Not provided";

const hasText = (value: string | null | undefined): value is string => !!value?.trim();

const formatDate = (value: string | null | undefined) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleDateString();
};

const isPermissionError = (error: unknown) => {
  const status = (error as { status?: unknown } | null)?.status;
  return status === 401 || status === 403;
};

// Empty table cells show a muted dash; screen readers hear "None" instead of a stray symbol.
const EmptyCell = () => (
  <span className="text-low-emphasis">
    <span aria-hidden="true">—</span>
    <span className="sr-only">None</span>
  </span>
);

const DetailField = ({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) => (
  <div className="grid min-w-0 content-start gap-1">
    <h3 className="text-sm font-medium text-low-emphasis">{label}</h3>
    {children}
  </div>
);

const DetailValue = ({ value }: Readonly<{ value: string | null | undefined }>) =>
  hasText(value) ? (
    <p className="break-words text-base font-normal text-high-emphasis">{value}</p>
  ) : (
    <p className="text-base font-normal italic text-low-emphasis">{NOT_PROVIDED}</p>
  );

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
  const existing = translations.find((translation) => translation.language === code);
  const updated = { language: code, value: trimmed, forbiddenValues: existing?.forbiddenValues ?? [] };
  const others = translations.filter((translation) => translation.language !== code);
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
  const showTranslation = meta.rule === "translate";
  const [editing, setEditing] = useState<{ code: string; value: string } | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const { isPending, mutateAsync } = useSaveGlossary();
  const fetchLatestGlossary = useFetchLatestGlossary();
  const { suggest, pendingCodes } = useGlossaryTermSuggestion();

  const save = async () => {
    if (!editing) return;
    const payload = toGlossarySavePayload(glossary);
    try {
      const res = await mutateAsync({
        ...payload,
        translations: withTranslation(payload.translations, editing.code, editing.value),
      });
      if (res?.success) {
        setEditing(null);
        setHasConflict(false);
        toast({ variant: "success", title: "Success", description: "Translation saved." });
      } else if (res?.validationErrors?.some((e) => e.propertyName === VERSION_ERROR_PROPERTY)) {
        setHasConflict(true);
      } else {
        showErrorToast({ errors: res?.validationErrors?.[0]?.errorMessage || res?.errorMessage });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: formatErrorMessage(error) });
    }
  };

  const reloadLatest = async () => {
    setIsReloading(true);
    try {
      // Refreshes the details data; the edited value stays in the input.
      await fetchLatestGlossary(glossary.itemId);
      setHasConflict(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: formatErrorMessage(error) });
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
    const value = meta.translations[languageCode];
    if (editing?.code === languageCode) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={`${languageName} translation`}
            value={editing.value}
            onChange={(event) => setEditing({ code: languageCode, value: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") void save();
              if (event.key === "Escape") setEditing(null);
            }}
            className="h-8 w-56"
            autoFocus
            disabled={isPending}
          />
          <Button size="sm" onClick={() => void save()} disabled={isPending}>
            {isPending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Save
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
            Cancel
          </Button>
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
              Missing
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
                Suggest
              </Button>
            )}
          </>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label={`Edit ${languageName} translation`}
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
              <p>This term was changed by someone else. Reload the latest version, then save again.</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-1"
                onClick={() => void reloadLatest()}
                disabled={isReloading}
              >
                {isReloading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Reload latest
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}
      <div className="w-full overflow-x-auto">
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="border-none hover:bg-transparent">
              <TableHead className="font-bold text-medium-emphasis">Language</TableHead>
              {showTranslation && (
                <TableHead className="font-bold text-medium-emphasis">Translation</TableHead>
              )}
              <TableHead className="font-bold text-medium-emphasis">Forbidden alternatives</TableHead>
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
                  <ForbiddenList values={meta.forbidden[language.languageCode] ?? []} />
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
  glossary: IGlossary,
  meta: GlossaryMeta,
  isUnsupported: boolean,
  languages: ILanguageConfig[] | undefined,
) {
  if (isUnsupported) {
    return (
      <p className="text-sm text-medium-emphasis">
        This term was saved by a newer version and can&apos;t be shown here.
      </p>
    );
  }
  if (meta.rule === "keep") {
    return <p className="text-sm text-medium-emphasis">Kept as-is in all languages.</p>;
  }
  const targets = getTargetLanguages(languages);
  if (targets.length === 0) {
    return (
      <p className="text-sm text-medium-emphasis">
        The project has no languages to translate into.
      </p>
    );
  }
  return (
    <>
      {meta.rule === "forbidden" && (
        <p className="pb-4 text-sm text-medium-emphasis">Do not use this term.</p>
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
          Issue
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

const GlossaryDetails: React.FC<GlossaryDetailsProps> = ({ itemId }) => {
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const { data: glossary, isLoading } = useGetGlossaryById(itemId);
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
  const [canRecheck, setCanRecheck] = useState(true);
  const { mutateAsync: recheck, isPending: isRechecking } = useRecheckGlossary();
  const { mutateAsync: saveGlossary, isPending: isDeprecating } = useSaveGlossary();

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
  } = useGetKeysByGlossaryId(itemId, keysPage, keysPageSize, {
    searchKey: keySearch,
    moduleIds: keyModuleId === ALL_MODULES ? [] : [keyModuleId],
  });

  if (glossary?.name) {
    // eslint-disable-next-line react-hooks/immutability -- The breadcrumb reads this registry during the same render.
    BREADCRUMB_CUSTOM_TITLES[`/app/:itemId/services/glossary/${glossary.itemId}`] = glossary.name;
  }

  if (isLoading) {
    return (
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
  }

  if (!glossary) {
    return (
      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        <p className="text-medium-emphasis">Glossary item not found.</p>
        <Button type="button" variant="outline" onClick={() => navigate(scoped("services/glossary"))}>
          Back to glossary
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
  const moduleSuffix = moduleCount === 1 ? "" : "s";
  const scopeLabel = glossary.isGlobal ? "Whole project" : `${moduleCount} module${moduleSuffix}`;
  const definition = stripRuleMarker(glossary.context);
  const usageExamples = (glossary.usageExamples ?? []).filter(hasText);
  const isKeyFiltered = !!keySearch || keyModuleId !== ALL_MODULES;

  const resolvedLanguage =
    languageListData?.find((l) => l.languageCode === glossary.language)?.languageName ||
    glossary.language;

  const startRecheck = async () => {
    try {
      const res = await recheck({ itemId: glossary.itemId });
      toast({
        variant: res?.queued ? "success" : "default",
        title: res?.queued ? "Success" : "Re-check not started",
        description: res?.queued
          ? "Re-check started. Issues update within a few minutes."
          : "A re-check is already queued, or glossary checks are off for this project.",
      });
    } catch (error) {
      // No `glossary::recheck` permission: hide the action from now on (Phase 8 permissions).
      if (isPermissionError(error)) setCanRecheck(false);
      showErrorToast({ errors: formatErrorMessage(error) });
    }
  };

  const deprecate = async () => {
    try {
      const res = await saveGlossary({ ...toGlossarySavePayload(glossary), status: "deprecated" });
      if (res?.success) {
        toast({
          variant: "success",
          title: "Success",
          description: "Term deprecated. It no longer reaches the AI or highlights.",
        });
      } else {
        showErrorToast({ errors: res?.validationErrors?.[0]?.errorMessage || res?.errorMessage });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: formatErrorMessage(error) });
    }
  };

  const renderTaggedKeysToolbar = () => (
    <div className="flex flex-col gap-2 pb-4 md:flex-row md:items-center">
      <Input
        aria-label="Search keys"
        placeholder="Search keys"
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
        <SelectTrigger aria-label="Module" className="h-9 w-full md:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_MODULES}>All modules</SelectItem>
          {moduleListData?.map((module) => (
            <SelectItem key={module.itemId} value={module.itemId}>
              {module.moduleName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {targetLanguages.length > 0 && (
        <Select value={selectedTarget?.languageCode} onValueChange={setTargetCode}>
          <SelectTrigger aria-label="Show translation in" className="h-9 w-full md:w-52">
            <SelectValue placeholder="Show translation in" />
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
          <p className="text-sm text-medium-emphasis">Failed to load tagged keys.</p>
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
            Retry
          </Button>
        </div>
      );
    }

    if (!taggedKeysData.keys?.length) {
      return (
        <p className="text-sm text-medium-emphasis">
          {isKeyFiltered
            ? "No tagged keys match the search or module."
            : "No keys are tagged with this glossary."}
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
                  <TableHead className="font-bold text-medium-emphasis">Key Name</TableHead>
                  <TableHead className="font-bold text-medium-emphasis">Module</TableHead>
                  <TableHead className="font-bold text-medium-emphasis">
                    {defaultLanguage
                      ? `${defaultLanguage.languageName} (Default)`
                      : "Default Language"}
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
                          {key.keyName}
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
            {taggedKeysData.totalCount} key
            {taggedKeysData.totalCount === 1 ? "" : "s"} total
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
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Edit</span>
              </Button>
            }
          />

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canRecheck && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={isRechecking}
                  onSelect={() => void startRecheck()}
                >
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  <span>{isRechecking ? "Re-checking…" : "Re-check keys"}</span>
                </DropdownMenuItem>
              )}
              {status !== "deprecated" && !isUnsupported && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={isDeprecating}
                  onSelect={() => void deprecate()}
                >
                  <Archive className="mr-2 h-4 w-4" aria-hidden="true" />
                  <span>Deprecate</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-error"
                onSelect={() => setDeleteModalOpen(true)}
              >
                <Trash className="mr-2 h-4 w-4" aria-hidden="true" />
                <span>Delete</span>
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
            Case-sensitive
          </Badge>
        )}
      </div>
      {meta.variants.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-medium-emphasis">Variants:</span>
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
            <CardTitle className="text-xl">Translations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {renderTranslationsContent(glossary, meta, isUnsupported, languageListData)}
          </CardContent>
        </Card>

        <Card className="h-min rounded-sm shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <DetailField label="Language">
                <DetailValue value={resolvedLanguage} />
              </DetailField>
              <DetailField label="Type">
                <DetailValue value={glossary.type} />
              </DetailField>
              <DetailField label="Part of speech">
                <DetailValue
                  value={glossary.partOfSpeech ? GLOSSARY_PART_OF_SPEECH_LABELS[glossary.partOfSpeech] : undefined}
                />
              </DetailField>
              <DetailField label="Created on">
                <DetailValue value={formatDate(glossary.createDate)} />
              </DetailField>
              <DetailField label="Last updated">
                <DetailValue value={formatDate(glossary.lastUpdateDate)} />
              </DetailField>
            </div>

            <DetailField label="Tagged Modules">
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
                  {glossary.isGlobal ? "Applies to every module." : "No modules tagged."}
                </EmptyText>
              )}
            </DetailField>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="rounded-sm shadow-none">
            <CardHeader>
              <CardTitle className="text-xl">Definition</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {hasText(definition) ? (
                <p className="whitespace-pre-wrap break-words text-base text-medium-emphasis">
                  {definition}
                </p>
              ) : (
                <EmptyText>No definition provided.</EmptyText>
              )}
              {usageExamples.length > 0 && (
                <DetailField label="Usage examples">
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
              <CardTitle className="text-xl">Internal Note</CardTitle>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="About internal note"
                      className="inline-flex shrink-0 rounded-full text-low-emphasis transition-colors hover:text-medium-emphasis focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <Info className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start" className="max-w-72 text-left text-xs font-normal">
                    Notes for your team, such as where the term came from or who approved it. Never
                    sent to the AI.
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
                <EmptyText>No internal note.</EmptyText>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-6 rounded-sm shadow-none">
        <CardHeader>
          <CardTitle className="text-xl">Tagged Keys</CardTitle>
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
