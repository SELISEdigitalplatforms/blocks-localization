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
  projectKey: string;
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
  | "Full form"
  | "Acronym"
  | "Abbreviation"
  | "Short form"
  | "Phrase"
  | "Variant";

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
  createDate: string;
  lastUpdateDate: string;
}

export interface IGlossaryFormData {
  name: string;
  language?: string;
  type?: string;
  context?: string;
  additionalNote?: string;
}

export interface IGetGlossariesResponse {
  items: IGlossary[];
  totalCount: number;
}

export interface IGetSuggestedGlossariesResponse {
  suggestedGlossaries: IGlossary[];
}
