const UILM = "/Api";

const KEY = `${UILM}/Key`;
const MODULE = `${UILM}/Module`;
const LANGUAGE = `${UILM}/Language`;
const ASSISTANT = `${UILM}/Assistant`;

export const LANGUAGE_KEY_ENDPOINTS = {
  GETS: `${KEY}/Gets`,
  GET: `${KEY}/Get`,
  SAVE: `${KEY}/Save`,
  DELETE: `${KEY}/Delete`,
  GET_EXPORT_HISTORY: `${KEY}/GetUilmExportedFiles`,
  GENERATE_UILM_FILE: `${KEY}/GenerateUilmFile`,
  /** UILM file import after upload to storage — matches blocks localization `LANGUAGE_KEY_ENDPOINTS.UILM_IMPORT`. */
  UILM_IMPORT: `${KEY}/UilmImport`,
  /** Async UILM key export — matches blocks localization `LANGUAGE_KEY_ENDPOINTS.UILM_EXPORT`. */
  UILM_EXPORT: `${KEY}/UilmExport`,
  TRANSLATE_ALL: `${KEY}/TranslateAll`,
  TRANSLATE_KEY: `${KEY}/TranslateKey`,
  GET_TIMELINE: `${KEY}/GetTimeline`,
  GET_LOCALIZATION_TIMELINE: `${KEY}/GetLocalizationTimeline`,
  GET_TIMELINE_BY_OPERATION_ID: `${KEY}/GetTimelineByOperationId`,
  ROLLBACK: `${KEY}/Rollback`,
} as const;

export const LANGUAGE_MODULE_ENDPOINTS = {
  GETS: `${MODULE}/Gets`,
  SAVE: `${MODULE}/Save`,
} as const;

export const LANGUAGE_ENDPOINTS = {
  GETS: `${LANGUAGE}/Gets`,
  SAVE: `${LANGUAGE}/Save`,
  DELETE: `${LANGUAGE}/Delete`,
  SET_DEFAULT: `${LANGUAGE}/SetDefault`,
} as const;

export const LANGUAGE_ASSISTANT_ENDPOINTS = {
  GET_TRANSLATION_SUGGESTION: `${ASSISTANT}/GetTranslationSuggestion`,
} as const;
