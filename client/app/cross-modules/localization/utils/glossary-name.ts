import { IGlossary } from "@blocks-localization/models/language";

export const normalizeGlossaryName = (name: string): string =>
  name.trim().normalize("NFC").toLocaleLowerCase();

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
