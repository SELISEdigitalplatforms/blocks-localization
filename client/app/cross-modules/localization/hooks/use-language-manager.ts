import { useProjectStore } from "@seliseblocks/genesis-os";
import { localizationQueryKeys } from "../constants/query-keys";
import {
  ExportHistoryFilters,
  IDeleteModuleRequest,
  IGlossary,
  ILanguageConfig,
  IKeyUilmExport,
  ISaveBlocksLanguageKeyPayload,
} from "@blocks-localization/models/language";
import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import { useEffect } from "react";
import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

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
) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.languageKeys.list(
      tenantId,
      pageNumber,
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
    ),
    queryFn: () =>
      languageManagerService.fetchBlocksLanguageKey({
        pageNumber: pageNumber,
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
      }),
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnMount: true,
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.detailPrefix,
      });
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.all,
      });
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.detailPrefix,
      });
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.all,
      });
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

export const useDeleteLanguageModule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["language-module", "delete"],
    mutationFn: (payload: IDeleteModuleRequest) =>
      languageManagerService.deleteLanguageModule(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.modules.all,
      });
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
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.all,
      });
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
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.all,
      });
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
          queryClient.invalidateQueries({
            queryKey: localizationQueryKeys.languageKeys.all,
          });
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.all,
      });
    },
  });
};

export const useDeleteLanguageKeys = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["language-keys", "bulk-delete"],
    mutationFn: languageManagerService.deleteLanguageKeys,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.all,
      });
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
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.all,
      });
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

export const useGetGlossaries = (pageNumber: number, pageSize: number, searchText?: string) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.glossaries.list(
      tenantId,
      pageNumber,
      pageSize,
      searchText ?? "",
    ),
    queryFn: () =>
      languageManagerService.fetchGlossaries({
        pageNumber,
        pageSize,
        searchText,
      }),
    staleTime: 0,
    refetchOnMount: true,
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

export const useGetSuggestedGlossaries = (itemId: string, enabled: boolean) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.glossaries.suggested(tenantId, itemId),
    queryFn: () =>
      languageManagerService.getSuggestedGlossaries({
        itemId,
        maxResults: 5,
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

const combineSuccessfulGlossaries = (
  results: { status: string; data?: IGlossary }[],
): IGlossary[] =>
  results.flatMap((result) => (result.status === "success" && result.data ? [result.data] : []));

export const useGetGlossariesByIds = (itemIds: string[], enabled: boolean) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQueries({
    queries: itemIds.map((itemId) => ({
      queryKey: localizationQueryKeys.glossaries.detail(tenantId, itemId),
      queryFn: () => languageManagerService.getGlossaryById({ itemId }),
      enabled: enabled && !!itemId && !!tenantId,
      staleTime: 0,
      retry: false,
    })),
    combine: combineSuccessfulGlossaries,
  });
};

export const useGetKeysByGlossaryId = (
  glossaryId: string,
  pageNumber: number,
  pageSize: number,
) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.languageKeys.byGlossary(
      tenantId,
      glossaryId,
      pageNumber,
      pageSize,
    ),
    queryFn: () =>
      languageManagerService.fetchBlocksLanguageKey({
        pageNumber,
        pageSize,
        searchKey: "",
        moduleIds: [],
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

export const GLOSSARY_CASCADE_BATCH_SIZE = 100;

const fetchKeysTaggedWithGlossary = (glossaryId: string, pageSize: number) =>
  languageManagerService.fetchBlocksLanguageKey({
    pageNumber: 0,
    pageSize,
    searchKey: "",
    moduleIds: [],
    isPartiallyTranslated: false,
    sortProperty: "KeyName",
    isDescending: false,
    glossaryId,
  });

export const useGetGlossaryUsageCount = (glossaryId: string, enabled = true) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.languageKeys.glossaryUsage(tenantId, glossaryId),
    queryFn: async () => (await fetchKeysTaggedWithGlossary(glossaryId, 1)).totalCount ?? 0,
    enabled: enabled && !!glossaryId && !!tenantId,
    staleTime: 0,
    refetchOnMount: true,
    retry: false,
  });
};

export type GlossaryCascadeResult =
  | { status: "deleted" }
  | {
      status: "keys-failed";
      reason: "save-failed" | "iteration-limit";
      removedCount: number;
      totalCount: number;
      errorMessage?: string;
    }
  | { status: "delete-failed"; errors: unknown };

export interface GlossaryCascadeVariables {
  glossaryId: string;
  initialCount: number;
  onProgress?: (removedCount: number, totalCount: number) => void;
}

type CascadeBatchSaveResult = { success: true } | { success: false; errorMessage?: string };

type TaggedKeysPage = Awaited<ReturnType<typeof fetchKeysTaggedWithGlossary>>;

const buildCascadeBatch = (
  keys: NonNullable<TaggedKeysPage["keys"]>,
  glossaryId: string,
): ISaveBlocksLanguageKeyPayload[] =>
  keys.map((key) => ({
    itemId: key.itemId,
    keyName: key.keyName,
    moduleId: key.moduleId,
    resources: key.resources,
    context: key.context,
    isPartiallyTranslated: key.isPartiallyTranslated,
    routes: key.routes ?? [],
    glossaryIds: (key.glossaryIds ?? []).filter((id) => id !== glossaryId),
    isNewKey: false,
  }));

const saveCascadeBatch = async (
  batch: ISaveBlocksLanguageKeyPayload[],
): Promise<CascadeBatchSaveResult> => {
  try {
    const saveResponse = await languageManagerService.saveBlocksLanguageKeys(batch);
    if (saveResponse?.success) return { success: true };
    return { success: false, errorMessage: saveResponse?.errorMessage || undefined };
  } catch (error) {
    return { success: false, errorMessage: error instanceof Error ? error.message : undefined };
  }
};

/** A failed batch may have partly succeeded, so re-count what is still tagged. */
const recountRemovedKeys = async (
  glossaryId: string,
  totalCount: number,
  knownRemoved: number,
): Promise<number> => {
  try {
    const recount = await fetchKeysTaggedWithGlossary(glossaryId, 1);
    return Math.max(0, totalCount - (recount.totalCount ?? 0));
  } catch {
    // Keep the count of keys from batches known to have succeeded.
    return knownRemoved;
  }
};

/**
 * Removes the glossary id from every key tagged with it (sequential batches of 100,
 * always re-reading page 0 because cleaned keys drop out of the filter) and only
 * deletes the glossary once every batch has succeeded and a final re-count confirms
 * no key still references it. SaveKeys matches keys by (KeyName, ModuleId), so a
 * "successful" save can still leave a duplicate or renamed key tagged, and keys can
 * be tagged after the dialog counted them.
 */
export const useDeleteGlossaryWithCascade = () => {
  const queryClient = useQueryClient();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";

  const invalidateKeys = () => {
    queryClient.invalidateQueries({ queryKey: localizationQueryKeys.languageKeys.all });
    queryClient.invalidateQueries({ queryKey: localizationQueryKeys.languageKeys.detailPrefix });
  };

  const invalidateGlossaries = () => {
    [
      localizationQueryKeys.glossaries.all,
      localizationQueryKeys.glossaries.globalPrefix,
      localizationQueryKeys.glossaries.modulePrefix,
      localizationQueryKeys.glossaries.searchPrefix,
      localizationQueryKeys.glossaries.detailPrefix,
      localizationQueryKeys.glossaries.suggestedPrefix,
    ].forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  };

  return useMutation({
    mutationKey: ["glossary", "delete-with-cascade"],
    mutationFn: async ({
      glossaryId,
      initialCount,
      onProgress,
    }: GlossaryCascadeVariables): Promise<GlossaryCascadeResult> => {
      if (!tenantId) {
        throw new Error("No project selected");
      }

      let removedCount = 0;
      let totalCount = initialCount;
      // Distinct keys sent so far: a key that stays tagged is re-sent but counted once.
      const sentKeyIds = new Set<string>();
      let remaining = initialCount;
      let savedAny = false;
      const maxIterations = Math.ceil(initialCount / GLOSSARY_CASCADE_BATCH_SIZE) + 2;
      onProgress?.(0, initialCount);

      const keysFailed = async (
        reason: "save-failed" | "iteration-limit",
        errorMessage?: string,
      ): Promise<GlossaryCascadeResult> => ({
        status: "keys-failed",
        reason,
        removedCount: await recountRemovedKeys(glossaryId, totalCount, removedCount),
        totalCount,
        errorMessage,
      });

      try {
        let iteration = 0;
        let verifiedClean = false;
        while (!verifiedClean) {
          if (remaining <= 0) {
            // Verify before deleting: never trust arithmetic alone.
            remaining = (await fetchKeysTaggedWithGlossary(glossaryId, 1)).totalCount ?? 0;
            verifiedClean = remaining <= 0;
            continue;
          }
          if (iteration >= maxIterations) {
            return await keysFailed("iteration-limit");
          }
          iteration++;

          const page = await fetchKeysTaggedWithGlossary(glossaryId, GLOSSARY_CASCADE_BATCH_SIZE);
          const keys = page.keys ?? [];
          if (keys.length === 0) {
            // The page disagrees with the count; re-verify (bounded by maxIterations).
            remaining = 0;
            continue;
          }

          const saveResult = await saveCascadeBatch(buildCascadeBatch(keys, glossaryId));
          savedAny = true;
          if (!saveResult.success) {
            return await keysFailed("save-failed", saveResult.errorMessage);
          }

          const pageIds = new Set(keys.map((key) => key.itemId));
          const earlierKeys = [...sentKeyIds].filter((id) => !pageIds.has(id)).length;
          pageIds.forEach((id) => sentKeyIds.add(id));
          const matching = page.totalCount ?? keys.length;
          totalCount = Math.max(totalCount, earlierKeys + matching);
          remaining = Math.max(0, matching - keys.length);
          removedCount = Math.max(removedCount, totalCount - remaining);
          onProgress?.(removedCount, totalCount);
        }
      } finally {
        if (savedAny) {
          invalidateKeys();
        }
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
