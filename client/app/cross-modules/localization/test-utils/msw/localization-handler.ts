// DEADCODE 2026-07-29: unreferenced by any test, setup file, or vitest alias; whole file commented pending review
// import { http, HttpResponse, type JsonBodyType } from "msw";
// import {
//   LANGUAGE_ASSISTANT_ENDPOINTS,
//   LANGUAGE_ENDPOINTS,
//   LANGUAGE_KEY_ENDPOINTS,
//   LANGUAGE_MODULE_ENDPOINTS,
// } from "@blocks-localization/constants/endpoint.constant";
// import {
//   mockLanguageKeysResponse,
//   mockBlocksLanguageKey,
//   mockLanguageConfigList,
//   mockSuccessResponse,
//   mockDeleteSuccessResponse,
//   mockRollbackResponse,
//   mockGetTimelineResponse,
//   mockGetExportHistory,
//   mockTranslationSuggestionResponse,
//   mockModuleGetsList,
//   mockLanguageDeleteResponse,
// } from "../__mocks__/data.mock";
//
// // ─── URL Patterns ─────────────────────────────────────────────────────────────
//
// const KEY_GETS_PATTERN = new RegExp(LANGUAGE_KEY_ENDPOINTS.GETS);
// const KEY_GET_PATTERN = new RegExp(LANGUAGE_KEY_ENDPOINTS.GET);
// const KEY_SAVE_PATTERN = new RegExp(LANGUAGE_KEY_ENDPOINTS.SAVE);
// const KEY_DELETE_PATTERN = new RegExp(LANGUAGE_KEY_ENDPOINTS.DELETE);
// const KEY_GENERATE_UILM_PATTERN = new RegExp(LANGUAGE_KEY_ENDPOINTS.GENERATE_UILM_FILE);
// const KEY_TRANSLATE_ALL_PATTERN = new RegExp(LANGUAGE_KEY_ENDPOINTS.TRANSLATE_ALL);
// const KEY_TRANSLATE_KEY_PATTERN = new RegExp(LANGUAGE_KEY_ENDPOINTS.TRANSLATE_KEY);
// const KEY_UILM_IMPORT_PATTERN = new RegExp(LANGUAGE_KEY_ENDPOINTS.UILM_IMPORT);
// const KEY_UILM_EXPORT_PATTERN = new RegExp(LANGUAGE_KEY_ENDPOINTS.UILM_EXPORT);
// const KEY_TIMELINE_PATTERN = new RegExp(LANGUAGE_KEY_ENDPOINTS.GET_TIMELINE);
// const KEY_EXPORT_HISTORY_PATTERN = new RegExp(LANGUAGE_KEY_ENDPOINTS.GET_EXPORT_HISTORY);
// const KEY_ROLLBACK_PATTERN = new RegExp(LANGUAGE_KEY_ENDPOINTS.ROLLBACK);
//
// const MODULE_GETS_PATTERN = new RegExp(LANGUAGE_MODULE_ENDPOINTS.GETS);
// const MODULE_SAVE_PATTERN = new RegExp(LANGUAGE_MODULE_ENDPOINTS.SAVE);
//
// const LANGUAGE_GETS_PATTERN = new RegExp(LANGUAGE_ENDPOINTS.GETS);
// const LANGUAGE_SAVE_PATTERN = new RegExp(LANGUAGE_ENDPOINTS.SAVE);
// const LANGUAGE_DELETE_PATTERN = new RegExp(LANGUAGE_ENDPOINTS.DELETE);
// const LANGUAGE_SET_DEFAULT_PATTERN = new RegExp(LANGUAGE_ENDPOINTS.SET_DEFAULT);
//
// const ASSISTANT_TRANSLATION_PATTERN = new RegExp(
//   LANGUAGE_ASSISTANT_ENDPOINTS.GET_TRANSLATION_SUGGESTION,
// );
//
// // ─── Default Handlers ─────────────────────────────────────────────────────────
//
// export const localizationHandlers = [
//   // Keys
//   http.post(KEY_GETS_PATTERN, () => HttpResponse.json(mockLanguageKeysResponse)),
//   http.get(KEY_GET_PATTERN, () => HttpResponse.json(mockBlocksLanguageKey)),
//   http.post(KEY_SAVE_PATTERN, () => HttpResponse.json(mockSuccessResponse)),
//   http.delete(KEY_DELETE_PATTERN, () => HttpResponse.json(mockDeleteSuccessResponse)),
//   http.post(KEY_GENERATE_UILM_PATTERN, () => HttpResponse.json(mockDeleteSuccessResponse)),
//   http.post(KEY_TRANSLATE_ALL_PATTERN, () => HttpResponse.json(mockDeleteSuccessResponse)),
//   http.post(KEY_TRANSLATE_KEY_PATTERN, () => HttpResponse.json(mockDeleteSuccessResponse)),
//   http.post(KEY_UILM_IMPORT_PATTERN, () => HttpResponse.json(mockSuccessResponse)),
//   http.post(KEY_UILM_EXPORT_PATTERN, () => HttpResponse.json(mockSuccessResponse)),
//   http.get(KEY_TIMELINE_PATTERN, () => HttpResponse.json(mockGetTimelineResponse)),
//   http.get(KEY_EXPORT_HISTORY_PATTERN, () => HttpResponse.json(mockGetExportHistory)),
//   http.post(KEY_ROLLBACK_PATTERN, () => HttpResponse.json(mockRollbackResponse)),
//
//   // Modules
//   http.get(MODULE_GETS_PATTERN, () => HttpResponse.json(mockModuleGetsList)),
//   http.post(MODULE_SAVE_PATTERN, () => HttpResponse.json(mockSuccessResponse)),
//
//   // Languages
//   http.get(LANGUAGE_GETS_PATTERN, () => HttpResponse.json(mockLanguageConfigList)),
//   http.post(LANGUAGE_SAVE_PATTERN, () => HttpResponse.json(mockSuccessResponse)),
//   http.delete(LANGUAGE_DELETE_PATTERN, () => HttpResponse.json(mockLanguageDeleteResponse)),
//   http.post(LANGUAGE_SET_DEFAULT_PATTERN, () => HttpResponse.json(mockDeleteSuccessResponse)),
//
//   // Assistant
//   http.post(ASSISTANT_TRANSLATION_PATTERN, () =>
//     HttpResponse.json(mockTranslationSuggestionResponse),
//   ),
// ];
//
// // ─── Per-test Handler Factories ───────────────────────────────────────────────
// // Use with server.use(getLanguageKeysHandler(customResponse)) to override default responses in specific test scenarios.
//
// export const getLanguageKeysHandler = (response: JsonBodyType = mockLanguageKeysResponse) =>
//   http.post(KEY_GETS_PATTERN, () => HttpResponse.json(response));
//
// export const getLanguageKeyByIdHandler = (response: JsonBodyType = mockBlocksLanguageKey) =>
//   http.get(KEY_GET_PATTERN, () => HttpResponse.json(response));
//
// export const saveLanguageKeyHandler = (response: JsonBodyType = mockSuccessResponse) =>
//   http.post(KEY_SAVE_PATTERN, () => HttpResponse.json(response));
//
// export const deleteLanguageKeyHandler = (response: JsonBodyType = mockDeleteSuccessResponse) =>
//   http.delete(KEY_DELETE_PATTERN, () => HttpResponse.json(response));
//
// export const getLanguageModulesHandler = (response: JsonBodyType = mockModuleGetsList) =>
//   http.get(MODULE_GETS_PATTERN, () => HttpResponse.json(response));
//
// export const saveLanguageModuleHandler = (response: JsonBodyType = mockSuccessResponse) =>
//   http.post(MODULE_SAVE_PATTERN, () => HttpResponse.json(response));
//
// export const getLanguagesHandler = (response: JsonBodyType = mockLanguageConfigList) =>
//   http.get(LANGUAGE_GETS_PATTERN, () => HttpResponse.json(response));
//
// export const saveLanguageHandler = (response: JsonBodyType = mockSuccessResponse) =>
//   http.post(LANGUAGE_SAVE_PATTERN, () => HttpResponse.json(response));
//
// export const deleteLanguageHandler = (response: JsonBodyType = mockLanguageDeleteResponse) =>
//   http.delete(LANGUAGE_DELETE_PATTERN, () => HttpResponse.json(response));
//
// export const setDefaultLanguageHandler = (response: JsonBodyType = mockDeleteSuccessResponse) =>
//   http.post(LANGUAGE_SET_DEFAULT_PATTERN, () => HttpResponse.json(response));
//
// export const getTimelineHandler = (response: JsonBodyType = mockGetTimelineResponse) =>
//   http.get(KEY_TIMELINE_PATTERN, () => HttpResponse.json(response));
//
// export const getExportHistoryHandler = (response: JsonBodyType = mockGetExportHistory) =>
//   http.get(KEY_EXPORT_HISTORY_PATTERN, () => HttpResponse.json(response));
//
// export const revertKeyTimelineHandler = (response: JsonBodyType = mockRollbackResponse) =>
//   http.post(KEY_ROLLBACK_PATTERN, () => HttpResponse.json(response));
//
// export const importLanguageFileHandler = (response: JsonBodyType = mockSuccessResponse) =>
//   http.post(KEY_UILM_IMPORT_PATTERN, () => HttpResponse.json(response));
//
// export const getTranslationSuggestionHandler = (
//   response: JsonBodyType = mockTranslationSuggestionResponse,
// ) => http.post(ASSISTANT_TRANSLATION_PATTERN, () => HttpResponse.json(response));
//
// // ─── Error Handler Factories ──────────────────────────────────────────────────
//
// export const getLanguageKeysErrorHandler = (status = 500) =>
//   http.post(KEY_GETS_PATTERN, () =>
//     HttpResponse.json({ message: "Internal server error" }, { status }),
//   );
//
// export const getLanguagesErrorHandler = (status = 500) =>
//   http.get(LANGUAGE_GETS_PATTERN, () =>
//     HttpResponse.json({ message: "Internal server error" }, { status }),
//   );
//
// export const saveLanguageKeyErrorHandler = (status = 400) =>
//   http.post(KEY_SAVE_PATTERN, () => HttpResponse.json({ message: "Bad request" }, { status }));
