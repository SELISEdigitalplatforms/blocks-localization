import { describe, expect, it } from "vitest";
import {
  getCompletenessCellValue,
  hasNonEmptyValue,
  isKeyComplete,
} from "./use-language-table-columns";
import type { IBlocksLanguageKey, ILanguageConfig } from "@blocks-localization/models/language";

const enUS: ILanguageConfig = { languageCode: "en-US", languageName: "English" };
const deDE: ILanguageConfig = { languageCode: "de-DE", languageName: "German" };

const makeResource = (culture: string, value: string): IBlocksLanguageKey["resources"][number] => ({
  culture,
  value,
});

// H1
it("returns Complete when every active language has a non-empty resource", () => {
  const resources: IBlocksLanguageKey["resources"] = [
    makeResource("en-US", "Save"),
    makeResource("de-DE", "Speichern"),
  ];
  expect(getCompletenessCellValue(resources, [enUS, deDE])).toBe("Complete");
});

// H2
it("returns Partial when some active languages have non-empty resources", () => {
  const resources: IBlocksLanguageKey["resources"] = [makeResource("en-US", "Save")];
  expect(getCompletenessCellValue(resources, [enUS, deDE])).toBe("Partial");
});

// H3
it("returns No translation when resources is empty", () => {
  expect(getCompletenessCellValue([], [enUS])).toBe("No translation");
  expect(getCompletenessCellValue([], [])).toBe("No translation");
});

// C1 — BUG FIX: all-empty-string key was "Complete", should be "No translation"
it("returns No translation when all resources are empty strings", () => {
  const resources: IBlocksLanguageKey["resources"] = [
    makeResource("en-US", ""),
    makeResource("de-DE", ""),
  ];
  expect(getCompletenessCellValue(resources, [enUS, deDE])).toBe("No translation");
});

// C2 — BUG FIX: retired-language-only key was "Partial", should be "No translation"
it("returns No translation when all resources belong to retired languages", () => {
  const resources: IBlocksLanguageKey["resources"] = [makeResource("de-DE", "Hallo")];
  expect(getCompletenessCellValue(resources, [enUS])).toBe("No translation");
});

// C3 — BUG FIX: retired-language key with empty value
it("returns No translation for retired-language resource with empty value", () => {
  const resources: IBlocksLanguageKey["resources"] = [makeResource("de-DE", "")];
  expect(getCompletenessCellValue(resources, [enUS])).toBe("No translation");
});

// C4 — hasNonEmptyValue must remain correct for per-cell use
it("hasNonEmptyValue returns false for empty string", () => {
  expect(hasNonEmptyValue(makeResource("en-US", ""))).toBe(false);
});

it("hasNonEmptyValue returns true for non-empty string", () => {
  expect(hasNonEmptyValue(makeResource("en-US", "Save"))).toBe(true);
});

it("hasNonEmptyValue returns false for undefined", () => {
  expect(hasNonEmptyValue(undefined)).toBe(false);
});

// H5
it("treats empty-string resource as missing within active-language completeness check", () => {
  const resources: IBlocksLanguageKey["resources"] = [
    makeResource("en-US", "Save"),
    makeResource("de-DE", ""),
  ];
  // en-US is non-empty, de-DE is empty (treated as missing) → Partial
  expect(getCompletenessCellValue(resources, [enUS, deDE])).toBe("Partial");
});

// H6
it("returns No translation when languageListData is empty or undefined", () => {
  expect(getCompletenessCellValue([makeResource("en-US", "Save")], [])).toBe("No translation");
  expect(getCompletenessCellValue([makeResource("en-US", "Save")], undefined)).toBe("No translation");
});

// H6 / C2 combined — all languages retired
it("returns No translation when resources exist only for languages not in languageListData", () => {
  const resources: IBlocksLanguageKey["resources"] = [
    makeResource("de-DE", "Hallo"),
    makeResource("fr-FR", ""),
  ];
  expect(getCompletenessCellValue(resources, [enUS])).toBe("No translation");
});

// Existing correct behaviour — must not regress
it("returns Partial when some but not all active languages are missing", () => {
  const resources: IBlocksLanguageKey["resources"] = [makeResource("en-US", "Save")];
  expect(getCompletenessCellValue(resources, [enUS, deDE])).toBe("Partial");
});

// isKeyComplete unit tests
it("isKeyComplete returns true when all language codes have non-empty resources", () => {
  const resources = [makeResource("en-US", "Save"), makeResource("de-DE", "Hallo")];
  expect(isKeyComplete(resources, ["en-US", "de-DE"])).toBe(true);
});

it("isKeyComplete returns false when at least one language code is missing a non-empty resource", () => {
  const resources = [makeResource("en-US", "Save")];
  expect(isKeyComplete(resources, ["en-US", "de-DE"])).toBe(false);
});
