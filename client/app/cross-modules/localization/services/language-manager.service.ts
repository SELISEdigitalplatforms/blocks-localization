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
  IGetExportHistory,
  IGlossary,
  IGetGlossariesResponse,
  IGetSuggestedGlossariesResponse,
  IGetLocalizationTimelineResponse,
  IGetTimelineByOperationIdResponse,
  IGetTimelineResponse,
  IImportFile,
  IBaseMutationResponse,
  IKeyUilmExport,
  ILanguageConfig,
  IDeleteModuleRequest,
  IModuleGets,
  IRollbackResponse,
  ITagGlossaryRequest,
  IValidationError,
  IWebhookConfig,
} from "@blocks-localization/models/language";

export class LanguageManagerService {
  private readonly httpClient = serviceInstances.localizationService;
  fetchBlocksLanguageKey = (request: {
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
  }): Promise<{ totalCount: number; keys: IBlocksLanguageKey[] }> => {
    const url = LANGUAGE_KEY_ENDPOINTS.GETS;
    const payload = { ...request };
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
    return this.httpClient.post(url, payload);
  };

  fetchBlocksLanguageKeyById = (request: {
    itemId: string;
  }): Promise<IBlocksLanguageKey> => {
    return this.httpClient.get(
      `${LANGUAGE_KEY_ENDPOINTS.GET}?itemId=${request.itemId}`,
    );
  };

  fetchBlocksLanguageModules = (): Promise<IModuleGets[]> => {
    return this.httpClient.get(`${LANGUAGE_MODULE_ENDPOINTS.GETS}`);
  };

  fetchBlocksLanguages = async (): Promise<ILanguageConfig[]> => {
    const url = `${LANGUAGE_ENDPOINTS.GETS}`;
    await ensureLocalizationSession();
    return this.httpClient.get<ILanguageConfig[]>(url);
  };

  saveBlocksLanguageKey = (payload: {
    itemId: string;
    keyName: string;
    moduleId: string;
    resources: {
      value: string;
      culture: string;
    }[];
    routes: string[];
    glossaryIds?: string[];
    isPartiallyTranslated: boolean;
    isNewKey?: boolean;
    context?: string;
  }): Promise<{
    success: boolean;
    errorMessage: string;
    validationErrors: IValidationError[];
  }> => {
    const url = LANGUAGE_KEY_ENDPOINTS.SAVE;
    const updatedPayload = { ...payload, isNewKey: payload.isNewKey ?? false };
    return this.httpClient.post(url, updatedPayload);
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
    return this.httpClient.post(
      LANGUAGE_MODULE_ENDPOINTS.TAG_GLOSSARY,
      payload,
    );
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
    temperature: number;
    // elementDetailContext: string;
    glossaryIds?: string[];
    moduleId?: string;
    destinationLanguageCode?: string;
  }): Promise<{
    content: string;
    errors: null | unknown;
    isSuccess: boolean;
  }> => {
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

  saveLanguageKeyUilmExport = (
    payload: IKeyUilmExport,
  ): Promise<IBaseMutationResponse> => {
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

  revertKeyTimeline = (payload: {
    itemId: string;
  }): Promise<IRollbackResponse> => {
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
      payload.excludeLogFromValues.forEach((v) =>
        params.append("ExcludeLogFromValues", v),
      );
    }
    if (payload.createDateRange?.startDate) {
      params.append(
        "CreateDateRange.StartDate",
        payload.createDateRange.startDate,
      );
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
  }): Promise<IGetGlossariesResponse> => {
    const params = new URLSearchParams({
      PageNumber: String(request.pageNumber),
      PageSize: String(request.pageSize),
    });

    if (request.searchText) {
      params.append("SearchText", request.searchText);
    }

    if (request.isGlobal !== undefined) {
      params.append("IsGlobal", String(request.isGlobal));
    }

    if (request.moduleId) {
      params.append("ModuleId", request.moduleId);
    }

    return this.httpClient.get(
      `${GLOSSARY_ENDPOINTS.GETS}?${params.toString()}`,
    );
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
    return this.httpClient.get(
      `${GLOSSARY_ENDPOINTS.GET}?itemId=${request.itemId}`,
    );
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
