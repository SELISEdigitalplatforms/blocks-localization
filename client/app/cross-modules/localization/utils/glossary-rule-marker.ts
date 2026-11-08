import { ILanguageConfig } from "@blocks-localization/models/language";

const MARKER_OPEN = "⟦rule:";
const MARKER_CLOSE = "⟧";

/**
 * Removes one trailing `⟦rule: …⟧` marker and trims. Used wherever `context` is shown.
 * Linear string scan instead of a regex, so untrusted text can't trigger backtracking.
 */
export const stripRuleMarker = (context?: string): string => {
  const text = (context ?? "").trimEnd();
  if (!text.endsWith(MARKER_CLOSE)) return text.trim();
  // The marker body can't contain `⟧`, so it opens after the previous `⟧` (if any).
  const previousClose = text.slice(0, -MARKER_CLOSE.length).lastIndexOf(MARKER_CLOSE);
  const markerStart = text.indexOf(MARKER_OPEN, previousClose + 1);
  return (markerStart === -1 ? text : text.slice(0, markerStart)).trim();
};

/** The default language is the source text; translations are for every other language. */
export const getDefaultLanguage = (languages: ILanguageConfig[] | undefined) =>
  languages?.find((language) => language.isDefault) ?? languages?.[0];

export const getTargetLanguages = (languages: ILanguageConfig[] | undefined): ILanguageConfig[] => {
  const defaultLanguage = getDefaultLanguage(languages);
  return (languages ?? []).filter((language) => language !== defaultLanguage);
};
