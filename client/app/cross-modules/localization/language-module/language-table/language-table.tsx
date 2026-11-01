import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react";
import { useNavigate } from "react-router";
import { useQueryState } from "nuqs";
import { v4 as uuidv4 } from "uuid";
import { useScopedPath, useProjectStore } from "@seliseblocks/genesis-os";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";
import type { OnChangeFn, Row, RowSelectionState } from "@tanstack/react-table";
import {
  EllipsisVertical,
  FolderInput,
  FolderOutput,
  History,
  PencilLine,
  Plus,
  Rocket,
  Settings2,
  Trash,
  Wand,
  Languages,
  X,
  CircleAlert,
  LoaderCircle,
} from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import {
  LanguageTableToolbar,
  useKeysFilterQueryParams,
  useKeysSortQueryParams,
} from "@blocks-localization/components/language-table-toolbar/language-table-toolbar";
import AutoTranslate from "@blocks-localization/components/modals/auto-translate/auto-translate";
import ExportKey from "@blocks-localization/components/modals/export-key/export-key";
import {
  useDeleteLanguageKey,
  useDeleteLanguageKeys,
  useGenerateUilmFile,
  useGetLanguageModules,
  useGetLanguages,
  useTranslateKey,
  useTranslateKeyWithPolling,
  useTranslateLanguageKeys,
} from "@blocks-localization/hooks/use-language-manager";
import { localizationQueryKeys } from "@blocks-localization/constants/query-keys";
import {
  useLanguageViewStore,
  updateLanguageViewTenantId,
} from "@blocks-localization/store/use-language-view-store";
import { shortGuidGenerator } from "@/components/create-project/utils";
import ImportFileModal from "../../components/import-language-file/import-file-modal";
import LocalizationTimeline from "../localization-timeline/localization-timeline";
import { useNotificationListener } from "@blocks-utilities/notification";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import ConfirmationModal from "@/components/confirmation-modal/confirmation-modal";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import type {
  IBaseMutationResponse,
  IBlocksLanguageKey,
  ILanguageConfig,
} from "@blocks-localization/models/language";
import { toast } from "@/hooks/use-toast";
import { FilterControls, type SortValue } from "@/components/filter-toolbar";
import { InlineKeyDetails } from "./components/inline-key-details";
import { DuplicateKeysChips } from "./components/duplicate-keys-chips";
import { BulkEditKeysDialog } from "./components/bulk-edit-keys-dialog";
import { useLanguageTableColumns } from "./hooks/use-language-table-columns";
import { useLanguageKeysQueries } from "./hooks/use-language-keys-queries";
import {
  getImportFileLabel,
  useLanguageImportProgress,
  type LanguageImportProgress,
} from "./hooks/use-language-import-progress";
import {
  areAllRowsSelected,
  getDeleteKeyErrorMessage,
  getDeleteKeysErrorMessage,
  getKeyListErrorCode,
  getPageSizeOptions,
  getResourceSearchFilters,
  getSelectedKeysLabel,
  getStickyBodyCellClassName,
  getStickyHeaderClassName,
  getStretchedColumnWidths,
  parseResourceSearch,
  TABLE_ROW_HEIGHT_ESTIMATE,
  toKeyPageSize,
  updateResourceSearchValue,
  withRowsSelected,
} from "./language-table.utils";
import { tStatic, useT } from "@seliseblocks/genesis-os/i18n";

const LOCALIZATION_LANGUAGE_TABLE_MODULE = "localization.language-table";
const COMMON_DELETE = "common:DELETE";
const COMMON_CANCEL = "common:CANCEL";
const LANGUAGE_TABLE_TRANSLATE = "LANGUAGE_TABLE.TRANSLATE";
const COMMON_SUCCESS = "common:SUCCESS";

// The virtualizer is only needed in the All view, so it stays out of the main bundle.
const VirtualKeyRows = lazy(() => import("./components/virtual-key-rows"));

/** Skeleton rows are capped so a large page size doesn't mount (and reserve height for) hundreds of rows. */
const MAX_SKELETON_ROWS = 20;
const CURSOR_RESET_ERROR_CODES = new Set(["CURSOR_MISMATCH", "INVALID_CURSOR"]);
/** Fixed ids for the placeholder rows, so a loading table keeps the same rows between renders. */
const SKELETON_ROW_IDS = Array.from(
  { length: MAX_SKELETON_ROWS },
  (_, row) => `skeleton-row-${row}`,
);

const getTableSkeletonClassName = (columnId: string) => {
  if (columnId === "select") return "h-4 w-4 rounded";
  if (columnId === "keyName") return "h-5 w-[150px] rounded md:w-[200px]";
  if (columnId === "moduleId") return "h-5 w-24 rounded sm:w-[150px]";
  if (columnId.startsWith("resources_")) {
    return "h-5 w-[300px] rounded md:w-[200px]";
  }
  if (columnId === "createDate" || columnId === "lastUpdateDate") {
    return "h-5 w-[150px] rounded";
  }
  if (columnId === "actions") return "h-5 w-5 rounded";
  return "h-5 w-24 rounded";
};

const getTableColumnClassName = (columnId: string) => {
  if (columnId === "select") return "w-8";
  if (columnId === "keyName") return "w-[332px] md:w-[232px]";
  if (columnId === "moduleId") return "w-32 sm:w-[182px]";
  if (columnId.startsWith("resources_")) return "w-[332px] md:w-[232px]";
  if (columnId === "createDate") return "w-[182px]";
  if (columnId === "lastUpdateDate") return "w-[220px]";
  if (columnId === "actions") return "w-12";
  return "w-36";
};

type KeysFilterQueryParams = ReturnType<typeof useKeysFilterQueryParams>["queryParams"];

const hasActiveKeyFilters = (
  queryParams: KeysFilterQueryParams,
  resourceSearchFilterCount: number,
) =>
  Boolean(
    queryParams.search ||
    (queryParams.moduleIds && queryParams.moduleIds.length > 0) ||
    (queryParams.missingLanguages && queryParams.missingLanguages.length > 0) ||
    queryParams.createStartDate ||
    queryParams.createEndDate ||
    queryParams.lastUpdateStartDate ||
    queryParams.lastUpdateEndDate ||
    queryParams.duplicates ||
    resourceSearchFilterCount > 0,
  );

const getDefaultLanguageCode = (languages: ILanguageConfig[] | undefined) => {
  if (!languages) return "en-US";
  const defaultLang = languages.find((lang) => lang.isDefault);
  return defaultLang?.languageCode ?? "en-US";
};

/** Rows the current page should show: a full page, fewer on the last page, at least one. */
const getExpectedRowCount = (totalCount: number, pageNumber: number, pageSize: number) =>
  totalCount > 0 ? Math.max(Math.min(totalCount - pageNumber * pageSize, pageSize), 1) : pageSize;

/** How many rows to expect on screen, and how many placeholder rows to show while loading. */
const getRowCountTargets = (
  isAllView: boolean,
  totalCount: number,
  pageNumber: number,
  pageSize: number,
) => {
  const expectedRowCount = getExpectedRowCount(totalCount, isAllView ? 0 : pageNumber, pageSize);
  return {
    expectedRowCount,
    skeletonRowCount: isAllView ? MAX_SKELETON_ROWS : Math.min(expectedRowCount, MAX_SKELETON_ROWS),
  };
};

const getSelectAllLabel = (isAllView: boolean, loadedCount: number) =>
  isAllView
    ? tStatic(LOCALIZATION_LANGUAGE_TABLE_MODULE, "LANGUAGE_TABLE.SELECT_ALL_LOADED", {
        count: loadedCount,
      })
    : undefined;

/** Where the paged table and the All view differ: scrolling, sticky header, row count and footer. */
const getKeyTableLayout = ({
  isAllView,
  minHeight,
  allViewRowCount,
  pageNumber,
  pagedPageSize,
  totalCount,
}: {
  isAllView: boolean;
  minHeight: number;
  allViewRowCount: number;
  pageNumber: number;
  pagedPageSize: number;
  totalCount: number;
}) => ({
  viewportClassName: `language-table-scrollbar w-full ${isAllView ? "overflow-auto" : "overflow-x-auto"} @container [&>div]:overflow-visible`,
  viewportStyle: isAllView
    ? { maxHeight: "calc(100dvh - 280px)", minHeight: "320px" }
    : { minHeight: `${minHeight}px` },
  ariaRowCount: isAllView ? allViewRowCount : undefined,
  headerClassName: isAllView ? "sticky top-0 z-20 bg-card" : undefined,
  paginationPage: isAllView ? 0 : pageNumber,
  // In the All view the select shows its "All (n)" option, which is the total.
  paginationPageSize: isAllView ? totalCount : pagedPageSize,
  paginationMode: isAllView ? ("all" as const) : ("paged" as const),
});

const showErrorToast = (description: string) => {
  toast({
    variant: "destructive",
    title: tStatic(LOCALIZATION_LANGUAGE_TABLE_MODULE, "common:ERROR"),
    description,
  });
};

/**
 * Runs a key action and reports it: a success toast and `onSuccess` when the server accepts it,
 * otherwise an error toast built from the returned errors or from what was thrown.
 */
async function runKeyAction({
  request,
  success,
  onSuccess,
  describeErrors,
  describeException,
}: {
  request: () => Promise<IBaseMutationResponse | undefined>;
  success: { title: string; description: string };
  onSuccess: () => void;
  describeErrors: (errors: unknown) => string;
  describeException: (error: unknown) => string;
}) {
  try {
    const res = await request();
    if (res?.isSuccess) {
      toast({
        variant: "success",
        title: success.title,
        description: success.description,
      });
      onSuccess();
    } else {
      showErrorToast(describeErrors(res?.errors));
    }
  } catch (error) {
    showErrorToast(describeException(error));
  }
}

const stringifyError = (error: unknown) => JSON.stringify(error);

// Returns a new Set so React state updaters see a changed reference.
const addKeysToSet = (keys: Set<string>, keyIds: Iterable<string>) => {
  const next = new Set(keys);
  for (const keyId of keyIds) next.add(keyId);
  return next;
};

const removeKeysFromSet = (keys: Set<string>, keyIds: Iterable<string>) => {
  const next = new Set(keys);
  for (const keyId of keyIds) next.delete(keyId);
  return next;
};

function LanguageTableEmptyState({
  hasActiveFilters,
  importProgress,
}: Readonly<{
  hasActiveFilters: boolean;
  importProgress: LanguageImportProgress | null;
}>) {
  const { t } = useT(LOCALIZATION_LANGUAGE_TABLE_MODULE);
  if (hasActiveFilters && !importProgress) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <p className="font-medium text-high-emphasis">{t("LANGUAGE_TABLE.NO_MATCHING_KEYS")}</p>
        <p className="text-muted-foreground">{t("LANGUAGE_TABLE.NO_MATCHING_KEYS_HINT")}</p>
      </div>
    );
  }

  if (importProgress) {
    return <ImportProgressState importProgress={importProgress} />;
  }

  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 px-4 py-12">
      <p className="font-medium text-high-emphasis">{t("LANGUAGE_TABLE.NO_KEYS_YET")}</p>
      <p className="text-muted-foreground">{t("LANGUAGE_TABLE.NO_KEYS_YET_HINT")}</p>
    </div>
  );
}

function AllViewLoadError({ onRetry }: Readonly<{ onRetry: () => void }>) {
  const { t } = useT(LOCALIZATION_LANGUAGE_TABLE_MODULE);
  return (
    <div className="flex items-center justify-center gap-3">
      <span className="text-sm text-medium-emphasis">{t("LANGUAGE_TABLE.LOAD_MORE_FAILED")}</span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t("common:RETRY")}
      </Button>
    </div>
  );
}

function ImportProgressState({
  importProgress,
}: Readonly<{
  importProgress: LanguageImportProgress;
}>) {
  const { t } = useT(LOCALIZATION_LANGUAGE_TABLE_MODULE);
  const isFailed = importProgress.status === "failed";
  const isDelayed = importProgress.status === "delayed";
  const isFinalizing = importProgress.status === "finalizing";
  const isProcessing = !isFailed && !isDelayed;

  const getImportTitle = () => {
    if (isFailed) return t("LANGUAGE_TABLE.IMPORT_FAILED_TITLE");
    if (isDelayed) return t("LANGUAGE_TABLE.IMPORT_DELAYED_TITLE");
    if (isFinalizing) return t("LANGUAGE_TABLE.IMPORT_FINALIZING_TITLE");
    return t("LANGUAGE_TABLE.IMPORT_PROCESSING_TITLE");
  };

  const getImportDescription = () => {
    if (isFailed) return t("LANGUAGE_TABLE.IMPORT_FAILED_DESCRIPTION");
    if (isDelayed) return t("LANGUAGE_TABLE.IMPORT_DELAYED_DESCRIPTION");
    if (isFinalizing) return t("LANGUAGE_TABLE.IMPORT_FINALIZING_DESCRIPTION");
    return t("LANGUAGE_TABLE.IMPORT_PROCESSING_DESCRIPTION");
  };

  const title = getImportTitle();
  const description = getImportDescription();

  return (
    <div
      className="flex min-h-[280px] flex-col items-center justify-center gap-3 px-4 py-12"
      aria-live="polite"
      aria-busy={isProcessing}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blocks-primary-shades-300 text-primary">
        {isFailed ? (
          <CircleAlert className="h-5 w-5 text-error" aria-hidden="true" />
        ) : (
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
        )}
      </div>
      <div className="max-w-xl space-y-1 text-center">
        <p className="font-medium text-high-emphasis">{title}</p>
        <p className="text-sm text-medium-emphasis">{description}</p>
      </div>
      <p
        className="max-w-xs truncate text-xs text-low-emphasis"
        title={getImportFileLabel(importProgress.fileNames)}
      >
        {getImportFileLabel(importProgress.fileNames)}
      </p>
    </div>
  );
}
export function LanguageTable() {
  "use no memo";

  const { t } = useT(LOCALIZATION_LANGUAGE_TABLE_MODULE);
  const {
    selectedLanguages,
    setSelectedLanguages,
    toggleLanguage: toggleLanguageInStore,
    selectedOptionalColumns,
    toggleOptionalColumn,
    isHydrated,
    hasStoredViewSettings,
  } = useLanguageViewStore();
  const { queryParams, setQueryParams } = useKeysFilterQueryParams();
  const { sortQueryParams, setSortQueryParams, reset: sortReset } = useKeysSortQueryParams();

  const handleSortChange = useCallback(
    (sort: SortValue) => {
      setSortQueryParams(sort);
      setQueryParams((prev) => ({
        ...prev,
        pageNumber: 0,
      }));
    },
    [setQueryParams, setSortQueryParams],
  );

  const selectedLanguagesRef = useRef(selectedLanguages);
  selectedLanguagesRef.current = selectedLanguages;

  const resourceSearchMap = useMemo(
    () => parseResourceSearch(queryParams.resourceSearch),
    [queryParams.resourceSearch],
  );

  const resourceSearchFilters = useMemo(
    () => getResourceSearchFilters(resourceSearchMap),
    [resourceSearchMap],
  );

  const updateResourceSearch = useCallback(
    (culture: string, searchText: string) => {
      setQueryParams((prev) => ({
        ...prev,
        resourceSearch: updateResourceSearchValue(prev.resourceSearch, culture, searchText),
        pageNumber: 0,
      }));
    },
    [setQueryParams],
  );

  const keySearch = queryParams.search || "";

  const hasActiveFilters = hasActiveKeyFilters(queryParams, resourceSearchFilters.length);

  const updateKeySearch = useCallback(
    (value: string) => {
      setQueryParams((prev) => ({
        ...prev,
        search: value,
        pageNumber: 0,
      }));
    },
    [setQueryParams],
  );

  const {
    isAllView,
    pagedPageSize,
    createDateRange,
    lastUpdateDateRange,
    allViewQuery,
    allViewKeys,
    allViewTotalCount,
    pagedData: blocksLanguageKeyData,
    isLoading,
    isFetching,
    isPlaceholderData,
    currentTotalCount,
    refetchLanguageKeys,
    showDuplicatesTruncatedNote,
  } = useLanguageKeysQueries({ queryParams, sortQueryParams, resourceSearchFilters });

  const {
    progress: importProgress,
    isSyncingModules,
    onImportStarted,
    onImportRequestFailed,
  } = useLanguageImportProgress({
    totalCount: currentTotalCount,
    refetch: refetchLanguageKeys,
  });

  const { isLoading: isLanguageModulesLoading, data: languageModules } = useGetLanguageModules();
  const { data: languageListData } = useGetLanguages();

  const defaultLanguageCode = useMemo(
    () => getDefaultLanguageCode(languageListData),
    [languageListData],
  );

  const navigate = useNavigate();
  const scoped = useScopedPath();
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isAutoTranslateDialogOpen, setIsAutoTranslateDialogOpen] = useState(false);
  const [tabId, setTabId] = useQueryState("languageActivity", {
    defaultValue: "keys",
  });
  const { isPending, mutateAsync } = useGenerateUilmFile();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPublishChangesDialogOpen, setIsPublishChangesDialogOpen] = useState(false);
  const [selectedLanguageKeyId, setSelectedLanguageKeyId] = useState<string | null>(null);
  const { isPending: isDeleteLanguageKeyPending, mutateAsync: deleteAsync } =
    useDeleteLanguageKey();
  const { isPending: isTranslatingKey, mutateAsync: translateKeyAsync } = useTranslateKey();
  const [isTranslateDialogOpen, setIsTranslateDialogOpen] = useState(false);
  const [pollingKeyId, setPollingKeyId] = useState<string | null>(null);
  const [translatingKeys, setTranslatingKeys] = useState<Set<string>>(new Set());
  const [rowSelectionState, setRowSelectionState] = useState<RowSelectionState>({});
  // In the All view, while every loaded row is selected, the rows of later chunks are selected as
  // they load, so select-all keeps covering the list while scrolling.
  const isSelectingAllLoadedRef = useRef(false);
  const setRowSelection = useCallback<OnChangeFn<RowSelectionState>>(
    (updater) => {
      const next = typeof updater === "function" ? updater(rowSelectionState) : updater;
      isSelectingAllLoadedRef.current =
        isAllView &&
        areAllRowsSelected(
          allViewKeys.map((key) => key.itemId),
          next,
        );
      setRowSelectionState(next);
    },
    [rowSelectionState, isAllView, allViewKeys],
  );
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkTranslateDialogOpen, setIsBulkTranslateDialogOpen] = useState(false);
  const [isBulkEditDialogOpen, setIsBulkEditDialogOpen] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const { isPending: isBulkDeletingKeys, mutateAsync: bulkDeleteAsync } = useDeleteLanguageKeys();
  const { isPending: isBulkTranslatingKeys, mutateAsync: bulkTranslateAsync } =
    useTranslateLanguageKeys();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";

  // Poll for translation completion when a key translation is in progress
  useTranslateKeyWithPolling(pollingKeyId || "", tenantId, () => {
    if (pollingKeyId) {
      setTranslatingKeys((prev) => {
        const next = new Set(prev);
        next.delete(pollingKeyId);
        return next;
      });
    }
    setPollingKeyId(null);
  });

  // Listen for translate-all completion notification to clear translatingKeys
  useNotificationListener("translate-all", () => {
    setTranslatingKeys(new Set());
  });

  // Track the previous tenantId to detect actual project changes
  const prevTenantIdRef = useRef<string | null>(null);

  // Handle project changes - update tenantId and rehydrate for the new tenant
  useEffect(() => {
    if (!tenantId) return;

    const prevTenantId = prevTenantIdRef.current;

    if (prevTenantId === null) {
      prevTenantIdRef.current = tenantId;
      updateLanguageViewTenantId(tenantId);
      return;
    }

    // If same project, no action needed
    if (prevTenantId === tenantId) {
      return;
    }

    // Different project - update tenantId and rehydrate
    prevTenantIdRef.current = tenantId;
    updateLanguageViewTenantId(tenantId);

    // Reset page number when switching projects
    setQueryParams((prev) => ({
      ...prev,
      pageNumber: 0,
    }));
  }, [tenantId, setQueryParams]);

  const deleteLanguageKeyModalData = {
    dialogTitle: t("LANGUAGE_TABLE.DELETE_KEY_TITLE"),
    dialogSubtitle: t("LANGUAGE_TABLE.DELETE_KEY_SUBTITLE"),
    confirmButton: t(COMMON_DELETE),
    cancelButton: t(COMMON_CANCEL),
  };

  const publishChangesModalData = {
    dialogTitle: t("LANGUAGE_TABLE.PUBLISH_TITLE"),
    dialogSubtitle: t("LANGUAGE_TABLE.PUBLISH_SUBTITLE"),
    confirmButton: t("LANGUAGE_TABLE.PUBLISH"),
    cancelButton: t(COMMON_CANCEL),
  };

  const translateKeyModalData = {
    dialogTitle: t("LANGUAGE_TABLE.TRANSLATE_KEY_TITLE"),
    dialogSubtitle: t("LANGUAGE_TABLE.TRANSLATE_KEY_SUBTITLE"),
    confirmButton: t(LANGUAGE_TABLE_TRANSLATE),
    cancelButton: t(COMMON_CANCEL),
  };

  const onDeleteClick = (itemId: string) => {
    setIsDeleteDialogOpen(true);
    setSelectedLanguageKeyId(itemId);
  };

  const onPublishChangesClick = () => {
    setIsPublishChangesDialogOpen(true);
  };

  const onTranslateClick = (itemId: string) => {
    setIsTranslateDialogOpen(true);
    setSelectedLanguageKeyId(itemId);
  };

  const onConfirmTranslate = async () => {
    if (!tenantId || !selectedLanguageKeyId) return;

    const payload = {
      keyId: selectedLanguageKeyId,
      messageCoRelationId: shortGuidGenerator(8),
      defaultLanguage: defaultLanguageCode,
    };

    await runKeyAction({
      request: () => translateKeyAsync(payload),
      success: {
        title: t("LANGUAGE_TABLE.PROCESSING_TRANSLATION"),
        description: t("LANGUAGE_TABLE.TRANSLATION_IN_PROGRESS"),
      },
      onSuccess: () => {
        setPollingKeyId(selectedLanguageKeyId);
        setTranslatingKeys((prev) => new Set(prev).add(selectedLanguageKeyId));
        setIsTranslateDialogOpen(false);
      },
      describeErrors: stringifyError,
      describeException: stringifyError,
    });
  };

  const onConfirmDelete = async () => {
    if (!tenantId || !selectedLanguageKeyId) {
      showErrorToast(t("LANGUAGE_TABLE.MISSING_IDENTIFIER"));
      return;
    }
    await runKeyAction({
      request: () => deleteAsync({ itemId: selectedLanguageKeyId }),
      success: {
        title: t(COMMON_SUCCESS),
        description: t("LANGUAGE_TABLE.DELETED_SUCCESSFULLY"),
      },
      onSuccess: () => setIsDeleteDialogOpen(false),
      describeErrors: getDeleteKeyErrorMessage,
      describeException: (error) =>
        error instanceof Error ? error.message : t("LANGUAGE_TABLE.UNEXPECTED_ERROR"),
    });
  };

  useEffect(() => {
    if (!languageListData?.length || !isHydrated) return;

    const current = selectedLanguagesRef.current;
    const availableLanguageCodes = languageListData.map((lang) => lang.languageCode);
    const validSelectedLanguages = current.filter((langCode) =>
      availableLanguageCodes.includes(langCode),
    );

    if (
      (!hasStoredViewSettings && current.length === 0) ||
      validSelectedLanguages.length !== current.length
    ) {
      const defaultLanguages = languageListData
        .filter((lang) => lang.isDefault)
        .map((lang) => lang.languageCode);
      setSelectedLanguages(defaultLanguages.length > 0 ? defaultLanguages : availableLanguageCodes);
    }
  }, [languageListData, setSelectedLanguages, tenantId, isHydrated, hasStoredViewSettings]);

  const handleRowClick = useCallback(
    (keyId: number | string) => {
      navigate(scoped(`services/language/translations/${keyId}`), {
        state: { returnSearch: globalThis.location.search },
      });
    },
    [navigate, scoped],
  );

  const onPageChangeHandler = (pageNumber: number) => {
    setRowSelection({});
    setQueryParams((prev) => ({
      ...prev,
      pageNumber,
    }));
  };

  const onPageSizeChangeHandler = (pageSize: number) => {
    setRowSelection({});
    setQueryParams((prev) => ({
      ...prev,
      pageSize: toKeyPageSize(pageSize, stableTotalCount),
      pageNumber: 0,
    }));
  };

  const areTableFiltersDisabled = !isLoading && !hasActiveFilters && currentTotalCount === 0;
  const areLanguageKeyActionsDisabled = isLoading || areTableFiltersDisabled;
  const previousTotalCountRef = useRef(currentTotalCount);
  if (!isLoading) previousTotalCountRef.current = currentTotalCount;
  const stableTotalCount = isLoading ? previousTotalCountRef.current : currentTotalCount;
  const pageSizeOptions = useMemo(() => getPageSizeOptions(stableTotalCount), [stableTotalCount]);

  const handleToggleExpanded = useCallback((itemId: string) => {
    setExpandedRowId((current) => (current === itemId ? null : itemId));
  }, []);

  const columns = useLanguageTableColumns({
    expandedRowId,
    languageListData,
    languageModules,
    isLanguageModulesPending: isLanguageModulesLoading || isSyncingModules,
    onSortChange: handleSortChange,
    onToggleExpanded: handleToggleExpanded,
    selectedLanguages,
    selectedOptionalColumns,
    sortQueryParams,
    translatingKeys,
    selectAllLabel: getSelectAllLabel(isAllView, allViewKeys.length),
  });

  const tableData = useMemo(() => {
    if (isAllView) return allViewKeys;
    return blocksLanguageKeyData?.keys || [];
  }, [isAllView, allViewKeys, blocksLanguageKeyData]);

  const { expectedRowCount, skeletonRowCount } = getRowCountTargets(
    isAllView,
    stableTotalCount,
    queryParams.pageNumber ?? 0,
    pagedPageSize,
  );
  const isFetchingNewPage = isFetching && isPlaceholderData;
  const showLoadingSkeleton =
    isLoading || (isFetchingNewPage && tableData.length !== expectedRowCount);
  const tableViewportMinHeight =
    80 + Math.min(pagedPageSize, MAX_SKELETON_ROWS) * TABLE_ROW_HEIGHT_ESTIMATE;
  const tableViewportRef = useRef<HTMLDivElement>(null);
  const [tableViewportWidth, setTableViewportWidth] = useState(0);

  useEffect(() => {
    const element = tableViewportRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setTableViewportWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: tableData,
    columns,
    getRowId: (row) => row.itemId,
    getCoreRowModel: getCoreRowModel(),
    state: {
      rowSelection: rowSelectionState,
    },
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
  });

  const stretchedColumnWidths = getStretchedColumnWidths(
    table.getVisibleLeafColumns().map((column) => column.id),
    tableViewportWidth,
    globalThis.window?.innerWidth ?? 0,
  );

  const tableRows = table.getRowModel().rows;
  const queryClient = useQueryClient();
  const tableHeaderRef = useRef<HTMLTableSectionElement>(null);
  const { fetchNextPage } = allViewQuery;
  const loadNextAllViewChunk = useCallback(() => void fetchNextPage(), [fetchNextPage]);

  const resetAllView = useCallback(() => {
    void queryClient.resetQueries({ queryKey: localizationQueryKeys.languageKeys.infinitePrefix });
    if (tableViewportRef.current) tableViewportRef.current.scrollTop = 0;
  }, [queryClient]);

  const allViewFiltersHash = JSON.stringify([
    queryParams.search,
    queryParams.moduleIds,
    queryParams.missingLanguages,
    createDateRange,
    lastUpdateDateRange,
    resourceSearchFilters,
    sortQueryParams,
  ]);
  const cursorResetDoneRef = useRef(false);
  useEffect(() => {
    cursorResetDoneRef.current = false;
    if (isAllView && tableViewportRef.current) tableViewportRef.current.scrollTop = 0;
  }, [isAllView, allViewFiltersHash]);

  // A new filter or leaving the All view is a different list; select-all doesn't carry over to it.
  useEffect(() => {
    isSelectingAllLoadedRef.current = false;
  }, [isAllView, allViewFiltersHash]);

  useEffect(() => {
    if (!isSelectingAllLoadedRef.current) return;
    const loadedKeyIds = allViewKeys.map((key) => key.itemId);
    setRowSelectionState((current) => withRowsSelected(current, loadedKeyIds));
  }, [allViewKeys]);

  const allViewErrorCode = getKeyListErrorCode(allViewQuery.error);
  useEffect(() => {
    if (!isAllView || !allViewErrorCode || !CURSOR_RESET_ERROR_CODES.has(allViewErrorCode)) return;
    if (cursorResetDoneRef.current) return;
    cursorResetDoneRef.current = true;
    resetAllView();
  }, [isAllView, allViewErrorCode, resetAllView]);

  useEffect(() => {
    const rawPageSize = new URLSearchParams(globalThis.location?.search ?? "").get("pageSize");
    if (rawPageSize !== null && rawPageSize !== String(queryParams.pageSize)) {
      void setQueryParams((prev) => ({ ...prev, pageSize: prev.pageSize }));
    }
  }, [queryParams.pageSize, setQueryParams]);

  const selectedKeys = table.getSelectedRowModel().rows.map((row) => row.original.itemId);
  const selectedKeyRows = table.getSelectedRowModel().rows.map((row) => row.original);

  const bulkDeleteModalData = {
    dialogTitle: t("LANGUAGE_TABLE.BULK_DELETE_TITLE"),
    dialogSubtitle: t("LANGUAGE_TABLE.BULK_DELETE_SUBTITLE", { count: selectedKeys.length }),
    confirmButton: t(COMMON_DELETE),
    cancelButton: t(COMMON_CANCEL),
  };

  const bulkTranslateModalData = {
    dialogTitle: t("LANGUAGE_TABLE.BULK_TRANSLATE_TITLE"),
    dialogSubtitle: t("LANGUAGE_TABLE.BULK_TRANSLATE_SUBTITLE", { count: selectedKeys.length }),
    confirmButton: t(LANGUAGE_TABLE_TRANSLATE),
    cancelButton: t(COMMON_CANCEL),
  };

  const onConfirmBulkDelete = async () => {
    if (!tenantId || selectedKeys.length === 0) return;

    await runKeyAction({
      request: () => bulkDeleteAsync({ itemIds: selectedKeys }),
      success: {
        title: t(COMMON_SUCCESS),
        description: t("LANGUAGE_TABLE.KEYS_DELETED_SUCCESSFULLY"),
      },
      onSuccess: () => {
        setIsBulkDeleteDialogOpen(false);
        setRowSelection({});
      },
      describeErrors: getDeleteKeysErrorMessage,
      describeException: getDeleteKeysErrorMessage,
    });
  };

  const clearTranslatingKeys = (keyIds: Set<string>) => {
    setTranslatingKeys((prev) => removeKeysFromSet(prev, keyIds));
  };

  const onConfirmBulkTranslate = async () => {
    if (!tenantId || selectedKeys.length === 0) return;

    const payload = {
      keyIds: selectedKeys,
      ProjectKey: tenantId,
      messageCoRelationId: shortGuidGenerator(8),
      defaultLanguage: defaultLanguageCode,
    };

    await runKeyAction({
      request: () => bulkTranslateAsync(payload),
      success: {
        title: t("LANGUAGE_TABLE.PROCESSING_TRANSLATION"),
        description: t("LANGUAGE_TABLE.BULK_TRANSLATION_IN_PROGRESS"),
      },
      onSuccess: () => {
        const keysToTranslate = new Set(selectedKeys);
        setTranslatingKeys((prev) => addKeysToSet(prev, selectedKeys));
        setIsBulkTranslateDialogOpen(false);
        setRowSelection({});

        setTimeout(() => clearTranslatingKeys(keysToTranslate), 60000);
      },
      describeErrors: stringifyError,
      describeException: stringifyError,
    });
  };

  const handleExportClick = () => {
    setIsExportDialogOpen(true);
  };

  const handleImportClick = () => {
    setIsImportDialogOpen(true);
  };

  const toggleLanguage = (language: string) => {
    toggleLanguageInStore(language);
  };

  const handleAutoTranslateClick = () => {
    setIsAutoTranslateDialogOpen(true);
  };

  useEffect(() => {
    if (tabId === "history") {
      setQueryParams(null);
      sortReset();
    }
  }, [tabId, setQueryParams, sortReset]);

  const selectAll = () => {
    setSelectedLanguages(
      selectedLanguages.length === languageListData?.length
        ? languageListData.filter((lang) => lang.isDefault).map((lang) => lang.languageCode)
        : languageListData?.map((lang) => lang.languageCode) || [],
    );
  };

  async function generateUilmFiles() {
    await runKeyAction({
      request: () => mutateAsync({ guid: uuidv4() }),
      success: {
        title: t(COMMON_SUCCESS),
        description: t("LANGUAGE_TABLE.FILE_GENERATION_IN_PROGRESS"),
      },
      onSuccess: () => setIsPublishChangesDialogOpen(false),
      describeErrors: stringifyError,
      describeException: stringifyError,
    });
  }

  // Placeholder rows with stable keys, so a loading table doesn't remount them every render.
  const renderSkeletonRows = () =>
    SKELETON_ROW_IDS.slice(0, skeletonRowCount).map((skeletonRowId) => (
      <TableRow key={skeletonRowId} className="group h-9 md:h-11">
        {table.getVisibleLeafColumns().map((column) => (
          <TableCell key={column.id} className={getStickyBodyCellClassName(column.id)}>
            <Skeleton className={getTableSkeletonClassName(column.id)} />
          </TableCell>
        ))}
        <TableCell aria-hidden="true" className="p-0" />
      </TableRow>
    ));

  const tableColSpan = table.getVisibleLeafColumns().length + 1;
  // Column header row(s) plus the per-column search row.
  const headerRowCount = table.getHeaderGroups().length + 1;
  const layout = getKeyTableLayout({
    isAllView,
    minHeight: tableViewportMinHeight,
    allViewRowCount: allViewTotalCount + headerRowCount,
    pageNumber: queryParams.pageNumber,
    pagedPageSize,
    totalCount: stableTotalCount,
  });

  // A key's row plus its inline details when expanded; shared by the paged table and the All view.
  const renderKeyRow = (row: Row<IBlocksLanguageKey>, ariaRowIndex?: number) => {
    const isRowExpanded = expandedRowId === row.original.itemId;
    return (
      <>
        <TableRow
          isHoverable
          className="group font-normal text-medium-emphasis"
          data-state={row.getIsSelected() && "selected"}
          aria-rowindex={ariaRowIndex}
          onClick={() => handleRowClick(row.original.itemId)}
        >
          {row.getVisibleCells().map((cell) => (
            <TableCell key={cell.id} className={getStickyBodyCellClassName(cell.column.id)}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          ))}
          <TableCell aria-hidden="true" className="p-0" />
        </TableRow>
        {isRowExpanded && (
          <TableRow className="border-none bg-blocks-primary-shades-300 hover:bg-blocks-primary-shades-300">
            <TableCell colSpan={tableColSpan} className="p-0">
              <InlineKeyDetails
                key={`${row.original.itemId}-${row.original.lastUpdateDate}-${languageListData?.map((language) => language.languageCode).join(",")}`}
                keyDetails={row.original}
                languageListData={languageListData ?? []}
                languageModules={languageModules ?? []}
                onDelete={() => onDeleteClick(row.original.itemId)}
                onTranslate={() => onTranslateClick(row.original.itemId)}
              />
            </TableCell>
          </TableRow>
        )}
      </>
    );
  };

  return (
    <main className="flex flex-col">
      <div className="flex w-full flex-col">
        <div className="flex w-full justify-between text-high-emphasis">
          <div className="item-center flex gap-2">
            <h3 className="text-2xl font-bold tracking-tight">
              {t("LANGUAGE_TABLE.CONFIGURE_KEYS")}
            </h3>
          </div>
        </div>
        <Tabs value={tabId} className="mt-[18px] flex w-full flex-col md:mt-[24px]">
          <div className="mb-5 flex flex-col gap-3 text-base sm:flex-row sm:items-center">
            <TabsList className="grid h-auto w-full grid-cols-2 bg-blocks-primary-shades-300 p-1 sm:flex sm:h-[42px] sm:w-auto">
              <TabsTrigger
                onClick={() => setTabId("keys")}
                value="keys"
                className="h-8 whitespace-nowrap"
              >
                {t("LANGUAGE_TABLE.TAB_TRANSLATION_KEYS")}
              </TabsTrigger>
              <TabsTrigger
                onClick={() => setTabId("history")}
                value="history"
                className="h-8 whitespace-nowrap"
              >
                {t("LANGUAGE_TABLE.TAB_HISTORY")}
              </TabsTrigger>
            </TabsList>
            {tabId === "keys" ? (
              <div className="grid w-full grid-cols-3 gap-2 sm:ml-auto sm:flex sm:w-auto sm:items-center">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      onClick={(e) => e.stopPropagation()}
                      variant="outline"
                      className="h-10 w-full p-0 sm:w-10"
                    >
                      <EllipsisVertical width={20} height={20} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={(e) => {
                        e.preventDefault();
                        handleImportClick();
                      }}
                    >
                      <FolderInput className="mr-2 h-4 w-4" />
                      <span>{t("LANGUAGE_TABLE.IMPORT_KEYS")}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={(e) => {
                        e.preventDefault();
                        handleExportClick();
                      }}
                    >
                      <FolderOutput className="mr-2 h-4 w-4" />
                      <span>{t("LANGUAGE_TABLE.EXPORT_KEYS")}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={() => navigate(scoped("services/language/export-history"))}
                    >
                      <History className="mr-2 h-4 w-4" />
                      <span>{t("LANGUAGE_TABLE.EXPORT_HISTORY")}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                  {isImportDialogOpen && (
                    <ImportFileModal
                      dialogTitle={t("LANGUAGE_TABLE.IMPORT_KEYS_TITLE")}
                      data={[]}
                      projectKey={tenantId}
                      onClose={() => setIsImportDialogOpen(false)}
                      onImportStarted={onImportStarted}
                      onImportRequestFailed={onImportRequestFailed}
                    />
                  )}
                </Dialog>
                <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                  <ExportKey
                    open={isExportDialogOpen}
                    onClose={() => setIsExportDialogOpen(false)}
                  />
                </Dialog>
                <Button
                  onClick={onPublishChangesClick}
                  size="default"
                  variant="outline"
                  className="w-full shadow-none sm:w-auto"
                  disabled={areLanguageKeyActionsDisabled}
                >
                  <Rocket className="h-5 w-5 lg:mr-2" />
                  <span className="sr-only lg:not-sr-only">
                    {t("LANGUAGE_TABLE.PUBLISH_CHANGES")}
                  </span>
                </Button>
                <Button
                  size="default"
                  variant="default"
                  className="w-full bg-primary text-primary-foreground shadow-none sm:w-auto"
                  onClick={() => navigate(scoped("services/language/translations/new-key"))}
                >
                  <Plus className="h-5 w-5 lg:mr-2" />
                  <span className="sr-only lg:not-sr-only">{t("LANGUAGE_TABLE.NEW_KEY")}</span>
                </Button>
              </div>
            ) : (
              <div className="ml-auto flex items-center gap-2"></div>
            )}
          </div>
          <TabsContent value="keys">
            <Card className="rounded shadow-none">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xl text-high-emphasis">
                    {t("LANGUAGE_TABLE.TRANSLATIONS")}
                  </CardTitle>
                  {!isLoading && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger
                          type="button"
                          className="inline-flex cursor-default rounded-full"
                          aria-label={t("LANGUAGE_TABLE.TOTAL_KEYS_ARIA", {
                            count: stableTotalCount,
                            formatted: stableTotalCount.toLocaleString(),
                          })}
                        >
                          <Badge
                            variant="outline"
                            className="rounded-full border-transparent bg-secondary text-secondary-foreground"
                          >
                            {t("LANGUAGE_TABLE.KEYS_COUNT", {
                              count: stableTotalCount,
                              formatted: stableTotalCount.toLocaleString(),
                            })}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>{t("LANGUAGE_TABLE.TOTAL_KEYS")}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <DuplicateKeysChips />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="default"
                    variant="default"
                    onClick={handleAutoTranslateClick}
                    disabled={areLanguageKeyActionsDisabled}
                  >
                    <Wand className="h-5 w-5 lg:mr-2" />
                    <span className="sr-only lg:not-sr-only">
                      {t("LANGUAGE_TABLE.AUTO_TRANSLATE_ALL")}
                    </span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        <Settings2 className="h-4 w-4 lg:mr-2" />
                        <span className="sr-only lg:not-sr-only">{t("common:VIEW")}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="terms"
                            checked={selectedLanguages.length === languageListData?.length}
                            onCheckedChange={selectAll}
                          />
                          <label htmlFor="terms">{t("LANGUAGE_TABLE.LANGUAGES")}</label>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuSeparator />
                      {languageListData?.map((language) => (
                        <DropdownMenuCheckboxItem
                          key={language.languageCode}
                          checked={selectedLanguages.includes(language.languageCode)}
                          onCheckedChange={() => toggleLanguage(language.languageCode)}
                        >
                          {language.languageName}
                        </DropdownMenuCheckboxItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={selectedOptionalColumns.includes("completeness")}
                        onCheckedChange={() => toggleOptionalColumn("completeness")}
                      >
                        {t("LANGUAGE_TABLE.COMPLETENESS")}
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={selectedOptionalColumns.includes("createDate")}
                        onCheckedChange={() => toggleOptionalColumn("createDate")}
                      >
                        {t("LANGUAGE_TABLE.CREATED_DATE")}
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={selectedOptionalColumns.includes("lastUpdateDate")}
                        onCheckedChange={() => toggleOptionalColumn("lastUpdateDate")}
                      >
                        {t("LANGUAGE_TABLE.LAST_UPDATED_DATE")}
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              {selectedKeys.length > 0 && (
                <div className="mb-4 flex items-center justify-between rounded bg-blocks-primary-shades-300 px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 shrink-0"
                      aria-label={t("LANGUAGE_TABLE.CLEAR_SELECTION")}
                      title={t("LANGUAGE_TABLE.CLEAR_SELECTION")}
                      onClick={() => setRowSelection({})}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">
                      {getSelectedKeysLabel(
                        selectedKeys.length,
                        isAllView ? allViewTotalCount : undefined,
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => setIsBulkEditDialogOpen(true)}
                    >
                      <PencilLine className="h-4 w-4 lg:mr-1" />
                      <span className="sr-only lg:not-sr-only">
                        {t("LANGUAGE_TABLE.BULK_EDIT")}
                      </span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsBulkTranslateDialogOpen(true)}
                      className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      <Languages className="lg:mr-1 h-4 w-4" />
                      <span className="sr-only lg:not-sr-only">
                        {t(LANGUAGE_TABLE_TRANSLATE)}
                      </span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsBulkDeleteDialogOpen(true)}
                      className="border-error text-error hover:bg-error hover:text-primary-foreground"
                    >
                      <Trash className="lg:mr-1 h-4 w-4" />
                      <span className="sr-only lg:not-sr-only">{t(COMMON_DELETE)}</span>
                    </Button>
                  </div>
                </div>
              )}
              <div className="mb-4">
                {isLanguageModulesLoading ? (
                  <div className="flex flex-wrap items-center gap-4">
                    <Skeleton className="h-8 w-[150px] rounded border-dashed" />
                    <Skeleton className="h-8 w-[180px] rounded border-dashed" />
                    <Skeleton className="h-8 w-[140px] rounded border-dashed" />
                    <Skeleton className="h-8 w-[160px] rounded border-dashed" />
                  </div>
                ) : (
                  <LanguageTableToolbar
                    languageModulesData={languageModules || []}
                    languagesData={languageListData || []}
                    disabled={areTableFiltersDisabled}
                  />
                )}
              </div>
              <CardContent>
                {showDuplicatesTruncatedNote && (
                  <p
                    className="mb-2 text-sm text-medium-emphasis"
                    data-testid="duplicates-truncated-note"
                  >
                    {t("LANGUAGE_TABLE.DUPLICATES_TRUNCATED")}
                  </p>
                )}
                <div
                  className={layout.viewportClassName}
                  style={layout.viewportStyle}
                  data-testid="language-table-viewport"
                  ref={tableViewportRef}
                >
                  <Table className="table-fixed text-sm" aria-rowcount={layout.ariaRowCount}>
                    <colgroup>
                      {table.getVisibleLeafColumns().map((column) => (
                        <col
                          key={column.id}
                          className={getTableColumnClassName(column.id)}
                          style={
                            stretchedColumnWidths[column.id]
                              ? { width: `${stretchedColumnWidths[column.id]}px` }
                              : undefined
                          }
                        />
                      ))}
                      <col />
                    </colgroup>
                    <TableHeader ref={tableHeaderRef} className={layout.headerClassName}>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} className="border-none hover:bg-transparent">
                          {headerGroup.headers.map((header) => (
                            <TableHead
                              key={header.id}
                              className={`h-0 align-top font-bold text-medium-emphasis ${getStickyHeaderClassName(header.column.id)}`}
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </TableHead>
                          ))}
                          <TableHead aria-hidden="true" className="h-0 p-0" />
                        </TableRow>
                      ))}

                      <TableRow className="hover:bg-transparent">
                        {table.getAllColumns().map((column) => {
                          if (column.id === "keyName") {
                            return (
                              <TableHead
                                key={column.id}
                                className="py-1 font-bold text-medium-emphasis"
                              >
                                <div className="w-[300px] md:w-[200px]">
                                  <FilterControls.SearchInput
                                    value={keySearch}
                                    onChange={updateKeySearch}
                                    placeholder={t("LANGUAGE_TABLE.SEARCH_PLACEHOLDER")}
                                    className="h-7 w-full text-xs"
                                    disabled={areTableFiltersDisabled}
                                  />
                                </div>
                              </TableHead>
                            );
                          }

                          if (column.id.includes("resources_")) {
                            const lang = column.id.replace("resources_", "");
                            return (
                              <TableHead
                                key={column.id}
                                className="py-1 font-bold text-medium-emphasis"
                              >
                                <div className="w-[300px] md:w-[200px]">
                                  <FilterControls.SearchInput
                                    value={resourceSearchMap[lang] ?? ""}
                                    onChange={(value) => updateResourceSearch(lang, value)}
                                    placeholder={t("LANGUAGE_TABLE.SEARCH_PLACEHOLDER")}
                                    className="h-7 w-full text-xs"
                                    disabled={areTableFiltersDisabled}
                                  />
                                </div>
                              </TableHead>
                            );
                          }
                          return (
                            <TableHead
                              key={column.id}
                              className={getStickyHeaderClassName(column.id)}
                            />
                          );
                        })}
                        <TableHead aria-hidden="true" className="p-0" />
                      </TableRow>
                    </TableHeader>
                    {isAllView && !showLoadingSkeleton && tableRows.length > 0 ? (
                      <Suspense fallback={<TableBody>{renderSkeletonRows()}</TableBody>}>
                        <VirtualKeyRows
                          rows={tableRows}
                          scrollElementRef={tableViewportRef}
                          headerRef={tableHeaderRef}
                          headerRowCount={headerRowCount}
                          colSpan={tableColSpan}
                          renderKeyRow={renderKeyRow}
                          headCursor={allViewQuery.data?.pageParams[0]}
                          hasNextPage={allViewQuery.hasNextPage}
                          isFetchingNextPage={allViewQuery.isFetchingNextPage}
                          isFetchNextPageError={allViewQuery.isFetchNextPageError}
                          onLoadMore={loadNextAllViewChunk}
                          onBackToTop={resetAllView}
                          loadError={<AllViewLoadError onRetry={loadNextAllViewChunk} />}
                        />
                      </Suspense>
                    ) : (
                      <TableBody>
                        {showLoadingSkeleton
                          ? renderSkeletonRows()
                          : (() => {
                              return tableRows?.length ? (
                                tableRows.map((row) => (
                                  <Fragment key={row.id}>{renderKeyRow(row)}</Fragment>
                                ))
                              ) : (
                                <TableRow>
                                  <TableCell
                                    colSpan={table.getVisibleLeafColumns().length + 1}
                                    className="h-24 text-center"
                                  >
                                    {isAllView && allViewQuery.isError ? (
                                      <AllViewLoadError
                                        onRetry={() => void allViewQuery.refetch()}
                                      />
                                    ) : (
                                      <LanguageTableEmptyState
                                        hasActiveFilters={hasActiveFilters}
                                        importProgress={importProgress}
                                      />
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })()}
                      </TableBody>
                    )}
                  </Table>
                </div>
              </CardContent>
              {stableTotalCount > 0 && (
                <div
                  className={`mt-5 flex min-h-10 items-center md:justify-end ${showLoadingSkeleton ? "invisible pointer-events-none" : ""}`}
                  aria-hidden={showLoadingSkeleton || undefined}
                >
                  <Pagination
                    page={layout.paginationPage}
                    pageSize={layout.paginationPageSize}
                    totalCount={stableTotalCount}
                    pageSizeOptions={pageSizeOptions}
                    onChange={onPageChangeHandler}
                    onPageSizeChange={onPageSizeChangeHandler}
                    mode={layout.paginationMode}
                    loadedCount={tableData.length}
                  />
                </div>
              )}
            </Card>
            <Dialog open={isAutoTranslateDialogOpen} onOpenChange={setIsAutoTranslateDialogOpen}>
              <AutoTranslate />
            </Dialog>
          </TabsContent>
          <TabsContent value="history">
            <LocalizationTimeline />
          </TabsContent>
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <ConfirmationModal
              onCancel={() => {}}
              onConfirm={onConfirmDelete}
              data={deleteLanguageKeyModalData}
              buttonState={{ confirm: { disable: isDeleteLanguageKeyPending } }}
            />
          </Dialog>
          <Dialog open={isPublishChangesDialogOpen} onOpenChange={setIsPublishChangesDialogOpen}>
            <ConfirmationModal
              onCancel={() => {}}
              onConfirm={generateUilmFiles}
              data={publishChangesModalData}
              buttonState={{ confirm: { disable: isPending } }}
            />
          </Dialog>
          <Dialog open={isTranslateDialogOpen} onOpenChange={setIsTranslateDialogOpen}>
            <ConfirmationModal
              onCancel={() => {}}
              onConfirm={onConfirmTranslate}
              data={translateKeyModalData}
              buttonState={{ confirm: { disable: isTranslatingKey } }}
            />
          </Dialog>
          <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
            <ConfirmationModal
              onCancel={() => {}}
              onConfirm={onConfirmBulkDelete}
              data={bulkDeleteModalData}
              buttonState={{ confirm: { disable: isBulkDeletingKeys } }}
            />
          </Dialog>
          <Dialog open={isBulkTranslateDialogOpen} onOpenChange={setIsBulkTranslateDialogOpen}>
            <ConfirmationModal
              onCancel={() => {}}
              onConfirm={onConfirmBulkTranslate}
              data={bulkTranslateModalData}
              buttonState={{ confirm: { disable: isBulkTranslatingKeys } }}
            />
          </Dialog>
          <Dialog open={isBulkEditDialogOpen} onOpenChange={setIsBulkEditDialogOpen}>
            {isBulkEditDialogOpen && (
              <BulkEditKeysDialog
                keys={selectedKeyRows}
                languages={languageListData ?? []}
                onCancel={() => setIsBulkEditDialogOpen(false)}
                onSaved={() => {
                  setIsBulkEditDialogOpen(false);
                  setRowSelection({});
                }}
              />
            )}
          </Dialog>
        </Tabs>
      </div>
    </main>
  );
}
