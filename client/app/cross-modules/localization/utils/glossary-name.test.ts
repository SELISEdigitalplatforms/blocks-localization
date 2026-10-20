import { describe, expect, it } from "vitest";

import { IGlossary } from "@blocks-localization/models/language";
import { findDuplicateGlossary, normalizeGlossaryName } from "./glossary-name";

const glossary = (itemId: string, name: string): IGlossary => ({
  itemId,
  name,
  createDate: "",
  lastUpdateDate: "",
});

describe("utils/glossary-name", () => {
  describe("normalizeGlossaryName", () => {
    it("should trim surrounding whitespace", () => {
      expect(normalizeGlossaryName("  Workspace \t")).toBe("workspace");
    });

    it("should ignore letter case", () => {
      expect(normalizeGlossaryName("WorkSPACE")).toBe(normalizeGlossaryName("workspace"));
    });

    it("should apply NFC normalization", () => {
      const decomposed = "Café";
      const composed = "Café";
      expect(normalizeGlossaryName(decomposed)).toBe(normalizeGlossaryName(composed));
    });
  });

  describe("findDuplicateGlossary", () => {
    const items = [glossary("g1", "Workspace"), glossary("g2", "Workspace2")];

    it("should return the case-insensitive exact match", () => {
      expect(findDuplicateGlossary("workspace ", items)?.itemId).toBe("g1");
    });

    it("should not match partial names", () => {
      expect(findDuplicateGlossary("Work", items)).toBeUndefined();
    });

    it("should ignore the glossary being edited", () => {
      expect(findDuplicateGlossary("Workspace", items, "g1")).toBeUndefined();
    });

    it("should return undefined for blank input or no data", () => {
      expect(findDuplicateGlossary("   ", items)).toBeUndefined();
      expect(findDuplicateGlossary("Workspace", undefined)).toBeUndefined();
    });
  });
});
