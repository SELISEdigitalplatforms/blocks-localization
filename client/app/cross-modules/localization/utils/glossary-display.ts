import {
  GLOSSARY_META_PREFIX_PATTERN,
  GLOSSARY_RULES,
  GlossaryMeta,
  GlossaryRule,
} from "@blocks-localization/models/glossary-meta";
import { GLOSSARY_STATUSES, GlossaryStatus, IGlossary } from "@blocks-localization/models/language";
import { parseGlossaryMeta } from "@blocks-localization/utils/glossary-meta";
import { stripRuleMarker } from "@blocks-localization/utils/glossary-rule-marker";

type StructuredGlossary = Pick<
  IGlossary,
  "rule" | "caseSensitive" | "variants" | "translations" | "additionalNote"
>;

const toRule = (value: unknown): GlossaryRule =>
  GLOSSARY_RULES.includes(value as GlossaryRule) ? (value as GlossaryRule) : "translate";

/** The term's status; terms without one (legacy) are Approved. */
export const getGlossaryStatus = (glossary: Pick<IGlossary, "status">): GlossaryStatus =>
  GLOSSARY_STATUSES.includes(glossary.status as GlossaryStatus)
    ? (glossary.status as GlossaryStatus)
    : "approved";

/**
 * The internal note. A v1-prefixed `additionalNote` (not yet migrated, or last saved by the
 * Track A UI) returns the note inside the JSON, or the whole raw text when the JSON is
 * corrupt; anything else is already a plain note. Independent of `schemaVersion` (A6).
 */
export const getGlossaryNote = (glossary: Pick<IGlossary, "additionalNote">): string => {
  const raw = glossary.additionalNote ?? "";
  const prefix = GLOSSARY_META_PREFIX_PATTERN.exec(raw);
  if (!prefix || prefix[1] !== "1") return prefix ? "" : raw;
  const parsed = parseGlossaryMeta(raw);
  return parsed.status === "corrupt" ? raw : (parsed.meta.note ?? "");
};

/** True when `additionalNote` carries a terminology prefix of a version other than 1 (C16). */
export const isUnsupportedGlossaryNote = (glossary: Pick<IGlossary, "additionalNote">): boolean => {
  const prefix = GLOSSARY_META_PREFIX_PATTERN.exec(glossary.additionalNote ?? "");
  return !!prefix && prefix[1] !== "1";
};

/**
 * The Phase 2 `GlossaryMeta` shape built from the API fields, so the existing badges, chips and
 * cards keep their props. Every stored value is kept, also those inactive under the rule
 * (Phase 2 A9); consumers decide what the rule activates.
 */
export const toGlossaryMeta = (glossary: StructuredGlossary): GlossaryMeta => {
  const translations: Record<string, string> = {};
  const forbidden: Record<string, string[]> = {};
  for (const translation of glossary.translations ?? []) {
    if (!translation?.language) continue;
    const value = translation.value?.trim();
    if (value) translations[translation.language] = value;
    const banned = (translation.forbiddenValues ?? []).map((item) => item.trim()).filter(Boolean);
    if (banned.length > 0) forbidden[translation.language] = banned;
  }
  const meta: GlossaryMeta = {
    rule: toRule(glossary.rule),
    caseSensitive: !!glossary.caseSensitive,
    variants: (glossary.variants ?? []).map((variant) => variant.trim()).filter(Boolean),
    translations,
    forbidden,
  };
  const note = getGlossaryNote(glossary);
  if (note) meta.note = note;
  return meta;
};

/**
 * A term's complete `Glossary/Save` payload as currently stored, with its `version`. Save
 * replaces the plain fields, so bulk and inline edits start from this and change one thing.
 * `partOfSpeech` and `usageExamples` are left out: the server keeps them on omit.
 */
export const toGlossarySavePayload = (glossary: IGlossary) => ({
  itemId: glossary.itemId,
  name: glossary.name,
  language: glossary.language ?? "",
  type: glossary.type ?? "",
  // As the editor saves it: the structured rule replaces any Track A marker.
  context: stripRuleMarker(glossary.context),
  additionalNote: getGlossaryNote(glossary),
  isGlobal: !!glossary.isGlobal,
  moduleIds: glossary.moduleIds ?? [],
  rule: toRule(glossary.rule),
  caseSensitive: !!glossary.caseSensitive,
  variants: glossary.variants ?? [],
  translations: (glossary.translations ?? []).map((translation) => ({
    language: translation.language,
    value: translation.value ?? "",
    forbiddenValues: translation.forbiddenValues ?? [],
  })),
  status: getGlossaryStatus(glossary),
  ...(typeof glossary.version === "number" ? { version: glossary.version } : {}),
});
