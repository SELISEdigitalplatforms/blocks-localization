import {
  GLOSSARY_META_PREFIX,
  GLOSSARY_META_PREFIX_PATTERN,
  GLOSSARY_RULES,
  GlossaryMeta,
  GlossaryRule,
  ParsedGlossaryMeta,
} from "@blocks-localization/models/glossary-meta";

export const createDefaultGlossaryMeta = (): GlossaryMeta => ({
  rule: "translate",
  caseSensitive: false,
  variants: [],
  translations: {},
  forbidden: {},
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const toTranslations = (value: unknown): Record<string, string> => {
  if (!isPlainObject(value)) return {};
  const result: Record<string, string> = {};
  for (const [code, text] of Object.entries(value)) {
    if (typeof text === "string" && text.trim()) {
      result[code] = text.trim();
    }
  }
  return result;
};

const toForbidden = (value: unknown): Record<string, string[]> => {
  if (!isPlainObject(value)) return {};
  const result: Record<string, string[]> = {};
  for (const [code, list] of Object.entries(value)) {
    const items = toStringList(list);
    if (items.length > 0) {
      result[code] = items;
    }
  }
  return result;
};

const toRule = (value: unknown): GlossaryRule =>
  GLOSSARY_RULES.includes(value as GlossaryRule) ? (value as GlossaryRule) : "translate";

/**
 * Reads the terminology data stored in a glossary's `additionalNote`. Tolerates plain
 * notes, hand-edited or broken JSON and unknown versions, because other clients (the
 * browser extension, the CLI) edit the same field as raw text.
 */
export const parseGlossaryMeta = (additionalNote?: string): ParsedGlossaryMeta => {
  const raw = additionalNote ?? "";
  if (!raw) {
    return { meta: createDefaultGlossaryMeta(), status: "plain", raw };
  }

  const match = GLOSSARY_META_PREFIX_PATTERN.exec(raw);
  if (!match) {
    return { meta: { ...createDefaultGlossaryMeta(), note: raw }, status: "plain", raw };
  }

  if (match[1] !== "1") {
    return { meta: createDefaultGlossaryMeta(), status: "unsupported-version", raw };
  }

  let data: unknown;
  try {
    data = JSON.parse(raw.slice(match[0].length));
  } catch {
    data = undefined;
  }
  if (!isPlainObject(data)) {
    return { meta: { ...createDefaultGlossaryMeta(), note: raw }, status: "corrupt", raw };
  }

  const meta: GlossaryMeta = {
    rule: toRule(data.rule),
    caseSensitive: typeof data.caseSensitive === "boolean" ? data.caseSensitive : false,
    variants: toStringList(data.variants),
    translations: toTranslations(data.translations),
    forbidden: toForbidden(data.forbidden),
  };
  if (typeof data.note === "string" && data.note.trim()) {
    meta.note = data.note.trim();
  }
  return { meta, status: "structured", raw };
};

const sortedEntries = <T>(record: Record<string, T>) =>
  Object.entries(record).sort(([a], [b]) => (a < b ? -1 : Number(a > b)));

/** Normalizes the meta the same way the parser does (trimmed values, empties removed). */
export const normalizeGlossaryMeta = (meta: GlossaryMeta): GlossaryMeta => {
  const normalized: GlossaryMeta = {
    rule: toRule(meta.rule),
    caseSensitive: meta.caseSensitive === true,
    variants: toStringList(meta.variants),
    translations: Object.fromEntries(sortedEntries(toTranslations(meta.translations))),
    forbidden: Object.fromEntries(sortedEntries(toForbidden(meta.forbidden))),
  };
  const note = meta.note?.trim();
  if (note) {
    normalized.note = note;
  }
  return normalized;
};

/**
 * Serializes the meta with a deterministic key order (rule, caseSensitive, variants,
 * translations, forbidden, note), omitting defaults, so an unchanged term round-trips
 * byte-identically.
 */
export const serializeGlossaryMeta = (meta: GlossaryMeta): string => {
  const normalized = normalizeGlossaryMeta(meta);
  const compact: Record<string, unknown> = { rule: normalized.rule };
  if (normalized.caseSensitive) compact.caseSensitive = true;
  if (normalized.variants.length > 0) compact.variants = normalized.variants;
  if (Object.keys(normalized.translations).length > 0) {
    compact.translations = normalized.translations;
  }
  if (Object.keys(normalized.forbidden).length > 0) compact.forbidden = normalized.forbidden;
  if (normalized.note) compact.note = normalized.note;
  return GLOSSARY_META_PREFIX + JSON.stringify(compact);
};
