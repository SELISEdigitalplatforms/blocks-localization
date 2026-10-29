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
  /** Rule violations the server stored for this key (per culture); recomputed on save. */
  glossaryViolations?: IKeyGlossaryViolation[];
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
  /** Structured terminology, resolved by the server (also for terms not yet migrated). */
  rule?: GlossaryRuleDto;
  caseSensitive?: boolean;
  variants?: string[];
  translations?: IGlossaryTranslation[];
  status?: GlossaryStatus;
  /** 0 = legacy (terminology in `additionalNote`), 2 = structured fields stored. */
  schemaVersion?: number;
  /** Merge-on-omit like the structured fields: a save without them keeps the stored values. */
  partOfSpeech?: GlossaryPartOfSpeech | null;
  usageExamples?: string[] | null;
}

export type GlossaryPartOfSpeech = "noun" | "verb" | "adjective" | "adverb" | "phrase" | "other";

export const GLOSSARY_PARTS_OF_SPEECH: readonly GlossaryPartOfSpeech[] = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "phrase",
  "other",
];

export const GLOSSARY_PART_OF_SPEECH_LABELS: Record<GlossaryPartOfSpeech, string> = {
  noun: "Noun",
  verb: "Verb",
  adjective: "Adjective",
  adverb: "Adverb",
  phrase: "Phrase",
  other: "Other",
};

export type GlossaryRuleDto = "translate" | "keep" | "forbidden";

export type GlossaryStatus = "draft" | "approved" | "deprecated";

export const GLOSSARY_STATUSES: readonly GlossaryStatus[] = ["draft", "approved", "deprecated"];

export interface IGlossaryTranslation {
  language: string;
  value: string;
  forbiddenValues: string[];
}

export type GlossaryViolationKindDto = "missing-translation" | "missing-keep" | "forbidden-used";

/** A violation stored on a key by the server (Translate All or Key/Save recompute). */
export interface IKeyGlossaryViolation {
  culture: string;
  glossaryId: string;
  term: string;
  kind: GlossaryViolationKindDto;
  expected?: string;
  found?: string;
  detectedAt: string;
}

/** A term the server's prompt applied to a suggestion; `expected` only under Translate. */
export interface IAppliedTerm {
  glossaryId: string;
  term: string;
  rule: GlossaryRuleDto;
  expected?: string;
}

/** A violation in a suggestion response (no culture: it is the requested target). */
export interface IGlossaryViolationDto {
  glossaryId: string;
  term: string;
  kind: GlossaryViolationKindDto;
  expected?: string;
  found?: string;
}

export interface IGlossaryFilters {
  rule?: GlossaryRuleDto;
  status?: GlossaryStatus;
  /** Culture code: Translate terms without a translation for it. */
  missingTranslation?: string;
  /** Culture code of the term's own language. */
  language?: string;
  /** Exact type, case-insensitive. */
  type?: string;
  scope?: GlossaryScopeFilter;
  sortBy?: GlossarySortBy;
  /** Server default: true for dates, false for name. */
  sortDescending?: boolean;
}

/** `project` = whole project; `modules` = tagged to specific modules. */
export type GlossaryScopeFilter = "project" | "modules";

export type GlossarySortBy = "name" | "createDate" | "lastUpdateDate";

export interface IRecheckGlossaryResponse {
  /** False when a re-check for the tenant is already queued, or the server flag is off. */
  queued: boolean;
}

export interface IGetGlossariesByIdsResponse {
  items: IGlossary[];
}

export interface IGlossaryUsageResponse {
  keyCount: number;
  keys: { itemId: string; keyName: string; moduleId: string }[];
  moduleIds: string[];
  violationKeyCount: number;
}

export type GlossaryMatchScope = "key" | "module" | "global" | "other";

/** One `/Glossary/Match` hit; `start`/`length` are UTF-16 offsets into the request text. */
export interface IGlossaryMatchDto {
  glossaryId: string;
  start: number;
  length: number;
  surface: string;
  term: string;
  rule: GlossaryRuleDto;
  status: GlossaryStatus;
  caseSensitive: boolean;
  scope: GlossaryMatchScope;
  definition: string;
  /** Only the values active under the term's rule. */
  translations: IGlossaryTranslation[];
  partOfSpeech?: GlossaryPartOfSpeech | null;
  usageExamples?: string[] | null;
}

export interface IMatchGlossaryRequest {
  text: string;
  language: string;
  moduleId?: string;
  keyId?: string;
  glossaryIds?: string[];
  mode?: "applicable" | "all";
}

export interface IMatchGlossaryResponse {
  matches: IGlossaryMatchDto[];
}

export interface ITranslationSuggestionResponse {
  content: string;
  appliedTerms?: IAppliedTerm[];
  glossaryViolations?: IGlossaryViolationDto[];
  errors: null | unknown;
  isSuccess: boolean;
}

export interface IGetGlossariesResponse {
  items: IGlossary[];
  totalCount: number;
}

export interface IGetSuggestedGlossariesResponse {
  suggestedGlossaries: IGlossary[];
}
