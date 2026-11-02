import { describe, expect, it } from "vitest";

import { IGlossary } from "@blocks-localization/models/language";
import { GlossaryMatch } from "@blocks-localization/models/glossary-match";
import {
  findDuplicateGlossary,
  isMatchedGlossaryName,
  normalizeGlossaryName,
} from "./glossary-name";

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

describe("utils/glossary-name isMatchedGlossaryName", () => {
  const workspace = {
    glossary: { itemId: "g1", name: "Workspace", createDate: "", lastUpdateDate: "" },
    meta: {
      rule: "translate",
      caseSensitive: false,
      variants: ["workspaces"],
      translations: {},
      forbidden: {},
    },
    definition: "",
    start: 10,
    length: 9,
    surface: "WORKSPACE",
    scope: "global",
    status: "approved",
  } as GlossaryMatch;

  it("is true for the name, a variant or the matched text in any letter case", () => {
    expect(isMatchedGlossaryName(" workspace ", [workspace])).toBe(true);
    expect(isMatchedGlossaryName("Workspaces", [workspace])).toBe(true);
    expect(isMatchedGlossaryName("WORKSPACE", [workspace])).toBe(true);
  });

  it("is false for other text, empty text or no matches", () => {
    expect(isMatchedGlossaryName("Open your Workspace", [workspace])).toBe(false);
    expect(isMatchedGlossaryName("  ", [workspace])).toBe(false);
    expect(isMatchedGlossaryName("Workspace", [])).toBe(false);
  });
});
