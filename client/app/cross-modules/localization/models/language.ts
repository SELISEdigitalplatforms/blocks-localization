/** UILM export SSE payload shape (self-contained for Vite client). */
export interface IUilmExportNotificationMessage {
  denormalizedPayload: string | { Message?: string; FileId?: string; fileId?: string };
}

export type LanguageKeys = { en?: string; de?: string; fr?: string };

export type ILanguage = {
  id: string;
  key: string;
  module: string;
  pages?: string[];
  translation?: LanguageKeys;
  lastModified: string;
  createdOn: string;
};

export interface IBlocksLanguageKey {
  itemId: string;
  keyName: string;
  moduleId: string;
  routes?: string[];
  glossaryIds?: string[];
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

/** Key/Gets response. `totalCount` is null only when the request set `includeTotalCount: false`. */
export interface IBlocksLanguageKeyResponse {
  totalCount: number | null;
  keys: IBlocksLanguageKey[];
  /** Keyset token for the rows after this page; null on the last page. */
  nextCursor?: string | null;
  hasMore?: boolean;
  /** True when the duplicates filter was on and the duplicate rows exceeded the server's cap. */
  duplicatesTruncated?: boolean;
}

export interface ISaveBlocksLanguageKeyPayload {
  itemId: string;
  keyName: string;
  moduleId: string;
  resources: IResource[];
  routes: string[];
  glossaryIds?: string[];
  isPartiallyTranslated: boolean;
  isNewKey?: boolean;
  context?: string;
}

/** Duplicate keys (same module and key name) and duplicate module names for the tenant. */
export interface IDuplicateSummary {
  keyGroupCount: number;
  duplicateKeyRowCount: number;
  extraKeyCount: number;
  moduleGroupCount: number;
  extraModuleCount: number;
  keyUniquenessEnforced: boolean;
  moduleUniquenessEnforced: boolean;
}

export interface IEnforceUniquenessResult {
  keyUniquenessEnforced: boolean;
  moduleUniquenessEnforced: boolean;
  keyGroupCount: number;
  moduleGroupCount: number;
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

export type ILanguageConfig = {
  itemId: string;
  languageName: string;
  languageCode: string;
  isDefault?: boolean;
};

export interface IWebhookSecret {
  secret: string;
  headerKey: string;
}

export interface IWebhookConfig {
  itemId?: string;
  projectKey?: string;
  url: string;
  contentType: string;
  blocksWebhookSecret: IWebhookSecret;
  isDisabled: boolean;
}

export type TimelineEvents = {
  id: string;
  date: string;
  time: string;
  description: string;
  currentData?: IBlocksLanguageKey[];
  previousData?: IBlocksLanguageKey[];
  logFrom?: string;
};

export const modules = [
  {
    value: "UILM Tool",
    label: "UILM Tool",
  },
  {
    value: "Commission",
    label: "Commission",
  },
  {
    value: "Performance",
    label: "Performance",
  },
  {
    value: "Resource Centre",
    label: "Resource Centre",
  },
];

export const translation = [
  {
    value: "No_translation",
    label: "No translation",
  },
  {
    value: "Complete",
    label: "Complete",
  },
];

export interface IImportFile {
  messageCoRelationId: string;
  fileId: string;
  projectKey?: string;
}

export interface ILanguageImportRequest {
  correlationId: string;
  fileName: string;
}

export interface IModuleGets {
  moduleName: string;
  name: string | null;
  itemId: string;
  createDate: string;
  lastUpdateDate: string;
  createdBy: string | null;
  lastUpdatedBy: string | null;
  tenantId: string;
}

export interface IDeleteModuleRequest {
  itemId: string;
  targetModuleId?: string;
  deleteKeys?: boolean;
}

export interface ITagGlossaryRequest {
  moduleId: string;
  glossaryIds: string[];
  projectKey?: string;
}

export interface IKeyUilmExport {
  outputType: number;
  messageCoRelationId: string;
  appIds: string[];
  languages: string[];
  referenceFileId: string;
  callerTenantId: string;
  startDate?: string;
  endDate?: string;
}

export interface IBaseMutationResponse {
  errors: null | unknown;
  isSuccess: boolean;
}

export interface IGetTimelineResponse {
  totalCount: number;
  timelines: Array<{
    itemId: string;
    logFrom: string;
    userName: string;
    createDate: string;
    userId: string;
    previousData?: IBlocksLanguageKey[];
    currentData?: IBlocksLanguageKey[];
  }>;
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

export interface IRollbackResponse {
  errors: null | string;
  isSuccess: boolean;
}

export interface IUilmExportNotificationData {
  message: IUilmExportNotificationMessage;
  FileId: string;
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

// Glossary types

export type GlossaryType =
  "Full form" | "Acronym" | "Abbreviation" | "Short form" | "Phrase" | "Variant";

export const GLOSSARY_TYPE_OPTIONS: { value: GlossaryType; label: string }[] = [
  { value: "Full form", label: "Full form" },
  { value: "Acronym", label: "Acronym" },
  { value: "Abbreviation", label: "Abbreviation" },
  { value: "Short form", label: "Short form" },
  { value: "Phrase", label: "Phrase" },
  { value: "Variant", label: "Variant" },
];

export interface IGlossary {
  itemId: string;
  name: string;
  language?: string;
  type?: string;
  context?: string;
  additionalNote?: string;
  isGlobal?: boolean;
  moduleIds?: string[];
  createDate: string;
  lastUpdateDate: string;
  /** Optimistic-concurrency version (0 for terms saved before versioning). */
  version?: number;
}

export interface IGetGlossariesResponse {
  items: IGlossary[];
  totalCount: number;
}

export interface IGetSuggestedGlossariesResponse {
  suggestedGlossaries: IGlossary[];
}
