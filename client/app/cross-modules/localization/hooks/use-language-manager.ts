import { useProjectStore } from "@seliseblocks/genesis-os";
import { localizationQueryKeys } from "../constants/query-keys";
import {
  ExportHistoryFilters,
  GLOSSARY_STATUSES,
  IBlocksLanguageKeyResponse,
  IDeleteModuleRequest,
  IGlossary,
  IGlossaryFilters,
  ILanguageConfig,
  IKeyUilmExport,
} from "@blocks-localization/models/language";
import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import { useEffect, useEffectEvent } from "react";
import {
  keepPreviousData,
  noop,
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import {
  allViewRefreshAfterSave,
  refreshLanguageKeyLists,
  removeLanguageKeyRows,
  replaceLanguageKeyRows,
} from "./language-key-list-cache";

/** Paged lists stay fresh this long; mutations still invalidate them immediately. */
export const LANGUAGE_KEY_PAGE_STALE_TIME = 30_000;
/** Rows per chunk in the All view. */
export const LANGUAGE_KEY_CHUNK_SIZE = 100;
/** Chunks the All view keeps in memory (5,000 rows); older ones are evicted. */
export const MAX_LOADED_LANGUAGE_KEY_CHUNKS = 50;

export const useGetBlocksLanguageKey = (
  pageNumber: number,
  pageSize: number,
  searchKey: string,
  moduleIds: string[],
  isPartiallyTranslated: boolean,
  sortProperty = "",
  isDescending = false,
  createDateRange?: { startDate: string; endDate: string },
  lastUpdateDateRange?: { startDate: string; endDate: string },
  resourceSearchFilters?: { culture: string; searchText: string }[],
  missingLanguages?: string[],
  enabled = true,
  onlyDuplicates = false,
  hasGlossaryViolations = false,
) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const queryClient = useQueryClient();
  const pageQuery = (page: number) => ({
    queryKey: localizationQueryKeys.languageKeys.list(
      tenantId,
      page,
      pageSize,
      searchKey,
      moduleIds,
      isPartiallyTranslated,
      sortProperty,
      isDescending,
      createDateRange?.startDate ?? "",
      createDateRange?.endDate ?? "",
      lastUpdateDateRange?.startDate ?? "",
      lastUpdateDateRange?.endDate ?? "",
      resourceSearchFilters ?? [],
      missingLanguages ?? [],
      onlyDuplicates,
      hasGlossaryViolations,
    ),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      languageManagerService.fetchBlocksLanguageKey(
        {
          pageNumber: page,
          pageSize: pageSize,
          searchKey: searchKey,
          moduleIds: moduleIds,
          isPartiallyTranslated: isPartiallyTranslated,
          sortProperty: sortProperty,
          isDescending: isDescending,
          createDateRange: createDateRange,
          lastUpdateDateRange: lastUpdateDateRange,
          resourceSearchFilters: resourceSearchFilters,
          missingLanguages: missingLanguages,
          ...(onlyDuplicates ? { onlyDuplicates: true } : {}),
          ...(hasGlossaryViolations ? { hasGlossaryViolations: true } : {}),
        },
        { signal },
      ),
    staleTime: LANGUAGE_KEY_PAGE_STALE_TIME,
  });

  const query = useQuery({
    ...pageQuery(pageNumber),
    placeholderData: keepPreviousData,
    refetchOnMount: true,
    enabled,
  });

  // Prefetch the next page once this one has settled, so paging forward renders from cache.
  const isSettled = query.isSuccess && !query.isPlaceholderData && !query.isFetching;
  const hasNextPage = (pageNumber + 1) * pageSize < (query.data?.totalCount ?? 0);
  const nextPage = enabled && isSettled && hasNextPage ? pageQuery(pageNumber + 1) : null;
  const nextPageHash = nextPage ? JSON.stringify(nextPage.queryKey) : "";
  const prefetchNextPage = useEffectEvent(() => {
    // A failed prefetch is not surfaced; the page fetches again when the user opens it.
    if (nextPage) void queryClient.query(nextPage).catch(noop);
  });

  useEffect(() => {
    if (nextPageHash) prefetchNextPage();
  }, [nextPageHash]);

  return query;
};

/** Filters of the All view, plus whether it is the active view. */
export interface LanguageKeysInfiniteOptions {
  searchKey: string;
  moduleIds: string[];
  sortProperty: string;
  isDescending: boolean;
  createDateRange?: { startDate: string; endDate: string };
  lastUpdateDateRange?: { startDate: string; endDate: string };
  resourceSearchFilters?: { culture: string; searchText: string }[];
  missingLanguages?: string[];
  enabled?: boolean;
  onlyDuplicates?: boolean;
  /** Only keys with stored glossary violations ("Glossary issues"). */
  hasGlossaryViolations?: boolean;
}

/**
 * The All view: keys in chunks of {@link LANGUAGE_KEY_CHUNK_SIZE} through the keyset cursor, at most
 * {@link MAX_LOADED_LANGUAGE_KEY_CHUNKS} chunks in memory. Only the first chunk asks for the total;
 * later chunks carry it forward so it survives the first chunk being evicted.
 *
 * The duplicates filter's order is not a keyset, so the server refuses a cursor there; that list
 * (capped server-side) is chunked by page number instead, and the total decides when it ends.
 */
export const useGetBlocksLanguageKeysInfinite = ({
  searchKey,
  moduleIds,
  sortProperty,
  isDescending,
  createDateRange,
  lastUpdateDateRange,
  resourceSearchFilters,
  missingLanguages,
  enabled = true,
  onlyDuplicates = false,
  hasGlossaryViolations = false,
}: LanguageKeysInfiniteOptions) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const queryClient = useQueryClient();
  const queryKey = localizationQueryKeys.languageKeys.infinite(tenantId, {
    searchKey,
    moduleIds,
    sortProperty,
    isDescending,
    createStartDate: createDateRange?.startDate ?? "",
    createEndDate: createDateRange?.endDate ?? "",
    lastUpdateStartDate: lastUpdateDateRange?.startDate ?? "",
    lastUpdateEndDate: lastUpdateDateRange?.endDate ?? "",
    resourceSearchFilters: resourceSearchFilters ?? [],
    missingLanguages: missingLanguages ?? [],
    onlyDuplicates,
    hasGlossaryViolations,
  });

  // null is the first chunk; after it, a keyset cursor, or a page number under the duplicates filter.
  return useInfiniteQuery<
    IBlocksLanguageKeyResponse,
    Error,
    InfiniteData<IBlocksLanguageKeyResponse, string | number | null>,
    typeof queryKey,
    string | number | null
  >({
    queryKey,
    queryFn: async ({ pageParam, signal }) => {
      const page = await languageManagerService.fetchBlocksLanguageKey(
        {
          pageNumber: typeof pageParam === "number" ? pageParam : 0,
          pageSize: LANGUAGE_KEY_CHUNK_SIZE,
          searchKey,
          moduleIds,
          isPartiallyTranslated: false,
          sortProperty,
          isDescending,
          createDateRange,
          lastUpdateDateRange,
          resourceSearchFilters,
          missingLanguages,
          ...(onlyDuplicates ? { onlyDuplicates: true } : {}),
          ...(hasGlossaryViolations ? { hasGlossaryViolations: true } : {}),
          cursor: typeof pageParam === "string" ? pageParam : undefined,
          includeTotalCount: pageParam === null,
        },
        { signal },
      );
      if (pageParam === null) return page;
      const loaded = queryClient.getQueryData<InfiniteData<IBlocksLanguageKeyResponse>>(queryKey);
      return { ...page, totalCount: loaded?.pages.at(-1)?.totalCount ?? null };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (onlyDuplicates) {
        const nextPage = (typeof lastPageParam === "number" ? lastPageParam : 0) + 1;
        return nextPage * LANGUAGE_KEY_CHUNK_SIZE < (lastPage.totalCount ?? 0)
          ? nextPage
          : undefined;
      }
      return lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined;
    },
    maxPages: MAX_LOADED_LANGUAGE_KEY_CHUNKS,
    enabled,
    // Refetching would re-request every loaded chunk; mutations patch or reset this view instead,
    // and it is dropped when the table unmounts so a return visit starts from fresh first rows.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
};

export const useGetDuplicateSummary = () => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.languageKeys.duplicateSummary(tenantId),
    queryFn: () => languageManagerService.fetchDuplicateSummary(),
    enabled: !!tenantId,
    // A failed summary only hides the chips; it is not worth retrying or surfacing.
    retry: false,
  });
};

export const useEnforceUniqueness = () => {
  const queryClient = useQueryClient();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useMutation({
    mutationKey: ["language-keys", "enforce-uniqueness"],
    mutationFn: () => languageManagerService.enforceUniqueness(),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.duplicateSummary(tenantId),
      });
    },
  });
};

export const useGetBlocksLanguageKeyById = (itemId: string) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const enabled = Boolean(tenantId && itemId);
  return useQuery({
    queryKey: localizationQueryKeys.languageKeys.detail(tenantId, itemId),
    enabled,
    queryFn: () =>
      languageManagerService.fetchBlocksLanguageKeyById({
        itemId: itemId,
      }),
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasTranslations = data?.resources?.some(
        (r) => r.culture !== "en-US" && r.value !== "" && r.value !== null,
      );
      if (hasTranslations) return false; // stop polling — translations are ready
      return 5 * 1000; // keep polling
    },
  });
};

export const useGetLanguageModules = () => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.modules.list(tenantId),
    queryFn: () => languageManagerService.fetchBlocksLanguageModules(),
    enabled: !!tenantId,
  });
};

export const useGetLanguages = () => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.languages.list(tenantId),
    queryFn: () => languageManagerService.fetchBlocksLanguages(),
    enabled: !!tenantId,
  });
};

export const useSaveBlocksLanguageKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["add-blocksLanguageKey"],
    mutationFn: languageManagerService.saveBlocksLanguageKey,
    onSuccess: (response, payload) => {
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.detailPrefix,
      });
      const { isNewKey, ...savedKey } = payload;
      refreshLanguageKeyLists(
        queryClient,
        allViewRefreshAfterSave(response, Boolean(isNewKey), [savedKey]),
      );
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.timelinePrefix,
      });
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.localizationTimelinePrefix,
      });
    },
  });
};

export const useSaveBlocksLanguageKeys = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["save-blocks-language-keys", "bulk"],
    mutationFn: languageManagerService.saveBlocksLanguageKeys,
    onSuccess: (response, payload) => {
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.detailPrefix,
      });
      const savedKeys = payload.map(({ isNewKey: _isNewKey, ...savedKey }) => savedKey);
      refreshLanguageKeyLists(
        queryClient,
        allViewRefreshAfterSave(
          response,
          payload.some((key) => key.isNewKey),
          savedKeys,
        ),
      );
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.timelinePrefix,
      });
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.localizationTimelinePrefix,
      });
    },
  });
};

export const useSaveLanguageModule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["add-language-module"],
    mutationFn: languageManagerService.saveLanguageModule,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.modules.all,
      });
    },
  });
};

export const useGetModuleKeyCount = (moduleId: string) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.languageKeys.countByModule(tenantId, moduleId),
    queryFn: () =>
      languageManagerService.fetchBlocksLanguageKey({
        pageNumber: 0,
        pageSize: 1,
        searchKey: "",
        moduleIds: [moduleId],
        isPartiallyTranslated: false,
        sortProperty: "KeyName",
        isDescending: false,
      }),
    select: (data) => data.totalCount,
    enabled: !!moduleId,
    staleTime: 0,
    refetchOnMount: "always",
  });
};

export const useDeleteLanguageModule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["language-module", "delete"],
    mutationFn: (payload: IDeleteModuleRequest) =>
      languageManagerService.deleteLanguageModule(payload),
    onSuccess: (_data, payload) => {
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.modules.all,
      });
      // Deleting a module can clear a duplicate module name, even when it has no keys.
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.duplicateSummaryPrefix,
      });
      if (payload.targetModuleId || payload.deleteKeys) {
        refreshLanguageKeyLists(queryClient, "reset");
        queryClient.invalidateQueries({
          queryKey: localizationQueryKeys.languageKeys.detailPrefix,
        });
        queryClient.invalidateQueries({
          queryKey: localizationQueryKeys.languageKeys.timelinePrefix,
        });
        queryClient.invalidateQueries({
          queryKey: localizationQueryKeys.languageKeys.localizationTimelinePrefix,
        });
      }
    },
  });
};

export const useTagGlossary = () => {
  const queryClient = useQueryClient();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useMutation({
    mutationKey: ["language-module", "tag-glossary"],
    mutationFn: (payload: Parameters<typeof languageManagerService.tagGlossary>[0]) =>
      languageManagerService.tagGlossary({
        ...payload,
        projectKey: payload.projectKey ?? tenantId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.modules.all,
      });
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.glossaries.all,
      });
      // View Details and module details read the module's glossaries from this prefix.
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.glossaries.modulePrefix,
      });
    },
  });
};

export function useGetLanguageModule(projectKey: string) {
  return useQuery({
    queryKey: localizationQueryKeys.modules.list(projectKey),
    queryFn: () => languageManagerService.fetchBlocksLanguageModules(),
    enabled: !!projectKey,
  });
}

export const useTranslateAll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["translate-all"],
    mutationFn: languageManagerService.translateAll,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.detailPrefix,
      });
      refreshLanguageKeyLists(queryClient, "keep");
    },
  });
};

export const useTranslateKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["translate-key"],
    mutationFn: languageManagerService.translateKey,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.detailPrefix,
      });
      refreshLanguageKeyLists(queryClient, "keep");
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.timelinePrefix,
      });
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.localizationTimelinePrefix,
      });
    },
  });
};

// Polls for a specific key's translation to complete, then invalidates list queries
export const useTranslateKeyWithPolling = (
  keyId: string,
  tenantId: string,
  onTranslationComplete?: () => void,
) => {
  const queryClient = useQueryClient();
  const maxAttempts = 15; // 15 * 2 seconds = 30 seconds max wait
  const pollInterval = 2000;

  useEffect(() => {
    // Early return if no keyId or tenantId - nothing to poll
    if (!keyId || !tenantId) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const pollTranslation = async () => {
      attempts++;

      try {
        const data = await languageManagerService.fetchBlocksLanguageKeyById({
          itemId: keyId,
        });

        // Check if this key has at least one non-null, non-empty translation
        const hasTranslations = data?.resources?.some(
          (r) => r.culture !== "en-US" && r.value !== null && r.value.trim() !== "",
        );

        if (hasTranslations) {
          // Translation is complete, invalidate list queries to refresh table
          refreshLanguageKeyLists(queryClient, replaceLanguageKeyRows([data]));
          queryClient.invalidateQueries({
            queryKey: localizationQueryKeys.languageKeys.detailPrefix,
          });
          onTranslationComplete?.();
          return;
        }
      } catch {
        // Continue polling even on error
      }

      // If not complete and within max attempts, poll again
      if (attempts < maxAttempts) {
        timeoutId = setTimeout(pollTranslation, pollInterval);
      }
    };

    // Start polling after a short initial delay
    timeoutId = setTimeout(pollTranslation, pollInterval);

    // Cleanup function to clear timeout if effect re-runs or component unmounts
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [keyId, tenantId, queryClient, onTranslationComplete, maxAttempts, pollInterval]);
};

export const useSaveLanguage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["add-language"],
    mutationFn: languageManagerService.saveLanguage,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languages.all,
      });
    },
  });
};

export const useDeleteLanguageKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["language-key", "delete"],
    mutationFn: (payload: { itemId: string }) => languageManagerService.deleteLanguageKey(payload),
    onSuccess: (response, payload) => {
      refreshLanguageKeyLists(
        queryClient,
        response?.isSuccess ? removeLanguageKeyRows([payload.itemId]) : "keep",
      );
    },
  });
};

export const useDeleteLanguageKeys = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["language-keys", "bulk-delete"],
    mutationFn: languageManagerService.deleteLanguageKeys,
    onSuccess: (response, payload) => {
      refreshLanguageKeyLists(
        queryClient,
        response?.isSuccess ? removeLanguageKeyRows(payload.itemIds) : "keep",
      );
    },
  });
};

export const useTranslateLanguageKeys = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["translate-keys", "bulk"],
    mutationFn: languageManagerService.translateLanguageKeys,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.detailPrefix,
      });
      refreshLanguageKeyLists(queryClient, "keep");
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.timelinePrefix,
      });
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.localizationTimelinePrefix,
      });
    },
  });
};

export const useDeleteLanguage = () => {
  const queryClient = useQueryClient();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useMutation({
    mutationKey: ["language-config", "delete"],
    mutationFn: (payload: { languageName: string }) =>
      languageManagerService.deleteLanguage(payload),
    onSuccess: (_response, variables) => {
      queryClient.setQueryData<ILanguageConfig[]>(
        localizationQueryKeys.languages.list(tenantId),
        (currentLanguages) =>
          currentLanguages?.filter(
            (language) => language.languageName !== variables.languageName,
          ) ?? currentLanguages,
      );
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languages.all,
      });
    },
  });
};

export const useSetDefaultLanguage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["language-config", "set-default"],
    mutationFn: (payload: Parameters<typeof languageManagerService.setDefault>[0]) =>
      languageManagerService.setDefault({
        ...payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languages.all,
      });
    },
  });
};

export const useGenerateUilmFile = () => {
  return useMutation({
    mutationKey: ["add-language"],
    mutationFn: languageManagerService.generateUilmFile,
    onSuccess: () => {},
  });
};

export const useGetTranslationSuggestion = () => {
  return useMutation({
    mutationKey: ["get-translation-suggestion"],
    mutationFn: languageManagerService.getTranslationSuggestion,
    onSuccess: () => {},
  });
};

export const useImportLanguageFile = () => {
  return useMutation({
    mutationKey: ["import-language-file"],
    mutationFn: languageManagerService.importLanguageFile,
    onSuccess: () => {},
  });
};

export const useSaveLanguageKeyUilmExport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["save-language-key-uilm-export"],
    mutationFn: (payload: IKeyUilmExport) =>
      languageManagerService.saveLanguageKeyUilmExport(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.exportHistory.all,
      });
    },
  });
};

export const useGetLanguageKeysTimeline = (pageNumber: number, pageSize: number, keyId: string) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const enabled = Boolean(tenantId && keyId);
  return useQuery({
    queryKey: localizationQueryKeys.languageKeys.timeline(tenantId, pageNumber, pageSize, keyId),
    enabled,
    queryFn: () =>
      languageManagerService.getKeysTimeline({
        pageNumber: pageNumber,
        pageSize: pageSize,
        keyId,
      }),
  });
};

export const useGetExportHistory = (
  pageNumber: number,
  pageSize: number,
  projectKey: string,
  filters: ExportHistoryFilters,
) => {
  return useQuery({
    queryKey: localizationQueryKeys.exportHistory.list(
      projectKey,
      pageNumber,
      pageSize,
      filters?.searchText ?? "",
      filters?.startDate ?? "",
      filters?.endDate ?? "",
    ),
    queryFn: () =>
      languageManagerService.getExportHistory({
        pageNumber,
        pageSize,
        filters,
      }),
  });
};

export const useRevertKeyTimeline = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["revert-uilm-key-timeline"],
    mutationFn: (payload: { itemId: string }) => languageManagerService.revertKeyTimeline(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.timelinePrefix,
      });
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.localizationTimelinePrefix,
      });
    },
  });
};

export const useGetLocalizationTimeline = (
  pageNumber: number,
  pageSize: number,
  filters?: {
    userId?: string;
    logFrom?: string;
    logFromValues?: string[];
    excludeLogFromValues?: string[];
    createDateRange?: { startDate?: string; endDate?: string };
  },
) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.languageKeys.localizationTimeline(
      tenantId,
      pageNumber,
      pageSize,
      filters?.userId ?? "",
      filters?.logFrom ?? "",
      filters?.logFromValues ?? [],
      filters?.excludeLogFromValues ?? [],
      filters?.createDateRange?.startDate ?? "",
      filters?.createDateRange?.endDate ?? "",
    ),
    queryFn: () =>
      languageManagerService.getLocalizationTimeline({
        pageNumber,
        pageSize,
        userId: filters?.userId,
        logFrom: filters?.logFrom,
        logFromValues: filters?.logFromValues,
        excludeLogFromValues: filters?.excludeLogFromValues,
        createDateRange: filters?.createDateRange,
      }),
  });
};

export const useGetTimelineByOperationId = (
  operationId: string,
  pageNumber: number,
  pageSize: number,
) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.languageKeys.timelineByOperation(
      tenantId,
      operationId,
      pageNumber,
      pageSize,
    ),
    queryFn: () =>
      languageManagerService.getTimelineByOperationId({
        operationId,
        pageNumber,
        pageSize,
      }),
    enabled: !!operationId,
  });
};

// Glossary hooks

export const useGetGlossaries = (
  pageNumber: number,
  pageSize: number,
  searchText?: string,
  filters: Omit<IGlossaryFilters, "missingTranslation"> = {},
) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.glossaries.list(
      tenantId,
      pageNumber,
      pageSize,
      searchText ?? "",
      filters,
    ),
    queryFn: () =>
      languageManagerService.fetchGlossaries({
        pageNumber,
        pageSize,
        searchText,
        ...(filters.rule && { rule: filters.rule }),
        ...(filters.status && { status: filters.status }),
        ...(filters.language && { language: filters.language }),
        ...(filters.type && { type: filters.type }),
        ...(filters.scope && { scope: filters.scope }),
        ...(filters.sortBy && { sortBy: filters.sortBy }),
        ...(filters.sortDescending !== undefined && { sortDescending: filters.sortDescending }),
      }),
    staleTime: 0,
    refetchOnMount: true,
  });
};

/** Summary strip counts: cached 30 s, refreshed by every glossary write (under `all`). */
export const GLOSSARY_SUMMARY_STALE_TIME = 30_000;

export interface GlossarySummaryCounts {
  total?: number;
  approved?: number;
  draft?: number;
  deprecated?: number;
}

/** One `Gets?PageSize=1` per count (total + each status); a failed count stays undefined. */
export const useGetGlossarySummaryCounts = () => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const buckets = ["total", ...GLOSSARY_STATUSES] as const;
  return useQueries({
    queries: buckets.map((bucket) => ({
      queryKey: localizationQueryKeys.glossaries.summaryCount(tenantId, bucket),
      queryFn: async () =>
        (
          await languageManagerService.fetchGlossaries({
            pageNumber: 0,
            pageSize: 1,
            ...(bucket !== "total" && { status: bucket }),
          })
        ).totalCount ?? 0,
      enabled: !!tenantId,
      staleTime: GLOSSARY_SUMMARY_STALE_TIME,
      retry: false,
    })),
    combine: (results): GlossarySummaryCounts =>
      Object.fromEntries(buckets.map((bucket, index) => [bucket, results[index]?.data])),
  });
};

export const useSaveGlossary = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["save-glossary"],
    mutationFn: languageManagerService.saveGlossary,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.glossaries.all,
      });
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.glossaries.suggestedPrefix,
      });
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.glossaries.detailPrefix,
      });
    },
  });
};

export const useDeleteGlossary = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["glossary", "delete"],
    mutationFn: languageManagerService.deleteGlossary,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.glossaries.all,
      });
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.glossaries.suggestedPrefix,
      });
    },
  });
};

export const useGetGlobalGlossaries = () => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.glossaries.global(tenantId),
    queryFn: () =>
      languageManagerService.fetchGlossaries({
        pageNumber: 0,
        pageSize: 100,
        isGlobal: true,
      }),
    staleTime: 0,
    refetchOnMount: true,
  });
};

export const useGetModuleGlossaries = (moduleId: string) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.glossaries.module(tenantId, moduleId),
    queryFn: () =>
      languageManagerService.fetchGlossaries({
        pageNumber: 0,
        pageSize: 100,
        moduleId,
      }),
    enabled: !!moduleId && !!tenantId,
    staleTime: 0,
    refetchOnMount: true,
  });
};

export const MODULE_GLOSSARIES_PAGE_SIZE = 100;
export const MODULE_GLOSSARIES_MAX_PAGES = 50;

/**
 * Every glossary tagged to a module. `Module/TagGlossary` treats its request as the complete
 * list and untags whatever is missing, so a tagging seed must never be a partial page (A8).
 * Pages until `totalCount` is reached or a page is short, de-duplicated by itemId, at most
 * 50 pages.
 */
export const fetchAllModuleGlossaries = async (moduleId: string): Promise<IGlossary[]> => {
  const byId = new Map<string, IGlossary>();
  let loaded = 0;
  for (let pageNumber = 0; pageNumber < MODULE_GLOSSARIES_MAX_PAGES; pageNumber++) {
    const page = await languageManagerService.fetchGlossaries({
      pageNumber,
      pageSize: MODULE_GLOSSARIES_PAGE_SIZE,
      moduleId,
    });
    const items = page?.items ?? [];
    for (const item of items) {
      if (!byId.has(item.itemId)) byId.set(item.itemId, item);
    }
    loaded += items.length;
    if (items.length < MODULE_GLOSSARIES_PAGE_SIZE || loaded >= (page?.totalCount ?? 0)) break;
  }
  return [...byId.values()];
};

export const useGetAllModuleGlossaries = (moduleId: string) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    // Under `modulePrefix`, so tagging and glossary writes refresh it.
    queryKey: [...localizationQueryKeys.glossaries.module(tenantId, moduleId), "all-pages"],
    queryFn: () => fetchAllModuleGlossaries(moduleId),
    enabled: !!moduleId && !!tenantId,
    staleTime: 0,
    refetchOnMount: true,
    retry: false,
  });
};

/** The server's cap; View Details shows the first few and "+N more". */
export const SUGGESTED_GLOSSARIES_MAX = 20;

export const useGetSuggestedGlossaries = (itemId: string, enabled: boolean) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.glossaries.suggested(tenantId, itemId),
    queryFn: () =>
      languageManagerService.getSuggestedGlossaries({
        itemId,
        maxResults: SUGGESTED_GLOSSARIES_MAX,
      }),
    enabled: enabled && !!itemId && !!tenantId,
    staleTime: 0,
  });
};

export const useSearchGlossaries = (searchText: string, enabled: boolean) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.glossaries.search(tenantId, searchText),
    queryFn: () =>
      languageManagerService.fetchGlossaries({
        pageNumber: 0,
        pageSize: 10,
        searchText: searchText || undefined,
      }),
    enabled: enabled && !!tenantId,
    staleTime: 0,
  });
};

export const useGetGlossaryById = (itemId: string) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.glossaries.detail(tenantId, itemId),
    queryFn: () =>
      languageManagerService.getGlossaryById({
        itemId,
      }),
    enabled: !!itemId && !!tenantId,
    staleTime: 0,
  });
};

/**
 * Returns a function that refetches one glossary from the server, bypassing the cache, and
 * stores the result as that glossary's detail data (so an open details page shows it too).
 */
export const useFetchLatestGlossary = () => {
  const queryClient = useQueryClient();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return (itemId: string) =>
    queryClient.fetchQuery({
      queryKey: localizationQueryKeys.glossaries.detail(tenantId, itemId),
      queryFn: () => languageManagerService.getGlossaryById({ itemId }),
      staleTime: 0,
    });
};

/** `Glossary/GetByIds` accepts at most this many ids per call. */
export const GLOSSARY_BY_IDS_MAX = 100;

const chunkIds = (itemIds: string[]): string[][] => {
  const unique = [...new Set(itemIds.filter(Boolean))];
  const chunks: string[][] = [];
  for (let index = 0; index < unique.length; index += GLOSSARY_BY_IDS_MAX) {
    chunks.push(unique.slice(index, index + GLOSSARY_BY_IDS_MAX));
  }
  return chunks;
};

export interface GlossaryByIdResolution {
  glossaries: IGlossary[];
  /** Ids the server did not return (deleted, other tenant) or whose chunk failed. */
  failedIds: string[];
}

const byIdsQueries = (tenantId: string, itemIds: string[], enabled: boolean) =>
  chunkIds(itemIds).map((ids) => ({
    queryKey: localizationQueryKeys.glossaries.byIds(tenantId, ids),
    queryFn: async () => (await languageManagerService.getGlossariesByIds({ itemIds: ids })).items,
    enabled: enabled && !!tenantId,
    staleTime: 0,
    retry: false,
  }));

/**
 * Resolves glossaries in request order. Settled chunks only: an id still loading is neither
 * resolved nor failed.
 */
const combineGlossaryResolution = (
  results: { status: string; data?: IGlossary[] }[],
  itemIds: string[],
): GlossaryByIdResolution => {
  const byId = new Map<string, IGlossary>();
  const settledIds = new Set<string>();
  const chunks = chunkIds(itemIds);
  results.forEach((result, index) => {
    if (result.status === "pending") return;
    chunks[index]?.forEach((id) => settledIds.add(id));
    result.data?.forEach((glossary) => byId.set(glossary.itemId, glossary));
  });
  const ids = [...new Set(itemIds.filter(Boolean))];
  return {
    glossaries: ids.flatMap((id) => {
      const glossary = byId.get(id);
      return glossary ? [glossary] : [];
    }),
    failedIds: ids.filter((id) => settledIds.has(id) && !byId.has(id)),
  };
};

/**
 * The glossaries with these ids, via `GET Glossary/GetByIds` in chunks of at most 100 (H8).
 * Ids the server leaves out (deleted) are skipped without an error (C7).
 */
export const useGetGlossariesByIds = (itemIds: string[], enabled: boolean) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQueries({
    queries: byIdsQueries(tenantId, itemIds, enabled),
    combine: (results) => combineGlossaryResolution(results, itemIds).glossaries,
  });
};

/** `useGetGlossariesByIds` plus the ids that failed to resolve (same queries and cache). */
export const useResolveGlossariesByIds = (itemIds: string[], enabled: boolean) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQueries({
    queries: byIdsQueries(tenantId, itemIds, enabled),
    combine: (results) => combineGlossaryResolution(results, itemIds),
  });
};

export const useGetKeysByGlossaryId = (
  glossaryId: string,
  pageNumber: number,
  pageSize: number,
  filters: { searchKey?: string; moduleIds?: string[] } = {},
) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.languageKeys.byGlossary(
      tenantId,
      glossaryId,
      pageNumber,
      pageSize,
      filters,
    ),
    queryFn: () =>
      languageManagerService.fetchBlocksLanguageKey({
        pageNumber,
        pageSize,
        searchKey: filters.searchKey ?? "",
        moduleIds: filters.moduleIds ?? [],
        isPartiallyTranslated: false,
        sortProperty: "KeyName",
        isDescending: false,
        glossaryId,
      }),
    enabled: !!glossaryId && !!tenantId,
    staleTime: 0,
    refetchOnMount: true,
  });
};

const glossaryUsageQuery = (tenantId: string, glossaryId: string, enabled: boolean) => ({
  queryKey: localizationQueryKeys.glossaries.usage(tenantId, glossaryId),
  queryFn: () => languageManagerService.getGlossaryUsage({ itemId: glossaryId, pageSize: 1 }),
  enabled: enabled && !!glossaryId && !!tenantId,
  staleTime: 0,
  refetchOnMount: true as const,
  retry: false,
});

export const useGetGlossaryUsageCount = (glossaryId: string, enabled = true) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    ...glossaryUsageQuery(tenantId, glossaryId, enabled),
    select: (usage) => usage?.keyCount ?? 0,
  });
};

/** The same `Usage?pageSize=1` request, with its `moduleIds` ("used by N keys in M modules"). */
export const useGetGlossaryUsage = (glossaryId: string, enabled = true) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery(glossaryUsageQuery(tenantId, glossaryId, enabled));
};

/** `Glossary/Recheck`: queues a background re-check of stored key violations. */
export const useRecheckGlossary = () =>
  useMutation({
    mutationKey: ["glossary", "recheck"],
    mutationFn: languageManagerService.recheckGlossary,
  });

/** Every glossary cache a term write can change (the delete cascade's six prefixes). */
export const GLOSSARY_CACHE_PREFIXES = [
  localizationQueryKeys.glossaries.all,
  localizationQueryKeys.glossaries.globalPrefix,
  localizationQueryKeys.glossaries.modulePrefix,
  localizationQueryKeys.glossaries.searchPrefix,
  localizationQueryKeys.glossaries.detailPrefix,
  localizationQueryKeys.glossaries.suggestedPrefix,
] as const;

export type GlossaryCascadeResult =
  { status: "deleted" } | { status: "delete-failed"; errors: unknown };

export interface GlossaryCascadeVariables {
  glossaryId: string;
}

/**
 * Deletes the glossary. `Glossary/Delete` removes the glossary id from every key on the
 * server before deleting, so this only refreshes every glossary and key cache that the
 * server-side cleanup touched.
 */
export const useDeleteGlossaryWithCascade = () => {
  const queryClient = useQueryClient();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";

  const invalidateKeys = () => {
    refreshLanguageKeyLists(queryClient, "reset");
    queryClient.invalidateQueries({ queryKey: localizationQueryKeys.languageKeys.detailPrefix });
  };

  const invalidateGlossaries = () => {
    GLOSSARY_CACHE_PREFIXES.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  };

  return useMutation({
    mutationKey: ["glossary", "delete-with-cascade"],
    mutationFn: async ({
      glossaryId,
    }: GlossaryCascadeVariables): Promise<GlossaryCascadeResult> => {
      if (!tenantId) {
        throw new Error("No project selected");
      }

      const deleteResponse = await languageManagerService.deleteGlossary({ itemId: glossaryId });
      if (!deleteResponse?.isSuccess) {
        return { status: "delete-failed", errors: deleteResponse?.errors };
      }

      invalidateGlossaries();
      invalidateKeys();
      return { status: "deleted" };
    },
  });
};

export const useGetWebhook = () => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.webhook.detail(tenantId),
    queryFn: () => languageManagerService.getWebhook(),
    enabled: !!tenantId,
    staleTime: 0,
    refetchOnMount: true,
  });
};

export const useSaveWebhook = () => {
  const queryClient = useQueryClient();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useMutation({
    mutationKey: ["save-webhook"],
    mutationFn: (payload: Parameters<typeof languageManagerService.saveWebhook>[0]) =>
      languageManagerService.saveWebhook({
        ...payload,
        projectKey: payload.projectKey ?? tenantId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.webhook.all,
      });
    },
  });
};
