import { uilmIdpOptions } from "@/features/uilm/lib/uilm-api-base";
import { idpDelete, idpGet, idpPostJson } from "@/platform/api/idp-http";
import { LANGUAGE_ASSISTANT_ENDPOINTS, LANGUAGE_ENDPOINTS, LANGUAGE_KEY_ENDPOINTS, LANGUAGE_MODULE_ENDPOINTS } from "@/features/uilm/constants/endpoints";
import type {
  ExportHistoryFilters,
  IBlocksLanguageKey,
  IGetExportHistory,
  IGetLocalizationTimelineResponse,
  IGetTimelineByOperationIdResponse,
  IGetTimelineResponse,
  IImportFile,
  IKeyUilmExport,
  ILanguageConfig,
  ILanguageModule,
  IRollbackResponse,
  IValidationError,
  SaveKeyPayload,
} from "@/features/uilm/types/language";

type FetchKeysRequest = {
  projectKey: string;
  pageNumber: number;
  pageSize: number;
  searchKey: string;
  moduleIds: string[];
  isPartiallyTranslated: boolean;
  sortProperty: string;
  isDescending: boolean;
  createDateRange?: { startDate?: string; endDate?: string };
  lastUpdateDateRange?: { startDate?: string; endDate?: string };
  resourceSearchFilters?: { culture: string; searchText: string }[];
};

function stripEmptyRanges<T extends FetchKeysRequest>(request: T): Omit<T, never> {
  const payload = { ...request };
  if (!request.createDateRange) {
    delete payload.createDateRange;
  } else if (payload.createDateRange?.startDate === "") {
    delete payload.createDateRange.startDate;
  } else if (payload.createDateRange?.endDate === "") {
    delete payload.createDateRange.endDate;
  }
  if (!request.lastUpdateDateRange) {
    delete payload.lastUpdateDateRange;
  } else if (payload.lastUpdateDateRange?.startDate === "") {
    delete payload.lastUpdateDateRange.startDate;
  } else if (payload.lastUpdateDateRange?.endDate === "") {
    delete payload.lastUpdateDateRange.endDate;
  }
  return payload;
}

class LanguageManagerService {
  fetchBlocksLanguageKey = (request: FetchKeysRequest): Promise<{ totalCount: number; keys: IBlocksLanguageKey[] }> => {
    return idpPostJson(LANGUAGE_KEY_ENDPOINTS.GETS, stripEmptyRanges(request), uilmIdpOptions());
  };

  fetchBlocksLanguageKeyById = (request: { projectKey: string; itemId: string }): Promise<IBlocksLanguageKey> => {
    const q = `projectKey=${encodeURIComponent(request.projectKey)}&itemId=${encodeURIComponent(request.itemId)}`;
    return idpGet(`${LANGUAGE_KEY_ENDPOINTS.GET}?${q}`, uilmIdpOptions());
  };

  fetchBlocksLanguageModules = (projectKey: string): Promise<ILanguageModule[]> => {
    return idpGet(`${LANGUAGE_MODULE_ENDPOINTS.GETS}?projectKey=${encodeURIComponent(projectKey)}`, uilmIdpOptions());
  };

  fetchBlocksLanguages = (projectKey: string): Promise<ILanguageConfig[]> => {
    return idpGet(`${LANGUAGE_ENDPOINTS.GETS}?projectKey=${encodeURIComponent(projectKey)}`, uilmIdpOptions());
  };

  saveBlocksLanguageKey = (
    payload: SaveKeyPayload,
  ): Promise<{ success: boolean; errorMessage: string; validationErrors: IValidationError[] }> => {
    const body = { ...payload, isNewKey: payload.isNewKey ?? false };
    return idpPostJson(LANGUAGE_KEY_ENDPOINTS.SAVE, body, uilmIdpOptions());
  };

  deleteLanguageKey = (payload: { itemId: string; projectKey: string }): Promise<{ errors: unknown; isSuccess: boolean }> => {
    const url = `${LANGUAGE_KEY_ENDPOINTS.DELETE}?itemId=${encodeURIComponent(payload.itemId)}&projectKey=${encodeURIComponent(payload.projectKey)}`;
    return idpDelete(url, uilmIdpOptions());
  };

  saveLanguageModule = (payload: {
    moduleName: string;
    projectKey: string;
  }): Promise<{ errorMessage: null | unknown; success: boolean; validationErrors: IValidationError[] | null }> => {
    return idpPostJson(LANGUAGE_MODULE_ENDPOINTS.SAVE, payload, uilmIdpOptions());
  };

  saveLanguage = (payload: {
    languageName: string;
    languageCode: string;
    projectKey: string;
  }): Promise<{ errorMessage: null | unknown; success: boolean }> => {
    return idpPostJson(LANGUAGE_ENDPOINTS.SAVE, payload, uilmIdpOptions());
  };

  deleteLanguage = (payload: { languageName: string; projectKey: string }): Promise<{ errors: unknown; isSuccess: boolean }> => {
    const url = `${LANGUAGE_ENDPOINTS.DELETE}?languageName=${encodeURIComponent(payload.languageName)}&projectKey=${encodeURIComponent(payload.projectKey)}`;
    return idpDelete(url, uilmIdpOptions());
  };

  setDefault = (payload: {
    languageName: string;
    projectKey: string;
  }): Promise<{ errors: null | unknown; isSuccess: boolean }> => {
    return idpPostJson(LANGUAGE_ENDPOINTS.SET_DEFAULT, payload, uilmIdpOptions());
  };

  getExportHistory = (payload: {
    projectKey: string;
    pageNumber: number;
    pageSize: number;
    filters: ExportHistoryFilters;
  }): Promise<IGetExportHistory> => {
    const { projectKey, pageNumber, pageSize, filters } = payload;
    const params = new URLSearchParams({
      PageSize: String(pageSize),
      PageNumber: String(pageNumber),
      ProjectKey: projectKey,
    });
    if (filters?.searchText) params.append("SearchText", filters.searchText);
    if (filters?.startDate) params.append("CreateDateRange.StartDate", filters.startDate);
    if (filters?.endDate) params.append("CreateDateRange.EndDate", filters.endDate);
    return idpGet(`${LANGUAGE_KEY_ENDPOINTS.GET_EXPORT_HISTORY}?${params.toString()}`, uilmIdpOptions());
  };

  generateUilmFile = (payload: {
    guid: string;
    projectKey: string;
  }): Promise<{ errors: null | unknown; isSuccess: boolean }> => {
    return idpPostJson(LANGUAGE_KEY_ENDPOINTS.GENERATE_UILM_FILE, payload, uilmIdpOptions());
  };

  importLanguageFile = (payload: IImportFile): Promise<{ errors: null | unknown; isSuccess: boolean }> => {
    return idpPostJson(LANGUAGE_KEY_ENDPOINTS.UILM_IMPORT, payload, uilmIdpOptions());
  };

  saveLanguageKeyUilmExport = (payload: IKeyUilmExport): Promise<{ errors: null | unknown; isSuccess: boolean }> => {
    return idpPostJson(LANGUAGE_KEY_ENDPOINTS.UILM_EXPORT, payload, uilmIdpOptions());
  };

  getLocalizationTimeline = (payload: {
    projectKey: string;
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
      ProjectKey: payload.projectKey,
    });
    if (payload.userId) params.append("UserId", payload.userId);
    if (payload.logFrom) params.append("LogFrom", payload.logFrom);
    payload.logFromValues?.forEach((v) => params.append("LogFromValues", v));
    payload.excludeLogFromValues?.forEach((v) => params.append("ExcludeLogFromValues", v));
    if (payload.createDateRange?.startDate) {
      params.append("CreateDateRange.StartDate", payload.createDateRange.startDate);
    }
    if (payload.createDateRange?.endDate) {
      params.append("CreateDateRange.EndDate", payload.createDateRange.endDate);
    }
    return idpGet(`${LANGUAGE_KEY_ENDPOINTS.GET_LOCALIZATION_TIMELINE}?${params.toString()}`, uilmIdpOptions());
  };

  getTimelineByOperationId = (payload: {
    operationId: string;
    projectKey: string;
    pageNumber: number;
    pageSize: number;
  }): Promise<IGetTimelineByOperationIdResponse> => {
    const params = new URLSearchParams({
      OperationId: payload.operationId,
      PageSize: String(payload.pageSize),
      PageNumber: String(payload.pageNumber),
      ProjectKey: payload.projectKey,
    });
    return idpGet(`${LANGUAGE_KEY_ENDPOINTS.GET_TIMELINE_BY_OPERATION_ID}?${params.toString()}`, uilmIdpOptions());
  };

  revertKeyTimeline = (payload: { itemId: string; projectKey: string }): Promise<IRollbackResponse> => {
    return idpPostJson(LANGUAGE_KEY_ENDPOINTS.ROLLBACK, payload, uilmIdpOptions());
  };

  getTranslationSuggestion = (payload: {
    sourceText: string;
    destinationLanguage: string;
    currentLanguage: string;
    temperature: number;
    elementDetailContext: string;
  }): Promise<{ content: string; errors: null | unknown; isSuccess: boolean }> => {
    return idpPostJson(LANGUAGE_ASSISTANT_ENDPOINTS.GET_TRANSLATION_SUGGESTION, payload, uilmIdpOptions());
  };

  translateAll = (payload: {
    projectKey: string;
    messageCoRelationId: string;
    defaultLanguage: string;
    moduleId?: string;
  }): Promise<{ errors: null | unknown; isSuccess: boolean }> => {
    return idpPostJson(LANGUAGE_KEY_ENDPOINTS.TRANSLATE_ALL, payload, uilmIdpOptions());
  };

  translateKey = (payload: {
    keyId: string;
    projectKey: string;
    defaultLanguage: string;
    messageCoRelationId: string;
  }): Promise<{ errors: null | unknown; isSuccess: boolean }> => {
    return idpPostJson(LANGUAGE_KEY_ENDPOINTS.TRANSLATE_KEY, payload, uilmIdpOptions());
  };

  getKeysTimeline = (payload: {
    pageNumber: number;
    pageSize: number;
    keyId: string;
    projectKey: string;
  }): Promise<IGetTimelineResponse> => {
    const url = `${LANGUAGE_KEY_ENDPOINTS.GET_TIMELINE}?pageSize=${payload.pageSize}&pageNumber=${payload.pageNumber}&projectKey=${encodeURIComponent(payload.projectKey)}&EntityId=${encodeURIComponent(payload.keyId)}`;
    return idpGet(url, uilmIdpOptions());
  };
}

export const languageManagerService = new LanguageManagerService();
