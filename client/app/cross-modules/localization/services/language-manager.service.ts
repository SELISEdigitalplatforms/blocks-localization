import { serviceInstances } from "@/lib/http-client";
import { ensureLocalizationSession } from "@/lib/session-refresh";
import {
  CONFIG_ENDPOINTS,
  LANGUAGE_ASSISTANT_ENDPOINTS,
  LANGUAGE_ENDPOINTS,
  LANGUAGE_KEY_ENDPOINTS,
  LANGUAGE_MODULE_ENDPOINTS,
  GLOSSARY_ENDPOINTS,
} from "@blocks-localization/constants/endpoint.constant";
import {
  ExportHistoryFilters,
  IBlocksLanguageKey,
  IBlocksLanguageKeyResponse,
  IGetExportHistory,
  IGlossary,
  IGetGlossariesByIdsResponse,
  IGetGlossariesResponse,
  IGlossaryFilters,
  IGlossaryTranslation,
  IGlossaryUsageResponse,
  IMatchGlossaryRequest,
  IMatchGlossaryResponse,
  ITranslationSuggestionResponse,
  GlossaryRuleDto,
  GlossaryStatus,
  GlossaryPartOfSpeech,
  IRecheckGlossaryResponse,
  IGetSuggestedGlossariesResponse,
  IGetLocalizationTimelineResponse,
  IGetTimelineByOperationIdResponse,
  IGetTimelineResponse,
  IImportFile,
  IBaseMutationResponse,
  IKeyUilmExport,
  ILanguageConfig,
  IDeleteModuleRequest,
  IDuplicateSummary,
  IEnforceUniquenessResult,
  IModuleGets,
  IRollbackResponse,
  ISaveBlocksLanguageKeyPayload,
  ITagGlossaryRequest,
  IValidationError,
  IWebhookConfig,
} from "@blocks-localization/models/language";

export class LanguageManagerService {
  private readonly httpClient = serviceInstances.localizationService;
  fetchBlocksLanguageKey = (
    request: {
      pageNumber: number;
      pageSize: number;
      searchKey: string;
      moduleIds: string[];
      isPartiallyTranslated: boolean;
      sortProperty: string;
      isDescending: boolean;
      createDateRange?: {
        startDate?: string;
        endDate?: string;
      };
      lastUpdateDateRange?: {
        startDate?: string;
        endDate?: string;
      };
      resourceSearchFilters?: { culture: string; searchText: string }[];
      glossaryId?: string;
      missingLanguages?: string[];
      onlyDuplicates?: boolean;
      /** Only keys with stored glossary violations; sent only when true. */
      hasGlossaryViolations?: boolean;
      /** Keyset token from a previous `nextCursor`; when set the server ignores `pageNumber`. */
      cursor?: string;
      includeTotalCount?: boolean;
    },
    options?: { signal?: AbortSignal },
  ): Promise<IBlocksLanguageKeyResponse> => {
    const url = LANGUAGE_KEY_ENDPOINTS.GETS;
    const payload = { ...request };
    if (!payload.hasGlossaryViolations) {
      delete payload.hasGlossaryViolations;
    }
    if (!request.createDateRange) {
      delete payload.createDateRange;
    } else if (payload.createDateRange?.startDate === "") {
      delete payload.createDateRange.startDate;
    } else if (payload?.createDateRange?.endDate === "") {
      delete payload.createDateRange.endDate;
    }
    if (!request.lastUpdateDateRange) {
      delete payload.lastUpdateDateRange;
    } else if (payload.lastUpdateDateRange?.startDate === "") {
      delete payload.lastUpdateDateRange.startDate;
    } else if (payload?.lastUpdateDateRange?.endDate === "") {
      delete payload.lastUpdateDateRange.endDate;
    }
    return this.httpClient.post(url, payload, undefined, { signal: options?.signal });
  };

  fetchDuplicateSummary = (): Promise<IDuplicateSummary> => {
    return this.httpClient.get(LANGUAGE_KEY_ENDPOINTS.GET_DUPLICATE_SUMMARY);
  };

  enforceUniqueness = (): Promise<IEnforceUniquenessResult> => {
    return this.httpClient.post<IEnforceUniquenessResult>(
      LANGUAGE_KEY_ENDPOINTS.ENFORCE_UNIQUENESS,
      {},
    );
  };

  fetchBlocksLanguageKeyById = (request: { itemId: string }): Promise<IBlocksLanguageKey> => {
    return this.httpClient.get(`${LANGUAGE_KEY_ENDPOINTS.GET}?itemId=${request.itemId}`);
  };

  fetchBlocksLanguageModules = (): Promise<IModuleGets[]> => {
    return this.httpClient.get(`${LANGUAGE_MODULE_ENDPOINTS.GETS}?_=${Date.now()}`);
  };

  fetchBlocksLanguages = async (): Promise<ILanguageConfig[]> => {
    const url = `${LANGUAGE_ENDPOINTS.GETS}`;
    await ensureLocalizationSession();
    return this.httpClient.get<ILanguageConfig[]>(url);
  };

  saveBlocksLanguageKey = (
    payload: ISaveBlocksLanguageKeyPayload,
  ): Promise<{
    success: boolean;
    errorMessage: string;
    validationErrors: IValidationError[];
  }> => {
    const url = LANGUAGE_KEY_ENDPOINTS.SAVE;
    const updatedPayload = { ...payload, isNewKey: payload.isNewKey ?? false };
    return this.httpClient.post(url, updatedPayload);
  };

  saveBlocksLanguageKeys = (
    payload: ISaveBlocksLanguageKeyPayload[],
  ): Promise<{
    success: boolean;
    errorMessage: string;
    validationErrors: IValidationError[];
  }> => {
    return this.httpClient.post(LANGUAGE_KEY_ENDPOINTS.SAVE_KEYS, payload);
  };

  saveLanguageModule = (payload: {
    moduleName: string;
  }): Promise<{
    errorMessage: null | unknown;
    success: boolean;
    validationErrors: IValidationError[] | null;
  }> => {
    const url = LANGUAGE_MODULE_ENDPOINTS.SAVE;
    return this.httpClient.post(url, payload);
  };

  getLanguageModule = (): Promise<IModuleGets[]> => {
    return this.fetchBlocksLanguageModules();
  };

  deleteLanguageModule(payload: IDeleteModuleRequest): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> {
    const params = new URLSearchParams({
      itemId: payload.itemId,
    });
    if (payload.targetModuleId) {
      params.set("targetModuleId", payload.targetModuleId);
    }
    if (payload.deleteKeys) {
      params.set("deleteKeys", "true");
    }
    return this.httpClient
      .delete<{
        errors: unknown;
        isSuccess: boolean;
      }>(`${LANGUAGE_MODULE_ENDPOINTS.DELETE}?${params.toString()}`)
      .then((response) => response);
  }

  tagGlossary = (
    payload: ITagGlossaryRequest,
  ): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> => {
    return this.httpClient.post(LANGUAGE_MODULE_ENDPOINTS.TAG_GLOSSARY, payload);
  };

  saveLanguage = (payload: {
    languageName: string;
    languageCode: string;
  }): Promise<{
    errorMessage: null | unknown;
    success: boolean;
  }> => {
    const url = LANGUAGE_ENDPOINTS.SAVE;
    return this.httpClient.post(url, payload);
  };

  deleteLanguageKey = (payload: {
    itemId: string;
  }): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> => {
    const url = LANGUAGE_KEY_ENDPOINTS.DELETE;
    const params = new URLSearchParams({
      itemId: payload.itemId,
    });

    return this.httpClient.delete<{
      errors: unknown;
      isSuccess: boolean;
    }>(`${url}?${params.toString()}`);
  };

  deleteLanguageKeys = (payload: {
    itemIds: string[];
  }): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> => {
    const url = LANGUAGE_KEY_ENDPOINTS.DELETE_KEYS;
    const deleteOptions = {
      body: payload,
    } as Parameters<typeof this.httpClient.delete>[2];

    return this.httpClient.delete<{
      errors: unknown;
      isSuccess: boolean;
    }>(url, undefined, deleteOptions);
  };

  translateLanguageKeys = (payload: {
    keyIds: string[];
    defaultLanguage: string;
  }): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> => {
    const url = LANGUAGE_KEY_ENDPOINTS.TRANSLATE_KEYS;
    return this.httpClient.post(url, payload);
  };

  deleteLanguage = (payload: {
    languageName: string;
  }): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> => {
    const url = LANGUAGE_ENDPOINTS.DELETE;
    const params = new URLSearchParams({
      languageName: payload.languageName,
    });

    return this.httpClient
      .delete<{
        errors: unknown;
        isSuccess: boolean;
      }>(`${url}?${params.toString()}`)
      .then((response) => response);
  };

  setDefault = (payload: {
    languageName: string;
  }): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> => {
    const url = LANGUAGE_ENDPOINTS.SET_DEFAULT;
    return this.httpClient.post(url, payload);
  };

  generateUilmFile = (payload: {
    guid: string;
  }): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> => {
    const url = LANGUAGE_KEY_ENDPOINTS.GENERATE_UILM_FILE;
    return this.httpClient.post(url, payload);
  };

  getTranslationSuggestion = (payload: {
    sourceText: string;
    destinationLanguage: string;
    currentLanguage: string;
    /** The source culture; the server matches glossary terms in this language. */
    currentLanguageCode?: string;
    temperature: number;
    /** The key's own context (custom prompt); the server adds the terminology rules. */
    elementDetailContext?: string;
    glossaryIds?: string[];
    moduleId?: string;
    destinationLanguageCode?: string;
  }): Promise<ITranslationSuggestionResponse> => {
    const url = LANGUAGE_ASSISTANT_ENDPOINTS.GET_TRANSLATION_SUGGESTION;
    return this.httpClient.post(url, payload);
  };

  translateAll = (payload: {
    messageCoRelationId: string;
    defaultLanguage: string;
    moduleId?: string;
  }): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> => {
    const url = LANGUAGE_KEY_ENDPOINTS.TRANSLATE_ALL;
    return this.httpClient.post(url, payload);
  };

  translateKey = (payload: {
    keyId: string;
    defaultLanguage: string;
    messageCoRelationId: string;
  }): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> => {
    const url = LANGUAGE_KEY_ENDPOINTS.TRANSLATE_KEY;
    return this.httpClient.post(url, payload);
  };

  importLanguageFile = (payload: IImportFile) => {
    const url = LANGUAGE_KEY_ENDPOINTS.UILM_IMPORT;
    return this.httpClient.post(url, payload);
  };

  saveLanguageKeyUilmExport = (payload: IKeyUilmExport): Promise<IBaseMutationResponse> => {
    const url = LANGUAGE_KEY_ENDPOINTS.UILM_EXPORT;
    return this.httpClient.post<IBaseMutationResponse>(url, payload);
  };

  getKeysTimeline = (payload: {
    pageNumber: number;
    pageSize: number;
    keyId: string;
  }): Promise<IGetTimelineResponse> => {
    const url = `${LANGUAGE_KEY_ENDPOINTS.GET_TIMELINE}?pageSize=${payload.pageSize}&pageNumber=${payload.pageNumber}&EntityId=${payload.keyId}`;

    return this.httpClient.get(url);
  };

  getExportHistory = (payload: {
    pageNumber: number;
    pageSize: number;
    filters: ExportHistoryFilters;
  }): Promise<IGetExportHistory> => {
    const { pageNumber, pageSize, filters } = payload;

    const params = new URLSearchParams({
      PageSize: String(pageSize),
      PageNumber: String(pageNumber),
    });

    if (filters?.searchText) {
      params.append("SearchText", filters.searchText);
    }
    if (filters?.startDate) {
      params.append("CreateDateRange.StartDate", filters.startDate);
    }
    if (filters?.endDate) {
      params.append("CreateDateRange.EndDate", filters.endDate);
    }

    const url = `${LANGUAGE_KEY_ENDPOINTS.GET_EXPORT_HISTORY}?${params.toString()}`;
    return this.httpClient.get(url);
  };

  revertKeyTimeline = (payload: { itemId: string }): Promise<IRollbackResponse> => {
    const url = LANGUAGE_KEY_ENDPOINTS.ROLLBACK;

    return this.httpClient.post(url, payload);
  };

  getLocalizationTimeline = (payload: {
    pageNumber: number;
    pageSize: number;
    userId?: string;
    logFrom?: string;
    logFromValues?: string[];
    excludeLogFromValues?: string[];
    createDateRange?: { startDate?: string; endDate?: string };
  }): Promise<IGetLocalizationTimelineResponse> => {
    const params = new URLSearchParams({
      PageSize: String(payload.pageSize),
      PageNumber: String(payload.pageNumber),
    });

    if (payload.userId) {
      params.append("UserId", payload.userId);
    }
    if (payload.logFrom) {
      params.append("LogFrom", payload.logFrom);
    }
    if (payload.logFromValues) {
      payload.logFromValues.forEach((v) => params.append("LogFromValues", v));
    }
    if (payload.excludeLogFromValues) {
      payload.excludeLogFromValues.forEach((v) => params.append("ExcludeLogFromValues", v));
    }
    if (payload.createDateRange?.startDate) {
      params.append("CreateDateRange.StartDate", payload.createDateRange.startDate);
    }
    if (payload.createDateRange?.endDate) {
      params.append("CreateDateRange.EndDate", payload.createDateRange.endDate);
    }

    const url = `${LANGUAGE_KEY_ENDPOINTS.GET_LOCALIZATION_TIMELINE}?${params.toString()}`;
    return this.httpClient.get(url);
  };

  getTimelineByOperationId = (payload: {
    operationId: string;
    pageNumber: number;
    pageSize: number;
  }): Promise<IGetTimelineByOperationIdResponse> => {
    const params = new URLSearchParams({
      OperationId: payload.operationId,
      PageSize: String(payload.pageSize),
      PageNumber: String(payload.pageNumber),
    });

    const url = `${LANGUAGE_KEY_ENDPOINTS.GET_TIMELINE_BY_OPERATION_ID}?${params.toString()}`;
    return this.httpClient.get(url);
  };

  // Glossary methods

  fetchGlossaries = (request: {
    pageNumber: number;
    pageSize: number;
    searchText?: string;
    isGlobal?: boolean;
    moduleId?: string;
  } & IGlossaryFilters): Promise<IGetGlossariesResponse> => {
    const params = new URLSearchParams({
      PageNumber: String(request.pageNumber),
      PageSize: String(request.pageSize),
    });

    // Sent raw: the server escapes the text and matches it literally.
    if (request.searchText) {
      params.append("SearchText", request.searchText);
    }

    if (request.isGlobal !== undefined) {
      params.append("IsGlobal", String(request.isGlobal));
    }

    if (request.moduleId) {
      params.append("ModuleId", request.moduleId);
    }

    if (request.rule) {
      params.append("Rule", request.rule);
    }

    if (request.status) {
      params.append("Status", request.status);
    }

    if (request.missingTranslation) {
      params.append("MissingTranslation", request.missingTranslation);
    }

    if (request.language) {
      params.append("Language", request.language);
    }

    if (request.type) {
      params.append("Type", request.type);
    }

    if (request.scope) {
      params.append("Scope", request.scope);
    }

    if (request.sortBy) {
      params.append("SortBy", request.sortBy);
    }

    if (request.sortDescending !== undefined) {
      params.append("SortDescending", String(request.sortDescending));
    }

    return this.httpClient.get(`${GLOSSARY_ENDPOINTS.GETS}?${params.toString()}`);
  };

  saveGlossary = (payload: {
    itemId?: string;
    name: string;
    language?: string;
    type?: string;
    context?: string;
    additionalNote?: string;
    isGlobal?: boolean;
    moduleIds?: string[];
    /** The version the edit started from; a newer stored version fails with a `Version` error. */
    version?: number;
    /** Structured terminology; omitted (undefined) fields keep their stored values. */
    rule?: GlossaryRuleDto;
    caseSensitive?: boolean;
    variants?: string[];
    translations?: IGlossaryTranslation[];
    status?: GlossaryStatus;
    /** "" clears; omitted or null keeps the stored value. */
    partOfSpeech?: GlossaryPartOfSpeech | "" | null;
    usageExamples?: string[];
  }): Promise<{
    success: boolean;
    errorMessage: string;
    validationErrors: IValidationError[];
  }> => {
    return this.httpClient.post(GLOSSARY_ENDPOINTS.SAVE, payload);
  };

  deleteGlossary = (payload: {
    itemId: string;
  }): Promise<{
    errors: null | unknown;
    isSuccess: boolean;
  }> => {
    return this.httpClient.delete<{
      errors: unknown;
      isSuccess: boolean;
    }>(`${GLOSSARY_ENDPOINTS.DELETE}?itemId=${payload.itemId}`);
  };

  getSuggestedGlossaries = (request: {
    itemId: string;
    maxResults?: number;
  }): Promise<IGetSuggestedGlossariesResponse> => {
    const params = new URLSearchParams({
      ItemId: request.itemId,
    });
    if (request.maxResults) {
      params.append("MaxResults", String(request.maxResults));
    }
    return this.httpClient.get(
      `${GLOSSARY_ENDPOINTS.GET_SUGGESTED_GLOSSARIES}?${params.toString()}`,
    );
  };

  getGlossaryById = (request: { itemId: string }): Promise<IGlossary> => {
    return this.httpClient.get(`${GLOSSARY_ENDPOINTS.GET}?itemId=${request.itemId}`);
  };

  /** At most `GLOSSARY_BY_IDS_MAX` ids per call; unknown ids are left out of `items`. */
  getGlossariesByIds = (request: { itemIds: string[] }): Promise<IGetGlossariesByIdsResponse> => {
    const params = new URLSearchParams();
    request.itemIds.forEach((itemId) => params.append("itemIds", itemId));
    return this.httpClient.get(`${GLOSSARY_ENDPOINTS.GET_BY_IDS}?${params.toString()}`);
  };

  getGlossaryUsage = (request: {
    itemId: string;
    pageNumber?: number;
    pageSize?: number;
  }): Promise<IGlossaryUsageResponse> => {
    const params = new URLSearchParams({
      itemId: request.itemId,
      pageNumber: String(request.pageNumber ?? 0),
      pageSize: String(request.pageSize ?? 1),
    });
    return this.httpClient.get(`${GLOSSARY_ENDPOINTS.USAGE}?${params.toString()}`);
  };

  matchGlossary = (
    payload: IMatchGlossaryRequest,
    options?: { signal?: AbortSignal },
  ): Promise<IMatchGlossaryResponse> => {
    return this.httpClient.post(GLOSSARY_ENDPOINTS.MATCH, payload, undefined, {
      signal: options?.signal,
    });
  };

  /** Queues a background violation re-check for one term's keys, or every key without `itemId`. */
  recheckGlossary = (request: { itemId?: string } = {}): Promise<IRecheckGlossaryResponse> => {
    const query = request.itemId ? `?itemId=${encodeURIComponent(request.itemId)}` : "";
    return this.httpClient.post(`${GLOSSARY_ENDPOINTS.RECHECK}${query}`, {});
  };

  getWebhook = (): Promise<IWebhookConfig | null> => {
    return this.httpClient.get(CONFIG_ENDPOINTS.GET_WEBHOOK);
  };

  saveWebhook = (
    payload: IWebhookConfig,
  ): Promise<{ success: boolean; errorMessage: string | null }> => {
    return this.httpClient.post(CONFIG_ENDPOINTS.SAVE_WEBHOOK, payload);
  };
}
export const languageManagerService = new LanguageManagerService();
