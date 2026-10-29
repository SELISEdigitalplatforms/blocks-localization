import { IGlossaryFilters } from "@blocks-localization/models/language";

/** Filters of the "All" view's chunked list; each one is part of its query key. */
export interface LanguageKeyInfiniteFilters {
  searchKey: string;
  moduleIds: string[];
  sortProperty: string;
  isDescending: boolean;
  createStartDate: string;
  createEndDate: string;
  lastUpdateStartDate: string;
  lastUpdateEndDate: string;
  resourceSearchFilters: { culture: string; searchText: string }[];
  missingLanguages: string[];
  onlyDuplicates?: boolean;
  hasGlossaryViolations?: boolean;
}

export const localizationQueryKeys = {
  languageKeys: {
    all: ["get-blocksLanguageKeys"] as const,
    list: (
      tenantId: string,
      pageNumber: number,
      pageSize: number,
      searchKey: string,
      moduleIds: string[],
      isPartiallyTranslated: boolean,
      sortProperty: string,
      isDescending: boolean,
      createStartDate: string,
      createEndDate: string,
      lastUpdateStartDate: string,
      lastUpdateEndDate: string,
      resourceSearchFilters: { culture: string; searchText: string }[],
      missingLanguages: string[],
      onlyDuplicates = false,
      hasGlossaryViolations = false,
    ) =>
      [
        "get-blocksLanguageKeys",
        tenantId,
        pageNumber,
        pageSize,
        searchKey,
        JSON.stringify(moduleIds),
        isPartiallyTranslated,
        sortProperty,
        isDescending,
        createStartDate,
        createEndDate,
        lastUpdateStartDate,
        lastUpdateEndDate,
        JSON.stringify(resourceSearchFilters),
        JSON.stringify(missingLanguages),
        onlyDuplicates,
        hasGlossaryViolations,
      ] as const,
    /**
     * The "All" view's chunked list. Under the `all` prefix so broad invalidation still reaches it;
     * the `infinite` marker lets mutations patch or reset it instead of refetching every loaded chunk.
     */
    infinite: (
      tenantId: string,
      {
        searchKey,
        moduleIds,
        sortProperty,
        isDescending,
        createStartDate,
        createEndDate,
        lastUpdateStartDate,
        lastUpdateEndDate,
        resourceSearchFilters,
        missingLanguages,
        onlyDuplicates = false,
        hasGlossaryViolations = false,
      }: LanguageKeyInfiniteFilters,
    ) =>
      [
        "get-blocksLanguageKeys",
        "infinite",
        tenantId,
        searchKey,
        JSON.stringify(moduleIds),
        sortProperty,
        isDescending,
        createStartDate,
        createEndDate,
        lastUpdateStartDate,
        lastUpdateEndDate,
        JSON.stringify(resourceSearchFilters),
        JSON.stringify(missingLanguages),
        onlyDuplicates,
        hasGlossaryViolations,
      ] as const,
    infinitePrefix: ["get-blocksLanguageKeys", "infinite"] as const,
    // Sits under `all`, so every key save or delete that refreshes the list refreshes the summary too.
    duplicateSummary: (tenantId: string) =>
      ["get-blocksLanguageKeys", "duplicate-summary", tenantId] as const,
    duplicateSummaryPrefix: ["get-blocksLanguageKeys", "duplicate-summary"] as const,
    detail: (tenantId: string, itemId: string) =>
      ["get-blocksLanguageKey", tenantId, itemId] as const,
    detailPrefix: ["get-blocksLanguageKey"] as const,
    timeline: (tenantId: string, pageNumber: number, pageSize: number, keyId: string) =>
      ["get-uilm-timeline", tenantId, pageNumber, pageSize, keyId] as const,
    timelinePrefix: ["get-uilm-timeline"] as const,
    localizationTimeline: (
      tenantId: string,
      pageNumber: number,
      pageSize: number,
      userId: string,
      logFrom: string,
      logFromValues: string[],
      excludeLogFromValues: string[],
      startDate: string,
      endDate: string,
    ) =>
      [
        "get-localization-timeline",
        tenantId,
        pageNumber,
        pageSize,
        userId,
        logFrom,
        logFromValues.join(","),
        excludeLogFromValues.join(","),
        startDate,
        endDate,
      ] as const,
    localizationTimelinePrefix: ["get-localization-timeline"] as const,
    timelineByOperation: (
      tenantId: string,
      operationId: string,
      pageNumber: number,
      pageSize: number,
    ) => ["get-timeline-by-operation", tenantId, operationId, pageNumber, pageSize] as const,
    byGlossary: (
      tenantId: string,
      glossaryId: string,
      pageNumber: number,
      pageSize: number,
      filters: { searchKey?: string; moduleIds?: string[] } = {},
    ) =>
      [
        "get-blocksLanguageKeys",
        "by-glossary",
        tenantId,
        glossaryId,
        pageNumber,
        pageSize,
        filters.searchKey ?? "",
        JSON.stringify(filters.moduleIds ?? []),
      ] as const,
    countByModule: (tenantId: string, moduleId: string) =>
      ["get-blocksLanguageKeys", tenantId, "count-by-module", moduleId] as const,
  },
  languages: {
    all: ["get-languages"] as const,
    list: (tenantId: string) => ["get-languages", tenantId] as const,
  },
  modules: {
    all: ["get-language-modules"] as const,
    list: (tenantId: string) => ["get-language-modules", tenantId] as const,
    byProject: (projectKey: string) => ["language-modules", projectKey] as const,
  },
  exportHistory: {
    all: ["export-history"] as const,
    list: (
      projectKey: string,
      pageNumber: number,
      pageSize: number,
      searchText: string,
      startDate: string,
      endDate: string,
    ) =>
      ["export-history", projectKey, pageNumber, pageSize, searchText, startDate, endDate] as const,
  },
  glossaries: {
    all: ["get-glossaries"] as const,
    list: (
      tenantId: string,
      pageNumber: number,
      pageSize: number,
      searchText: string,
      filters: IGlossaryFilters = {},
    ) =>
      [
        "get-glossaries",
        tenantId,
        pageNumber,
        pageSize,
        searchText,
        filters.rule ?? "",
        filters.status ?? "",
        filters.missingTranslation ?? "",
        filters.language ?? "",
        filters.type ?? "",
        filters.scope ?? "",
        filters.sortBy ?? "",
        filters.sortDescending ?? "",
      ] as const,
    /** Summary-strip count (`Gets?PageSize=1`) for one status, or every term when "total". */
    summaryCount: (tenantId: string, status: string) =>
      ["get-glossaries", "summary", tenantId, status] as const,
    /** `Glossary/Usage` (delete dialog count); under `all`, so glossary writes refresh it. */
    usage: (tenantId: string, glossaryId: string) =>
      ["get-glossaries", "usage", tenantId, glossaryId] as const,
    /** One `GetByIds` chunk; under `all`, so glossary writes refresh it. */
    byIds: (tenantId: string, itemIds: string[]) =>
      ["get-glossaries", "by-ids", tenantId, itemIds.join(",")] as const,
    /** `/Glossary/Match` for one source text; under `all`, so glossary writes refresh it. */
    match: (
      tenantId: string,
      sourceCulture: string,
      keyId: string,
      moduleId: string,
      text: string,
      glossaryIds = "",
    ) => ["get-glossaries", "match", tenantId, sourceCulture, keyId, moduleId, glossaryIds, text] as const,
    matchPrefix: ["get-glossaries", "match"] as const,
    global: (tenantId: string) => ["get-glossaries-global", tenantId] as const,
    globalPrefix: ["get-glossaries-global"] as const,
    module: (tenantId: string, moduleId: string) =>
      ["get-glossaries-module", tenantId, moduleId] as const,
    modulePrefix: ["get-glossaries-module"] as const,
    suggested: (tenantId: string, itemId: string) =>
      ["get-suggested-glossaries", tenantId, itemId] as const,
    search: (tenantId: string, searchText: string) =>
      ["search-glossaries", tenantId, searchText] as const,
    searchPrefix: ["search-glossaries"] as const,
    detail: (tenantId: string, itemId: string) => ["get-glossary", tenantId, itemId] as const,
    detailPrefix: ["get-glossary"] as const,
    suggestedPrefix: ["get-suggested-glossaries"] as const,
  },
  webhook: {
    all: ["get-webhook"] as const,
    detail: (tenantId: string) => ["get-webhook", tenantId] as const,
  },
} as const;
