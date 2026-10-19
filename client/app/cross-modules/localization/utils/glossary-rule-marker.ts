import { GlossaryMeta } from "@blocks-localization/models/glossary-meta";
import { ILanguageConfig } from "@blocks-localization/models/language";

export const MARKER_PATTERN = /\s*⟦rule:[^⟧]*⟧\s*$/u;
export const MARKER_MAX_LENGTH = 500;
const MARKER_VALUE_MAX_LENGTH = 80;

/** Removes one trailing `⟦rule: …⟧` marker and trims. Used wherever `context` is shown. */
export const stripRuleMarker = (context?: string): string =>
  (context ?? "").replace(MARKER_PATTERN, "").trim();

const sanitizeMarkerValue = (value: string): string =>
  value
    .replaceAll(/[⟦⟧;→"\r\n]/gu, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, MARKER_VALUE_MAX_LENGTH)
    .trim();

/** The default language is the source text; translations are for every other language. */
export const getDefaultLanguage = (languages: ILanguageConfig[] | undefined) =>
  languages?.find((language) => language.isDefault) ?? languages?.[0];

export const getTargetLanguages = (languages: ILanguageConfig[] | undefined): ILanguageConfig[] => {
  const defaultLanguage = getDefaultLanguage(languages);
  return (languages ?? []).filter((language) => language !== defaultLanguage);
};

const wrap = (entries: string[]) => `⟦rule: ${entries.join("; ")}⟧`;

/** Adds whole entries in order and stops before the first one that would exceed the cap. */
const capEntries = (fixed: string[], optional: string[]): string[] => {
  const entries = [...fixed];
  for (const entry of optional) {
    if (wrap([...entries, entry]).length > MARKER_MAX_LENGTH) break;
    entries.push(entry);
  }
  return entries;
};

const buildAvoidEntries = (meta: GlossaryMeta, targets: ILanguageConfig[]): string[] =>
  targets.flatMap(({ languageCode }) => {
    const values = (meta.forbidden[languageCode] ?? []).map(sanitizeMarkerValue).filter(Boolean);
    return values.length > 0 ? [`avoid ${languageCode}: ${values.join(", ")}`] : [];
  });

/**
 * Builds the short rule line appended to `context`, the only glossary field the AI sees.
 * Returns null when there is nothing to say.
 */
export const buildRuleMarker = (
  meta: GlossaryMeta,
  projectLanguages: ILanguageConfig[],
): string | null => {
  const targets = getTargetLanguages(projectLanguages);

  if (meta.rule === "keep") {
    return wrap(["keep as-is in all languages"]);
  }

  if (meta.rule === "forbidden") {
    return wrap(capEntries(["do not use this term"], buildAvoidEntries(meta, targets)));
  }

  const translationEntries = targets.flatMap(({ languageCode }) => {
    const value = sanitizeMarkerValue(meta.translations[languageCode] ?? "");
    return value ? [`${languageCode}→${value}`] : [];
  });
  const entries = capEntries([], [...translationEntries, ...buildAvoidEntries(meta, targets)]);
  return entries.length > 0 ? wrap(entries) : null;
};

/** `context` to save: the definition (without any old marker) plus a fresh marker. */
export const buildGlossaryContext = (definition: string, marker: string | null): string => {
  const text = stripRuleMarker(definition);
  if (!marker) return text;
  return text ? `${text} ${marker}` : marker;
};
