export const GLOSSARY_META_PREFIX = "@@glossary-meta:v1@@";
export const GLOSSARY_META_PREFIX_PATTERN = /^@@glossary-meta:v(\d+)@@/;

export type GlossaryRule = "translate" | "keep" | "forbidden";

export const GLOSSARY_RULES: readonly GlossaryRule[] = ["translate", "keep", "forbidden"];

export interface GlossaryMeta {
  rule: GlossaryRule;
  caseSensitive: boolean;
  variants: string[];
  /** Culture code → approved translation. */
  translations: Record<string, string>;
  /** Culture code → alternatives that must not be used. */
  forbidden: Record<string, string[]>;
  /** Free-text internal note (never sent to the AI). */
  note?: string;
}

export type GlossaryMetaStatus = "plain" | "structured" | "corrupt" | "unsupported-version";

export interface ParsedGlossaryMeta {
  meta: GlossaryMeta;
  status: GlossaryMetaStatus;
  /** The original additionalNote ("" when absent). */
  raw: string;
}
