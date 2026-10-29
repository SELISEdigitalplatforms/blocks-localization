/**
 * Test fixture: `GlossaryMatch` lists like the ones `/Glossary/Match` returns, built in memory
 * from `IGlossary` fixtures. Not a matcher for production (the server owns matching since
 * Phase 7); it only covers what the tests need: name and variants, case, whole words (substrings
 * for no-space cultures), longest match first, key > module > global scope, Deprecated excluded.
 * Fixtures may use the API structured fields or a legacy v1 JSON `additionalNote`.
 */
import { GlossaryMatch, GlossaryScope } from "@blocks-localization/models/glossary-match";
import {
  IGlossary,
  IGlossaryMatchDto,
  IMatchGlossaryResponse,
} from "@blocks-localization/models/language";
import { getGlossaryStatus, toGlossaryMeta } from "@blocks-localization/utils/glossary-display";
import { parseGlossaryMeta } from "@blocks-localization/utils/glossary-meta";
import { stripRuleMarker } from "@blocks-localization/utils/glossary-rule-marker";
import { isNoSpaceCulture, isWordStart } from "@blocks-localization/utils/glossary-text";

export interface FixtureMatchOptions {
  sourceCulture?: string;
  keyGlossaryIds?: string[];
  moduleId?: string;
  /** "all" also returns terms of no applicable scope as "other". */
  scopeMode?: "applicable" | "all";
}

const SCOPE_RANK: Record<GlossaryScope, number> = { key: 0, module: 1, global: 2, other: 3 };

const metaOf = (glossary: IGlossary) =>
  glossary.rule || glossary.translations || glossary.variants
    ? toGlossaryMeta(glossary)
    : parseGlossaryMeta(glossary.additionalNote ?? "").meta;

const scopeOf = (glossary: IGlossary, options: FixtureMatchOptions): GlossaryScope => {
  if (options.keyGlossaryIds?.includes(glossary.itemId)) return "key";
  if (options.moduleId && glossary.moduleIds?.includes(options.moduleId)) return "module";
  if (glossary.isGlobal) return "global";
  return "other";
};

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

export const findGlossaryMatches = (
  glossaries: IGlossary[],
  text: string,
  options: FixtureMatchOptions = {},
): GlossaryMatch[] => {
  const culture = options.sourceCulture ?? "en-US";
  const substring = isNoSpaceCulture(culture);
  const candidates: GlossaryMatch[] = [];
  for (const glossary of glossaries) {
    const status = getGlossaryStatus(glossary);
    if (status === "deprecated") continue;
    const scope = scopeOf(glossary, options);
    if (scope === "other" && options.scopeMode !== "all") continue;
    const meta = metaOf(glossary);
    const haystack = meta.caseSensitive ? text : text.toLowerCase();
    for (const alternative of [glossary.name, ...meta.variants]) {
      const needle = meta.caseSensitive ? alternative.trim() : alternative.trim().toLowerCase();
      if (!needle) continue;
      for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) {
        const end = at + needle.length;
        if (!substring && (!isWordStart(text, at) || LETTER_OR_DIGIT.test(text.charAt(end))))
          continue;
        candidates.push({
          glossary,
          meta,
          definition: stripRuleMarker(glossary.context),
          start: at,
          length: needle.length,
          surface: text.slice(at, end),
          scope,
          status,
        });
      }
    }
  }
  candidates.sort(
    (a, b) => a.start - b.start || b.length - a.length || SCOPE_RANK[a.scope] - SCOPE_RANK[b.scope],
  );
  const result: GlossaryMatch[] = [];
  let cursor = 0;
  for (const candidate of candidates) {
    if (candidate.start < cursor) continue;
    result.push(candidate);
    cursor = candidate.start + candidate.length;
  }
  return result;
};

/**
 * A `/Glossary/Match` response for the fixtures, shaped like the server's: each term's
 * translations carry only the values active under its rule (Keep: none; Forbidden: forbidden
 * values only).
 */
export const matchResponse = (
  glossaries: IGlossary[],
  text: string,
  options: FixtureMatchOptions = {},
): IMatchGlossaryResponse => ({
  matches: findGlossaryMatches(glossaries, text, options).map((match): IGlossaryMatchDto => {
    const { meta } = match;
    const cultures = [
      ...new Set([...Object.keys(meta.translations), ...Object.keys(meta.forbidden)]),
    ];
    const translations =
      meta.rule === "keep"
        ? []
        : cultures.map((language) => ({
            language,
            value: meta.rule === "translate" ? (meta.translations[language] ?? "") : "",
            forbiddenValues: meta.forbidden[language] ?? [],
          }));
    return {
      glossaryId: match.glossary.itemId,
      start: match.start,
      length: match.length,
      surface: match.surface,
      term: match.glossary.name,
      rule: meta.rule,
      status: match.status,
      caseSensitive: meta.caseSensitive,
      scope: match.scope,
      definition: match.definition,
      translations: translations.filter(
        (translation) => translation.value || translation.forbiddenValues.length > 0,
      ),
    };
  }),
});
