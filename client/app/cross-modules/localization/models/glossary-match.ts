import { GlossaryMeta } from "@blocks-localization/models/glossary-meta";
import { GlossaryStatus, IGlossary } from "@blocks-localization/models/language";

/** "other" is only produced in `mode: "all"`. */
export type GlossaryScope = "key" | "module" | "global" | "other";

/** One glossary term found in a source text (from `/Glossary/Match`). */
export interface GlossaryMatch {
  /** Built from the match: `itemId`, `name`, `context` (the definition) and the structured fields. */
  glossary: IGlossary;
  /** The term's active values (`toGlossaryMeta` of the match). */
  meta: GlossaryMeta;
  /** The definition without any rule marker. */
  definition: string;
  start: number;
  length: number;
  /** The matched source text, as written. */
  surface: string;
  scope: GlossaryScope;
  /** Draft terms are highlighted but never sent to the AI. */
  status: GlossaryStatus;
}
