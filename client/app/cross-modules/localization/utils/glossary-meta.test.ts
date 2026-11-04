import { describe, expect, it } from "vitest";

import { createDefaultGlossaryMeta, parseGlossaryMeta } from "./glossary-meta";

const PREFIX = "@@glossary-meta:v1@@";

describe("utils/glossary-meta", () => {
  describe("parseGlossaryMeta", () => {
    it("should return defaults for an empty or missing note", () => {
      for (const value of [undefined, ""]) {
        const parsed = parseGlossaryMeta(value);
        expect(parsed).toEqual({ meta: createDefaultGlossaryMeta(), status: "plain", raw: "" });
        expect(parsed.meta.note).toBeUndefined();
      }
    });

    it("should keep a plain-text note unchanged (Example 1)", () => {
      const parsed = parseGlossaryMeta("Use in onboarding only");
      expect(parsed.status).toBe("plain");
      expect(parsed.meta.rule).toBe("translate");
      expect(parsed.meta.note).toBe("Use in onboarding only");
    });

    it("should read structured data", () => {
      const parsed = parseGlossaryMeta(
        `${PREFIX}{"rule":"keep","caseSensitive":true,"variants":["SELISE AG"],"note":"x"}`,
      );
      expect(parsed.status).toBe("structured");
      expect(parsed.meta).toEqual({
        rule: "keep",
        caseSensitive: true,
        variants: ["SELISE AG"],
        translations: {},
        forbidden: {},
        note: "x",
      });
    });

    it("should fall back per field when types are wrong", () => {
      const parsed = parseGlossaryMeta(
        `${PREFIX}{"rule":"other","caseSensitive":"yes","variants":"a","translations":[1],"forbidden":{"de-DE":"x"},"note":5}`,
      );
      expect(parsed.status).toBe("structured");
      expect(parsed.meta).toEqual(createDefaultGlossaryMeta());
    });

    it("should drop non-string and empty items", () => {
      const parsed = parseGlossaryMeta(
        `${PREFIX}{"variants":["a",1," ",null,"b"],"translations":{"de-DE":" ","fr-FR":"x"},"forbidden":{"de-DE":["",2,"y"],"fr-FR":[]}}`,
      );
      expect(parsed.meta.variants).toEqual(["a", "b"]);
      expect(parsed.meta.translations).toEqual({ "fr-FR": "x" });
      expect(parsed.meta.forbidden).toEqual({ "de-DE": ["y"] });
    });

    it("should keep entries for culture codes that are not in the project (Example 6)", () => {
      const parsed = parseGlossaryMeta(
        `${PREFIX}{"rule":"translate","translations":{"it-IT":"x"}}`,
      );
      expect(parsed.meta.translations).toEqual({ "it-IT": "x" });
    });

    it("should report corrupt JSON and keep the full raw string as the note (Example 4)", () => {
      const raw = `${PREFIX}{broken`;
      const parsed = parseGlossaryMeta(raw);
      expect(parsed.status).toBe("corrupt");
      expect(parsed.meta.note).toBe(raw);
      expect(parsed.raw).toBe(raw);
    });

    it("should treat a JSON array or null as corrupt", () => {
      expect(parseGlossaryMeta(`${PREFIX}[]`).status).toBe("corrupt");
      expect(parseGlossaryMeta(`${PREFIX}null`).status).toBe("corrupt");
    });

    it("should report an unsupported version (Example 5)", () => {
      const parsed = parseGlossaryMeta("@@glossary-meta:v2@@{}");
      expect(parsed.status).toBe("unsupported-version");
      expect(parsed.meta).toEqual(createDefaultGlossaryMeta());
    });
  });

  it("should parse 50 terms in at most 2 ms (performance budget)", () => {
    const languages = Array.from({ length: 10 }, (_, i) => `l${i}-XX`);
    const note =
      PREFIX +
      JSON.stringify({
        rule: "translate",
        caseSensitive: true,
        variants: ["a", "b", "c"],
        translations: Object.fromEntries(languages.map((code) => [code, `value for ${code}`])),
        forbidden: Object.fromEntries(languages.map((code) => [code, ["x", "y"]])),
        note: "note",
      });
    // Warm up, then take the best of several runs to avoid CI noise.
    for (let i = 0; i < 200; i++) parseGlossaryMeta(note);
    const runs = Array.from({ length: 5 }, () => {
      const start = performance.now();
      for (let i = 0; i < 50; i++) parseGlossaryMeta(note);
      return performance.now() - start;
    });
    expect(Math.min(...runs)).toBeLessThanOrEqual(2);
  });
});
