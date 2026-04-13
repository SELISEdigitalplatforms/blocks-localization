import { languageManagerService } from "@/features/uilm/services/language-manager.service";
import type { ExportHistoryFilters, IImportFile, IKeyUilmExport, SaveKeyPayload } from "@/features/uilm/types/language";
import { useUilmProjectStore } from "@/features/uilm/state/uilm-project-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const keysRoot = "uilm-blocksLanguageKeys";
const keyOne = "uilm-blocksLanguageKey";
const modulesKey = "uilm-language-modules";
const langsKey = "uilm-languages";
const exportHistoryKey = "uilm-export-history";
const localizationTimelineKey = "uilm-localization-timeline";
const timelineByOperationKey = "uilm-timeline-by-operation";

export function useUilmProjectKey(): string {
  return useUilmProjectStore((s) => s.projectKey);
}

export function useUilmLanguageKeys(
  pageNumber: number,
  pageSize: number,
  searchKey: string,
  moduleIds: string[],
  isPartiallyTranslated: boolean,
  sortProperty = "KeyName",
  isDescending = false,
  resourceSearchFilters?: { culture: string; searchText: string }[],
  createDateRange?: { startDate: string; endDate: string },
  lastUpdateDateRange?: { startDate: string; endDate: string },
) {
  const projectKey = useUilmProjectKey();
  return useQuery({
    queryKey: [
      keysRoot,
      projectKey,
      pageNumber,
      pageSize,
      searchKey,
      JSON.stringify(moduleIds),
      isPartiallyTranslated,
      sortProperty,
      isDescending,
      JSON.stringify(resourceSearchFilters ?? []),
      createDateRange?.startDate ?? "",
      createDateRange?.endDate ?? "",
      lastUpdateDateRange?.startDate ?? "",
      lastUpdateDateRange?.endDate ?? "",
    ],
    queryFn: () =>
      languageManagerService.fetchBlocksLanguageKey({
        projectKey,
        pageNumber,
        pageSize,
        searchKey,
        moduleIds,
        isPartiallyTranslated,
        sortProperty,
        isDescending,
        createDateRange,
        lastUpdateDateRange,
        resourceSearchFilters,
      }),
    enabled: Boolean(projectKey),
  });
}

export function useUilmLanguageKeyById(itemId: string) {
  const projectKey = useUilmProjectKey();
  return useQuery({
    queryKey: [keyOne, projectKey, itemId],
    queryFn: () => languageManagerService.fetchBlocksLanguageKeyById({ projectKey, itemId }),
    enabled: Boolean(projectKey && itemId),
  });
}

export function useUilmLanguageModules() {
  const projectKey = useUilmProjectKey();
  return useQuery({
    queryKey: [modulesKey, projectKey],
    queryFn: () => languageManagerService.fetchBlocksLanguageModules(projectKey),
    enabled: Boolean(projectKey),
  });
}

export function useUilmLanguages() {
  const projectKey = useUilmProjectKey();
  return useQuery({
    queryKey: [langsKey, projectKey],
    queryFn: () => languageManagerService.fetchBlocksLanguages(projectKey),
    enabled: Boolean(projectKey),
  });
}

export function useUilmExportHistory(
  pageNumber: number,
  pageSize: number,
  filters: ExportHistoryFilters,
) {
  const projectKey = useUilmProjectKey();
  return useQuery({
    queryKey: [exportHistoryKey, projectKey, pageNumber, pageSize, JSON.stringify(filters)],
    queryFn: () =>
      languageManagerService.getExportHistory({
        projectKey,
        pageNumber,
        pageSize,
        filters,
      }),
    enabled: Boolean(projectKey),
  });
}

export function useUilmSaveLanguageKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveKeyPayload) => languageManagerService.saveBlocksLanguageKey(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [keysRoot] });
      queryClient.invalidateQueries({ queryKey: [keyOne] });
    },
  });
}

export function useUilmDeleteLanguageKey() {
  const queryClient = useQueryClient();
  const projectKey = useUilmProjectKey();
  return useMutation({
    mutationFn: (itemId: string) => languageManagerService.deleteLanguageKey({ itemId, projectKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [keysRoot] });
    },
  });
}

export function useUilmSaveLanguageModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { moduleName: string; projectKey: string }) =>
      languageManagerService.saveLanguageModule(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [modulesKey] });
    },
  });
}

export function useUilmSaveLanguage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { languageName: string; languageCode: string; projectKey: string }) =>
      languageManagerService.saveLanguage(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [langsKey] });
    },
  });
}

export function useUilmDeleteLanguage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { languageName: string; projectKey: string }) =>
      languageManagerService.deleteLanguage(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [langsKey] });
    },
  });
}

export function useUilmSetDefaultLanguage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { languageName: string; projectKey: string }) =>
      languageManagerService.setDefault(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [langsKey] });
    },
  });
}

export function useUilmGenerateUilmFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { guid: string; projectKey: string }) =>
      languageManagerService.generateUilmFile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [keysRoot] });
      queryClient.invalidateQueries({ queryKey: [localizationTimelineKey] });
    },
  });
}

export function useUilmImportLanguageFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: IImportFile) => languageManagerService.importLanguageFile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [keysRoot] });
      queryClient.invalidateQueries({ queryKey: [localizationTimelineKey] });
    },
  });
}

export function useUilmSaveLanguageKeyUilmExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: IKeyUilmExport) => languageManagerService.saveLanguageKeyUilmExport(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [exportHistoryKey] });
      queryClient.invalidateQueries({ queryKey: [localizationTimelineKey] });
    },
  });
}

export type LocalizationTimelineFilters = {
  userId?: string;
  logFrom?: string;
  logFromValues?: string[];
  excludeLogFromValues?: string[];
  createDateRange?: { startDate?: string; endDate?: string };
};

/** `pageIndex` is 0-based (matches Pagination); API uses 1-based page numbers. */
export function useUilmLocalizationTimeline(
  pageIndex: number,
  pageSize: number,
  filters?: LocalizationTimelineFilters,
) {
  const projectKey = useUilmProjectKey();
  return useQuery({
    queryKey: [
      localizationTimelineKey,
      projectKey,
      pageIndex,
      pageSize,
      filters?.userId ?? "",
      filters?.logFrom ?? "",
      filters?.logFromValues?.join(",") ?? "",
      filters?.excludeLogFromValues?.join(",") ?? "",
      filters?.createDateRange?.startDate ?? "",
      filters?.createDateRange?.endDate ?? "",
    ],
    queryFn: () =>
      languageManagerService.getLocalizationTimeline({
        projectKey,
        pageNumber: pageIndex + 1,
        pageSize,
        userId: filters?.userId,
        logFrom: filters?.logFrom,
        logFromValues: filters?.logFromValues,
        excludeLogFromValues: filters?.excludeLogFromValues,
        createDateRange: filters?.createDateRange,
      }),
    enabled: Boolean(projectKey),
  });
}

export function useUilmTimelineByOperationId(
  operationId: string,
  pageIndex: number,
  pageSize: number,
) {
  const projectKey = useUilmProjectKey();
  return useQuery({
    queryKey: [timelineByOperationKey, projectKey, operationId, pageIndex, pageSize],
    queryFn: () =>
      languageManagerService.getTimelineByOperationId({
        operationId,
        projectKey,
        pageNumber: pageIndex + 1,
        pageSize,
      }),
    enabled: Boolean(projectKey && operationId),
  });
}

export function useUilmRevertKeyTimeline() {
  const queryClient = useQueryClient();
  const projectKey = useUilmProjectKey();
  return useMutation({
    mutationFn: (payload: { itemId: string }) =>
      languageManagerService.revertKeyTimeline({ itemId: payload.itemId, projectKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [timelineByOperationKey] });
      queryClient.invalidateQueries({ queryKey: [localizationTimelineKey] });
      queryClient.invalidateQueries({ queryKey: [keysRoot] });
    },
  });
}

const keysTimelineKey = "uilm-keys-timeline";

export function useUilmGetTranslationSuggestion() {
  return useMutation({
    mutationFn: (payload: {
      sourceText: string;
      destinationLanguage: string;
      currentLanguage: string;
      temperature: number;
      elementDetailContext: string;
    }) => languageManagerService.getTranslationSuggestion(payload),
  });
}

export function useUilmTranslateKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      keyId: string;
      projectKey: string;
      defaultLanguage: string;
      messageCoRelationId: string;
    }) => languageManagerService.translateKey(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [keysRoot] });
      queryClient.invalidateQueries({ queryKey: [keyOne] });
      queryClient.invalidateQueries({ queryKey: [keysTimelineKey] });
      queryClient.invalidateQueries({ queryKey: [localizationTimelineKey] });
    },
  });
}

export function useUilmTranslateAll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      projectKey: string;
      messageCoRelationId: string;
      defaultLanguage: string;
      moduleId?: string;
    }) => languageManagerService.translateAll(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [keysRoot] });
      queryClient.invalidateQueries({ queryKey: [keyOne] });
      queryClient.invalidateQueries({ queryKey: [localizationTimelineKey] });
    },
  });
}

export function useUilmKeysTimeline(
  pageNumber: number,
  pageSize: number,
  keyId: string,
) {
  const projectKey = useUilmProjectKey();
  return useQuery({
    queryKey: [keysTimelineKey, projectKey, pageNumber, pageSize, keyId],
    queryFn: () =>
      languageManagerService.getKeysTimeline({
        projectKey,
        pageNumber,
        pageSize,
        keyId,
      }),
    enabled: Boolean(projectKey && keyId),
  });
}

