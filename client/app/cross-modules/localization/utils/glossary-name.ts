import { GlossaryMatch } from "@blocks-localization/models/glossary-match";
import { IGlossary } from "@blocks-localization/models/language";

/**
 * The server's unique-name form (`ToLowerInvariant`): each code point lower-cased on its own,
 * whatever the browser's locale, and "İ" kept as it is.
 */
export const normalizeGlossaryName = (name: string): string =>
  Array.from(name.trim().normalize("NFC"), (char) =>
    char === "İ" ? char : char.toLowerCase(),
  ).join("");

/**
 * Returns the glossary whose name matches `name` regardless of letter case,
 * ignoring the glossary currently being edited.
 */
export const findDuplicateGlossary = (
  name: string,
  glossaries: IGlossary[] | undefined,
  excludeItemId?: string,
): IGlossary | undefined => {
  const normalized = normalizeGlossaryName(name);
  if (!normalized) {
    return undefined;
  }
  return glossaries?.find(
    (glossary) =>
      glossary.itemId !== excludeItemId &&
      normalizeGlossaryName(glossary.name ?? "") === normalized,
  );
};

/**
 * True when `name` already is one of the matched glossaries: its name, a variant or the matched
 * text, regardless of letter case. "Add to glossary" is pointless for it.
 */
export const isMatchedGlossaryName = (name: string, matches: GlossaryMatch[]): boolean => {
  const normalized = normalizeGlossaryName(name);
  if (!normalized) return false;
  return matches.some((match) =>
    [match.glossary.name ?? "", match.surface, ...match.meta.variants].some(
      (value) => normalizeGlossaryName(value) === normalized,
    ),
  );
};
