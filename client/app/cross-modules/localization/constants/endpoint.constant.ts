import { API_BASES } from "@/constants/endpoint.constant";

const KEY_SUBPATH = "/Key";
const MODULE_SUBPATH = "/Module";
const LANGUAGE_SUBPATH = "/Language";
const ASSISTANT_SUBPATH = "/Assistant";
const CONFIG_SUBPATH = "/Config";
const GLOSSARY_SUBPATH = "/Glossary";

// Language Key endpoints
export const LANGUAGE_KEY_ENDPOINTS = {
  GETS: `${API_BASES.UILM}${KEY_SUBPATH}/Gets`,
  GET: `${API_BASES.UILM}${KEY_SUBPATH}/Get`,
  SAVE: `${API_BASES.UILM}${KEY_SUBPATH}/Save`,
  DELETE: `${API_BASES.UILM}${KEY_SUBPATH}/Delete`,
  DELETE_KEYS: `${API_BASES.UILM}${KEY_SUBPATH}/DeleteKeys`,
  TRANSLATE_KEYS: `${API_BASES.UILM}${KEY_SUBPATH}/TranslateKeys`,
  GENERATE_UILM_FILE: `${API_BASES.UILM}${KEY_SUBPATH}/GenerateUilmFile`,
  TRANSLATE_ALL: `${API_BASES.UILM}${KEY_SUBPATH}/TranslateAll`,
  TRANSLATE_KEY: `${API_BASES.UILM}${KEY_SUBPATH}/TranslateKey`,
  UILM_IMPORT: `${API_BASES.UILM}${KEY_SUBPATH}/UilmImport`,
  UILM_EXPORT: `${API_BASES.UILM}${KEY_SUBPATH}/UilmExport`,
  GET_TIMELINE: `${API_BASES.UILM}${KEY_SUBPATH}/GetTimeline`,
  GET_EXPORT_HISTORY: `${API_BASES.UILM}${KEY_SUBPATH}/GetUilmExportedFiles`,
  ROLLBACK: `${API_BASES.UILM}${KEY_SUBPATH}/RollBack`,
  GET_LOCALIZATION_TIMELINE: `${API_BASES.UILM}${KEY_SUBPATH}/GetLocalizationTimeline`,
  GET_TIMELINE_BY_OPERATION_ID: `${API_BASES.UILM}${KEY_SUBPATH}/GetTimelineByOperationId`,
} as const;

// Language Module endpoints
export const LANGUAGE_MODULE_ENDPOINTS = {
  GETS: `${API_BASES.UILM}${MODULE_SUBPATH}/GetCloudsModules`,
  SAVE: `${API_BASES.UILM}${MODULE_SUBPATH}/Save`,
  DELETE: `${API_BASES.UILM}${MODULE_SUBPATH}/Delete`,
  TAG_GLOSSARY: `${API_BASES.UILM}${MODULE_SUBPATH}/TagGlossary`,
} as const;

// Language endpoints
export const LANGUAGE_ENDPOINTS = {
  GETS: `${API_BASES.UILM}${LANGUAGE_SUBPATH}/GetCloudstLanguages`,
  SAVE: `${API_BASES.UILM}${LANGUAGE_SUBPATH}/Save`,
  DELETE: `${API_BASES.UILM}${LANGUAGE_SUBPATH}/Delete`,
  SET_DEFAULT: `${API_BASES.UILM}${LANGUAGE_SUBPATH}/SetDefault`,
} as const;

// Language Assistant endpoints
export const LANGUAGE_ASSISTANT_ENDPOINTS = {
  GET_TRANSLATION_SUGGESTION: `${API_BASES.UILM}${ASSISTANT_SUBPATH}/GetTranslationSuggestion`,
} as const;

// Config endpoints
export const CONFIG_ENDPOINTS = {
  GET_WEBHOOK: `${API_BASES.UILM}${CONFIG_SUBPATH}/GetCloudWebHook`,
  SAVE_WEBHOOK: `${API_BASES.UILM}${CONFIG_SUBPATH}/SaveWebHook`,
} as const;

// Glossary endpoints
export const GLOSSARY_ENDPOINTS = {
  GET: `${API_BASES.UILM}${GLOSSARY_SUBPATH}/Get`,
  GETS: `${API_BASES.UILM}${GLOSSARY_SUBPATH}/Gets`,
  SAVE: `${API_BASES.UILM}${GLOSSARY_SUBPATH}/Save`,
  DELETE: `${API_BASES.UILM}${GLOSSARY_SUBPATH}/Delete`,
  GET_SUGGESTED_GLOSSARIES: `${API_BASES.UILM}${GLOSSARY_SUBPATH}/GetSuggestedGlossaries`,
} as const;
