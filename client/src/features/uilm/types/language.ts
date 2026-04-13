export interface IBlocksLanguageKey {
  itemId: string;
  keyName: string;
  moduleId: string;
  routes?: string[];
  resources: IResource[];
  isPartiallyTranslated: boolean;
  lastUpdateDate: string;
  createDate: string;
  context: string;
}

export interface IResource {
  value: string;
  culture: string;
}

export interface IValidationError {
  propertyName: string;
  errorMessage: string;
  attemptedValue: string;
  customState: string;
  severity: number;
  errorCode: string;
  formattedMessagePlaceholderValues: Record<string, string>;
}

export interface ILanguageModule {
  moduleName: string;
  itemId: string;
}

export interface ILanguageConfig {
  itemId: string;
  languageName: string;
  languageCode: string;
  isDefault?: boolean;
}

export interface IExportFileDetails {
  fileId: string;
  fileName: string;
  createDate: string;
  createdBy: string;
}

export interface IGetExportHistory {
  totalCount: number;
  uilmExportedFiles: Array<IExportFileDetails>;
}

export type ExportHistoryFilters = {
  searchText?: string;
  startDate?: string;
  endDate?: string;
};

export type SaveKeyPayload = {
  itemId: string;
  keyName: string;
  moduleId: string;
  resources: { value: string; culture: string }[];
  routes: string[];
  isPartiallyTranslated: boolean;
  projectKey: string;
  isNewKey?: boolean;
  context?: string;
};

export interface IRollbackResponse {
  errors: null | string;
  isSuccess: boolean;
}

export interface ILocalizationTimelineEntry {
  operationId: string;
  logFrom: string;
  userName: string;
  userId: string;
  createDate: string;
  affectedKeysCount: number;
  currentData?: IBlocksLanguageKey;
  previousData?: IBlocksLanguageKey;
}

export interface IGetLocalizationTimelineResponse {
  totalCount: number;
  operations: ILocalizationTimelineEntry[];
}

export interface IGetTimelineByOperationIdResponse {
  totalCount: number;
  timelines: Array<{
    itemId: string;
    operationId: string;
    logFrom: string;
    userName: string;
    createDate: string;
    userId: string;
    previousData?: IBlocksLanguageKey;
    currentData?: IBlocksLanguageKey;
  }>;
}

export interface IGetTimelineResponse {
  totalCount: number;
  timelines: Array<{
    itemId: string;
    logFrom: string;
    userName: string;
    createDate: string;
    userId: string;
    previousData?: IBlocksLanguageKey;
    currentData?: IBlocksLanguageKey;
  }>;
}

export interface TimelineEvents {
  id: string;
  date: string;
  time: string;
  description: string;
  previousData?: IBlocksLanguageKey;
  currentData?: IBlocksLanguageKey;
  logFrom: string;
  userId: string;
}

/** Payload for `Key/UilmImport` — matches `@blocks-localization` `IImportFile`. */
export interface IImportFile {
  messageCoRelationId: string;
  fileId: string;
  projectKey: string;
}

/** Payload for `Key/UilmExport` — matches `@blocks-localization` `IKeyUilmExport`. */
export interface IKeyUilmExport {
  outputType: number;
  messageCoRelationId: string;
  appIds: string[];
  languages: string[];
  referenceFileId: string;
  callerTenantId: string;
  startDate?: string;
  endDate?: string;
  projectKey: string;
}
