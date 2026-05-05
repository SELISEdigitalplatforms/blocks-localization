import { useProjectStore } from "@/store/useProjectStore";
import { localizationQueryKeys } from "../constants/query-keys";
import { ExportHistoryFilters, IKeyUilmExport } from "@blocks-localization/models/language";
import { languageManagerService } from "@blocks-localization/services/language.manager.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
        projectKey: tenantId,
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
        projectKey: tenantId,
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
    queryFn: () => languageManagerService.fetchBlocksLanguageModules(tenantId),
  });
};

export const useGetLanguages = () => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.languages.list(tenantId),
    queryFn: () => languageManagerService.fetchBlocksLanguages(tenantId),
  });
};

export const useSaveBlocksLanguageKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["add-blocksLanguageKey"],
    mutationFn: languageManagerService.saveBlocksLanguageKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: localizationQueryKeys.languageKeys.detailPrefix });
      queryClient.invalidateQueries({ queryKey: localizationQueryKeys.languageKeys.all });
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
      queryClient.invalidateQueries({ queryKey: localizationQueryKeys.modules.all });
    },
  });
};

export function useGetLanguageModule(projectKey: string) {
  return useQuery({
    queryKey: localizationQueryKeys.modules.byProject(projectKey),
    queryFn: () => languageManagerService.getLanguageModule(projectKey),
    enabled: !!projectKey,
  });
}

export const useTranslateAll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["translate-all"],
    mutationFn: languageManagerService.translateAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: localizationQueryKeys.languageKeys.detailPrefix });
      queryClient.invalidateQueries({ queryKey: localizationQueryKeys.languageKeys.all });
    },
  });
};

export const useTranslateKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["translate-key"],
    mutationFn: languageManagerService.translateKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: localizationQueryKeys.languageKeys.detailPrefix });
      queryClient.invalidateQueries({ queryKey: localizationQueryKeys.languageKeys.all });
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.timelinePrefix,
      });
      queryClient.invalidateQueries({
        queryKey: localizationQueryKeys.languageKeys.localizationTimelinePrefix,
      });
    },
  });
};

export const useSaveLanguage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["add-language"],
    mutationFn: languageManagerService.saveLanguage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: localizationQueryKeys.languages.all });
    },
  });
};

export const useDeleteLanguageKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["language-key", "delete"],
    mutationFn: languageManagerService.deleteLanguageKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: localizationQueryKeys.languageKeys.all });
    },
  });
};

export const useDeleteLanguage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["language-config", "delete"],
    mutationFn: languageManagerService.deleteLanguage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: localizationQueryKeys.languages.all });
    },
  });
};

export const useSetDefaultLanguage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["language-config", "set-default"],
    mutationFn: languageManagerService.setDefault,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: localizationQueryKeys.languages.all });
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
  return useMutation({
    mutationKey: ["save-language-key-uilm-export"],
    mutationFn: (payload: IKeyUilmExport) =>
      languageManagerService.saveLanguageKeyUilmExport(payload),
    onSuccess: () => {},
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
        projectKey: tenantId,
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
        projectKey,
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
    mutationFn: (payload: { itemId: string; projectKey: string }) =>
      languageManagerService.revertKeyTimeline(payload),
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
        projectKey: tenantId,
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
        projectKey: tenantId,
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
        projectKey: tenantId,
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
      queryClient.invalidateQueries({ queryKey: localizationQueryKeys.glossaries.all });
      queryClient.invalidateQueries({ queryKey: localizationQueryKeys.glossaries.suggestedPrefix });
      queryClient.invalidateQueries({ queryKey: localizationQueryKeys.glossaries.detailPrefix });
    },
  });
};

export const useDeleteGlossary = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["glossary", "delete"],
    mutationFn: languageManagerService.deleteGlossary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: localizationQueryKeys.glossaries.all });
      queryClient.invalidateQueries({ queryKey: localizationQueryKeys.glossaries.suggestedPrefix });
    },
  });
};

export const useGetGlobalGlossaries = () => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.glossaries.global(tenantId),
    queryFn: () =>
      languageManagerService.fetchGlossaries({
        projectKey: tenantId,
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
        projectKey: tenantId,
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
        projectKey: tenantId,
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
        projectKey: tenantId,
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
        projectKey: tenantId,
      }),
    enabled: !!itemId && !!tenantId,
    staleTime: 0,
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
        projectKey: tenantId,
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
  });
};

export const useGetWebhook = () => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: localizationQueryKeys.webhook.detail(tenantId),
    queryFn: () => languageManagerService.getWebhook(tenantId),
    staleTime: 0,
    refetchOnMount: true,
  });
};

export const useSaveWebhook = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["save-webhook"],
    mutationFn: languageManagerService.saveWebhook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: localizationQueryKeys.webhook.all });
    },
  });
};
