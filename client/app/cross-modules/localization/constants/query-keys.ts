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
      ] as const,
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
    byGlossary: (tenantId: string, glossaryId: string, pageNumber: number, pageSize: number) =>
      ["get-keys-by-glossary", tenantId, glossaryId, pageNumber, pageSize] as const,
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
    list: (tenantId: string, pageNumber: number, pageSize: number, searchText: string) =>
      ["get-glossaries", tenantId, pageNumber, pageSize, searchText] as const,
    global: (tenantId: string) => ["get-glossaries-global", tenantId] as const,
    module: (tenantId: string, moduleId: string) =>
      ["get-glossaries-module", tenantId, moduleId] as const,
    suggested: (tenantId: string, itemId: string) =>
      ["get-suggested-glossaries", tenantId, itemId] as const,
    search: (tenantId: string, searchText: string) =>
      ["search-glossaries", tenantId, searchText] as const,
    detail: (tenantId: string, itemId: string) => ["get-glossary", tenantId, itemId] as const,
    detailPrefix: ["get-glossary"] as const,
    suggestedPrefix: ["get-suggested-glossaries"] as const,
  },
  webhook: {
    all: ["get-webhook"] as const,
    detail: (tenantId: string) => ["get-webhook", tenantId] as const,
  },
} as const;
