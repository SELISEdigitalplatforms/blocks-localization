import { describe, expect, it } from "vitest";

import {
  GLOSSARY_TYPE_OPTIONS,
  modules,
  translation,
  type GlossaryType,
} from "@blocks-localization/models/language";

describe("localization/models/language", () => {
  // ─── modules ──────────────────────────────────────────────────────────────
  describe("modules", () => {
    it("should expose exactly 4 module entries", () => {
      expect(modules).toHaveLength(4);
    });

    it("should expose UILM Tool as the first entry", () => {
      expect(modules[0]).toEqual({ value: "UILM Tool", label: "UILM Tool" });
    });

    it.each([
      ["UILM Tool"],
      ["Commission"],
      ["Performance"],
      ["Resource Centre"],
    ])("should contain module value %s", (value) => {
      expect(modules.some((m) => m.value === value)).toBe(true);
    });

    it("should have matching value and label for each entry", () => {
      for (const m of modules) {
        expect(m.value).toBe(m.label);
      }
    });
  });

  // ─── translation ─────────────────────────────────────────────────────────
  describe("translation", () => {
    it("should expose exactly 2 translation entries", () => {
      expect(translation).toHaveLength(2);
    });

    it("should have No translation as the first entry", () => {
      expect(translation[0]).toEqual({
        value: "No_translation",
        label: "No translation",
      });
    });

    it("should have Complete as the second entry", () => {
      expect(translation[1]).toEqual({ value: "Complete", label: "Complete" });
    });
  });

  // ─── GLOSSARY_TYPE_OPTIONS ───────────────────────────────────────────────
  describe("GLOSSARY_TYPE_OPTIONS", () => {
    const expectedTypes: GlossaryType[] = [
      "Full form",
      "Acronym",
      "Abbreviation",
      "Short form",
      "Phrase",
      "Variant",
    ];

    it("should expose exactly 6 glossary types", () => {
      expect(GLOSSARY_TYPE_OPTIONS).toHaveLength(6);
    });

    it.each(expectedTypes)("should include %s", (type) => {
      expect(GLOSSARY_TYPE_OPTIONS.some((opt) => opt.value === type)).toBe(
        true,
      );
    });

    it("should have value and label identical for each entry", () => {
      for (const opt of GLOSSARY_TYPE_OPTIONS) {
        expect(opt.value).toBe(opt.label);
      }
    });

    it("should not have duplicate values", () => {
      const values = GLOSSARY_TYPE_OPTIONS.map((o) => o.value);
      expect(new Set(values).size).toBe(values.length);
    });

    it("should not have duplicate labels", () => {
      const labels = GLOSSARY_TYPE_OPTIONS.map((o) => o.label);
      expect(new Set(labels).size).toBe(labels.length);
    });
  });
});
