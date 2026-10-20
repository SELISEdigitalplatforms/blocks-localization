import { describe, expect, it } from "vitest";

import { GlossaryMeta } from "@blocks-localization/models/glossary-meta";
import { ILanguageConfig } from "@blocks-localization/models/language";
import { createDefaultGlossaryMeta } from "./glossary-meta";
import {
  MARKER_MAX_LENGTH,
  buildGlossaryContext,
  buildRuleMarker,
  getTargetLanguages,
  stripRuleMarker,
} from "./glossary-rule-marker";

const lang = (languageCode: string, isDefault = false): ILanguageConfig => ({
  itemId: languageCode,
  languageCode,
  languageName: languageCode,
  isDefault,
});
const languages = [lang("en-US", true), lang("de-DE"), lang("fr-FR")];
const meta = (overrides: Partial<GlossaryMeta>): GlossaryMeta => ({
  ...createDefaultGlossaryMeta(),
  ...overrides,
});

describe("utils/glossary-rule-marker", () => {
  it("should build the translate marker of Example 2", () => {
    const marker = buildRuleMarker(
      meta({
        translations: { "fr-FR": "Espace de travail", "de-DE": "Arbeitsbereich" },
        forbidden: { "de-DE": ["Werkbereich"] },
      }),
      languages,
    );
    expect(marker).toBe(
      "⟦rule: de-DE→Arbeitsbereich; fr-FR→Espace de travail; avoid de-DE: Werkbereich⟧",
    );
    expect(buildGlossaryContext("A container for projects shared by a team.", marker)).toBe(
      "A container for projects shared by a team. ⟦rule: de-DE→Arbeitsbereich; fr-FR→Espace de travail; avoid de-DE: Werkbereich⟧",
    );
  });

  it("should follow project language order and skip the default and unknown languages", () => {
    const marker = buildRuleMarker(
      meta({ translations: { "fr-FR": "b", "en-US": "x", "it-IT": "y", "de-DE": "a" } }),
      [lang("fr-FR"), lang("en-US", true), lang("de-DE")],
    );
    expect(marker).toBe("⟦rule: fr-FR→b; de-DE→a⟧");
  });

  it("should use the first language as default when none is marked", () => {
    expect(getTargetLanguages([lang("en-US"), lang("de-DE")]).map((l) => l.languageCode)).toEqual([
      "de-DE",
    ]);
  });

  it("should build the keep marker (Example 3)", () => {
    const marker = buildRuleMarker(
      meta({ rule: "keep", translations: { "de-DE": "x" } }),
      languages,
    );
    expect(buildGlossaryContext("Company name.", marker)).toBe(
      "Company name. ⟦rule: keep as-is in all languages⟧",
    );
  });

  it("should build the forbidden marker", () => {
    expect(buildRuleMarker(meta({ rule: "forbidden" }), languages)).toBe(
      "⟦rule: do not use this term⟧",
    );
    expect(
      buildRuleMarker(
        meta({ rule: "forbidden", forbidden: { "de-DE": ["a", "b"], "fr-FR": ["c"] } }),
        languages,
      ),
    ).toBe("⟦rule: do not use this term; avoid de-DE: a, b; avoid fr-FR: c⟧");
  });

  it("should return null and save no marker when translate has nothing to say", () => {
    const marker = buildRuleMarker(meta({}), languages);
    expect(marker).toBeNull();
    expect(buildGlossaryContext("Definition", marker)).toBe("Definition");
    expect(buildGlossaryContext("", marker)).toBe("");
  });

  it("should use the marker alone when the definition is empty", () => {
    expect(buildGlossaryContext("  ", "⟦rule: keep as-is in all languages⟧")).toBe(
      "⟦rule: keep as-is in all languages⟧",
    );
  });

  it("should sanitize marker values only", () => {
    const marker = buildRuleMarker(
      meta({ translations: { "de-DE": 'A;B→"C"\r\n⟦D⟧   E' } }),
      languages,
    );
    expect(marker).toBe("⟦rule: de-DE→A B C D E⟧");
  });

  it("should cut each value to 80 characters", () => {
    const marker = buildRuleMarker(meta({ translations: { "de-DE": "x".repeat(200) } }), languages);
    expect(marker).toBe(`⟦rule: de-DE→${"x".repeat(80)}⟧`);
  });

  it("should cap the marker at 500 characters without cutting an entry", () => {
    const many = Array.from({ length: 20 }, (_, i) => lang(`l${String(i).padStart(2, "0")}-XX`));
    const marker = buildRuleMarker(
      meta({
        translations: Object.fromEntries(many.map((l) => [l.languageCode, "y".repeat(60)])),
      }),
      [lang("en-US", true), ...many],
    )!;
    expect(marker.length).toBeLessThanOrEqual(MARKER_MAX_LENGTH);
    const entries = marker.slice("⟦rule: ".length, -1).split("; ");
    // Whole entries, in project language order.
    entries.forEach((entry, i) => expect(entry).toBe(`${many[i].languageCode}→${"y".repeat(60)}`));
    expect(entries.length).toBeLessThan(many.length);
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

    it("should regenerate exactly one marker when re-saving (C9)", () => {
      const context = "Definition ⟦rule: de-DE→old⟧";
      const saved = buildGlossaryContext(stripRuleMarker(context), "⟦rule: de-DE→new⟧");
      expect(saved).toBe("Definition ⟦rule: de-DE→new⟧");
      expect(buildGlossaryContext(context, "⟦rule: de-DE→new⟧")).toBe(saved);
    });
  });
});
