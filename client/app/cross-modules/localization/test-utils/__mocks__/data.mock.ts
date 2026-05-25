import {
  TEST_PROJECT_KEY,
  TEST_TENANT_ID,
  mockDeleteSuccessResponse,
} from "@/test-utils/__mocks__/data.mock";
import {
  ExportHistoryFilters,
  IBlocksLanguageKey,
  IGetExportHistory,
  IGetTimelineResponse,
  IImportFile,
  IKeyUilmExport,
  ILanguageConfig,
  ILanguageModule,
  IModuleGets,
  IRollbackResponse,
  IValidationError,
} from "../../models/language";

export { mockDeleteSuccessResponse };

// ─── Mock IDs ─────────────────────────────────────────────────────────────────

const MOCK_MODULE_ID_1 = "c1a2-1e6b-8f3d-7c04";
const MOCK_MODULE_ID_2 = "d7b4-2f7c-9a4e-8d15";
const MOCK_LANG_ID_1 = "e3c6-3a8d-0b5f-9e26";
const MOCK_LANG_ID_2 = "f9d8-4b9e-1c6a-0f37";
const MOCK_LANG_ID_3 = "a5e0-5c0f-2d7b-1a48";
const MOCK_LANG_KEY_ID_1 = "b1f2-6d1a-3e8c-2b59";
const MOCK_LANG_KEY_ID_2 = "c7a4-7e2b-4f9d-3c60";
const MOCK_TIMELINE_ID_1 = "d3b6-8f3c-5a0e-4d71";
const MOCK_LOC_USER_ID = "e9c8-9a4d-6b1f-5e82";
const MOCK_EXPORT_FILE_ID = "f5d0-0b5e-7c2a-6f93";
const MOCK_IMPORT_FILE_ID = "a1e2-1c6f-8d3b-7a04";
const MOCK_CORR_ID_1 = "b7f4-2d7a-9e4c-8b15";
const MOCK_CORR_ID_2 = "c3a6-3e8b-0f5d-9c26";
const MOCK_CORR_ID_3 = "d9b8-4f9c-1a6e-0d37";
const MOCK_APP_ID = "e5c0-5a0d-2b7f-1e48";
const MOCK_REF_FILE_ID = "f1d2-6b1e-3c8a-2f59";
const MOCK_UILM_GUID = "a7e4-7c2f-4d9b-3a60";

// ─── Language Modules ─────────────────────────────────────────────────────────

export const mockLanguageModule: ILanguageModule = {
  moduleName: "Common",
  itemId: MOCK_MODULE_ID_1,
};

export const mockLanguageModule2: ILanguageModule = {
  moduleName: "Dashboard",
  itemId: MOCK_MODULE_ID_2,
};

export const mockLanguageModuleList: ILanguageModule[] = [mockLanguageModule, mockLanguageModule2];

export const mockModuleGets: IModuleGets = {
  moduleName: "Common",
  name: null,
  itemId: MOCK_MODULE_ID_1,
  createDate: "2024-01-01T10:00:00Z",
  lastUpdateDate: "2024-01-15T14:30:00Z",
  createdBy: null,
  lastUpdatedBy: null,
  tenantId: TEST_TENANT_ID,
};

export const mockModuleGetsList: IModuleGets[] = [mockModuleGets];

// ─── Language Configs ─────────────────────────────────────────────────────────

export const mockLanguageConfig: ILanguageConfig = {
  itemId: MOCK_LANG_ID_1,
  languageName: "English",
  languageCode: "en",
  isDefault: true,
};

export const mockLanguageConfig2: ILanguageConfig = {
  itemId: MOCK_LANG_ID_2,
  languageName: "German",
  languageCode: "de",
  isDefault: false,
};

export const mockLanguageConfig3: ILanguageConfig = {
  itemId: MOCK_LANG_ID_3,
  languageName: "French",
  languageCode: "fr",
  isDefault: false,
};

export const mockLanguageConfigList: ILanguageConfig[] = [
  mockLanguageConfig,
  mockLanguageConfig2,
  mockLanguageConfig3,
];

export const mockEmptyLanguageConfigList: ILanguageConfig[] = [];

// ─── Language Keys ────────────────────────────────────────────────────────────

export const mockBlocksLanguageKey: IBlocksLanguageKey = {
  itemId: MOCK_LANG_KEY_ID_1,
  keyName: "common.save",
  moduleId: MOCK_MODULE_ID_1,
  routes: ["/services/language"],
  resources: [
    { value: "Save", culture: "en" },
    { value: "Speichern", culture: "de" },
    { value: "Enregistrer", culture: "fr" },
  ],
  isPartiallyTranslated: false,
  lastUpdateDate: "2024-01-15T14:30:00Z",
  createDate: "2024-01-01T10:00:00Z",
  context: "Button label for saving",
};

export const mockBlocksLanguageKey2: IBlocksLanguageKey = {
  itemId: MOCK_LANG_KEY_ID_2,
  keyName: "common.cancel",
  moduleId: MOCK_MODULE_ID_1,
  routes: [],
  resources: [
    { value: "Cancel", culture: "en" },
    { value: "Abbrechen", culture: "de" },
    { value: "", culture: "fr" },
  ],
  isPartiallyTranslated: true,
  lastUpdateDate: "2024-02-01T10:00:00Z",
  createDate: "2024-01-10T10:00:00Z",
  context: "",
};

export const mockLanguageKeysResponse = {
  totalCount: 2,
  keys: [mockBlocksLanguageKey, mockBlocksLanguageKey2],
};

export const mockEmptyLanguageKeysResponse = {
  totalCount: 0,
  keys: [],
};

// ─── Timeline ─────────────────────────────────────────────────────────────────

export const mockTimelineEntry = {
  itemId: MOCK_TIMELINE_ID_1,
  logFrom: "User",
  userName: "john.doe@example.com",
  createDate: "2024-01-15T14:30:00Z",
  userId: MOCK_LOC_USER_ID,
  previousData: [mockBlocksLanguageKey],
  currentData: [mockBlocksLanguageKey],
};

export const mockGetTimelineResponse: IGetTimelineResponse = {
  totalCount: 1,
  timelines: [mockTimelineEntry],
};

export const mockEmptyTimelineResponse: IGetTimelineResponse = {
  totalCount: 0,
  timelines: [],
};

// ─── Export History ───────────────────────────────────────────────────────────

export const mockExportFileDetails = {
  fileId: MOCK_EXPORT_FILE_ID,
  fileName: "export_2024_01_15.xlsx",
  createDate: "2024-01-15T14:30:00Z",
  createdBy: "john.doe@example.com",
};

export const mockGetExportHistory: IGetExportHistory = {
  totalCount: 1,
  uilmExportedFiles: [mockExportFileDetails],
};

export const mockEmptyExportHistory: IGetExportHistory = {
  totalCount: 0,
  uilmExportedFiles: [],
};

export const mockExportHistoryFilters: ExportHistoryFilters = {
  searchText: "export",
  startDate: "2024-01-01T00:00:00Z",
  endDate: "2024-01-31T23:59:59Z",
};

// ─── Import File ──────────────────────────────────────────────────────────────

export const mockImportFile: IImportFile = {
  messageCoRelationId: MOCK_CORR_ID_1,
  fileId: MOCK_IMPORT_FILE_ID,
  projectKey: TEST_PROJECT_KEY,
};

// ─── Key UILM Export ──────────────────────────────────────────────────────────

export const mockKeyUilmExport: IKeyUilmExport = {
  outputType: 1,
  messageCoRelationId: MOCK_CORR_ID_2,
  appIds: [MOCK_APP_ID],
  languages: ["en", "de"],
  referenceFileId: MOCK_REF_FILE_ID,
  callerTenantId: TEST_TENANT_ID,
  projectKey: TEST_PROJECT_KEY,
};

// ─── Success / Error Responses ────────────────────────────────────────────────

const mockValidationError: IValidationError = {
  propertyName: "",
  errorMessage: "",
  attemptedValue: "",
  customState: "",
  severity: 0,
  errorCode: "",
  formattedMessagePlaceholderValues: {},
};

export const mockSuccessResponse = {
  success: true,
  errorMessage: "",
  validationErrors: [] as IValidationError[],
};

export const mockErrorResponse = {
  success: false,
  errorMessage: "Operation failed",
  validationErrors: [
    { ...mockValidationError, errorMessage: "Invalid key name" },
  ] as IValidationError[],
};

export const mockRollbackResponse: IRollbackResponse = {
  errors: null,
  isSuccess: true,
};

export const mockLanguageDeleteResponse = {
  errors: null,
  isSuccess: true,
};

// ─── Request Payloads ─────────────────────────────────────────────────────────

export const mockFetchLanguageKeysPayload = {
  projectKey: TEST_PROJECT_KEY,
  pageNumber: 1,
  pageSize: 10,
  searchKey: "",
  moduleIds: [] as string[],
  isPartiallyTranslated: false,
  sortProperty: "",
  isDescending: false,
};

export const mockSaveLanguageKeyPayload = {
  itemId: "",
  keyName: "common.new",
  moduleId: MOCK_MODULE_ID_1,
  resources: [
    { value: "New", culture: "en" },
    { value: "Neu", culture: "de" },
  ],
  routes: ["/services/language"],
  isPartiallyTranslated: false,
  projectKey: TEST_PROJECT_KEY,
  isNewKey: true,
};

export const mockSaveLanguageModulePayload = {
  moduleName: "New Module",
  projectKey: TEST_PROJECT_KEY,
};

export const mockSaveLanguagePayload = {
  languageName: "Spanish",
  languageCode: "es",
  projectKey: TEST_PROJECT_KEY,
};

export const mockDeleteLanguageKeyPayload = {
  itemId: MOCK_LANG_KEY_ID_1,
  projectKey: TEST_PROJECT_KEY,
};

export const mockDeleteLanguagePayload = {
  languageName: "German",
  projectKey: TEST_PROJECT_KEY,
};

export const mockSetDefaultPayload = {
  languageName: "German",
  projectKey: TEST_PROJECT_KEY,
};

export const mockTranslateAllPayload = {
  projectKey: TEST_PROJECT_KEY,
  messageCoRelationId: MOCK_CORR_ID_3,
  defaultLanguage: "en",
};

export const mockTranslateKeyPayload = {
  keyId: MOCK_LANG_KEY_ID_1,
  projectKey: TEST_PROJECT_KEY,
  defaultLanguage: "en",
  messageCoRelationId: MOCK_CORR_ID_3,
};

export const mockTranslationSuggestionPayload = {
  sourceText: "Save",
  destinationLanguage: "German",
  currentLanguage: "English",
  temperature: 0.1,
  elementDetailContext: "",
  projectKey: TEST_PROJECT_KEY,
};

export const mockTranslationSuggestionResponse = {
  content: "Speichern",
  errors: null,
  isSuccess: true,
};

export const mockGenerateUilmFilePayload = {
  guid: MOCK_UILM_GUID,
  projectKey: TEST_PROJECT_KEY,
};

export const mockGetTimelinePayload = {
  pageNumber: 1,
  pageSize: 10,
  keyId: MOCK_LANG_KEY_ID_1,
  projectKey: TEST_PROJECT_KEY,
};

export const mockGetExportHistoryPayload = {
  projectKey: TEST_PROJECT_KEY,
  pageNumber: 1,
  pageSize: 10,
  filters: mockExportHistoryFilters,
};

export const mockRevertKeyTimelinePayload = {
  itemId: MOCK_TIMELINE_ID_1,
  projectKey: TEST_PROJECT_KEY,
};
