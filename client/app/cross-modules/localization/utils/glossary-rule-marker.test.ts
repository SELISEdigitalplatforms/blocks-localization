import { describe, expect, it } from "vitest";

import { ILanguageConfig } from "@blocks-localization/models/language";
import * as ruleMarker from "./glossary-rule-marker";
import { getDefaultLanguage, getTargetLanguages, stripRuleMarker } from "./glossary-rule-marker";

const lang = (languageCode: string, isDefault = false): ILanguageConfig => ({
  itemId: languageCode,
  languageCode,
  languageName: languageCode,
  isDefault,
});

describe("utils/glossary-rule-marker", () => {
  it("should keep the read helpers and drop the marker writers (C17)", () => {
    expect(Object.keys(ruleMarker).sort()).toEqual([
      "getDefaultLanguage",
      "getTargetLanguages",
      "stripRuleMarker",
    ]);
  });

  describe("getDefaultLanguage / getTargetLanguages", () => {
    it("should return the default language and every other language in project order", () => {
      const languages = [lang("de-DE"), lang("en-US", true), lang("fr-FR")];
      expect(getDefaultLanguage(languages)?.languageCode).toBe("en-US");
      expect(getTargetLanguages(languages).map((l) => l.languageCode)).toEqual(["de-DE", "fr-FR"]);
    });

    it("should use the first language as default when none is marked", () => {
      expect(getDefaultLanguage([lang("en-US"), lang("de-DE")])?.languageCode).toBe("en-US");
      expect(getTargetLanguages([lang("en-US"), lang("de-DE")]).map((l) => l.languageCode)).toEqual(
        ["de-DE"],
      );
    });

    it("should handle a missing language list", () => {
      expect(getDefaultLanguage(undefined)).toBeUndefined();
      expect(getTargetLanguages(undefined)).toEqual([]);
    });
  });

  describe("stripRuleMarker", () => {
    it("should remove one trailing marker and trim", () => {
      expect(stripRuleMarker("Definition ⟦rule: de-DE→x⟧ ")).toBe("Definition");
      expect(stripRuleMarker("⟦rule: keep as-is in all languages⟧")).toBe("");
    });

    it("should leave text without a marker unchanged", () => {
      expect(stripRuleMarker(" Plain ")).toBe("Plain");
      expect(stripRuleMarker(undefined)).toBe("");
      expect(stripRuleMarker("⟦rule: x⟧ in the middle")).toBe("⟦rule: x⟧ in the middle");
    });

    it("should strip only the last marker when the definition contains brackets", () => {
      expect(stripRuleMarker("A ⟦b⟧ c ⟦rule: de-DE→x⟧")).toBe("A ⟦b⟧ c");
    });
  });
});
