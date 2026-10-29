import {
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
 * Reads the terminology data a Phase 2 client stored in a glossary's `additionalNote`.
 * Read-only: the console now saves structured fields, so only notes not yet migrated still
 * hold this JSON. Tolerates plain notes, hand-edited or broken JSON and unknown versions,
 * because other clients (the browser extension, the CLI) edit the same field as raw text.
 */
export const parseGlossaryMeta = (raw = ""): ParsedGlossaryMeta => {
  if (!raw) {
    return { meta: createDefaultGlossaryMeta(), status: "plain", raw: "" };
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
