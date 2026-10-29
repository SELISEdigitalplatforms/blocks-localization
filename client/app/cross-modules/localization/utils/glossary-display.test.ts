import { describe, expect, it } from "vitest";

import { IGlossary } from "@blocks-localization/models/language";
import {
  getGlossaryNote,
  getGlossaryStatus,
  isUnsupportedGlossaryNote,
  toGlossaryMeta,
} from "@blocks-localization/utils/glossary-display";

const glossary = (overrides: Partial<IGlossary> = {}): IGlossary => ({
  itemId: "g1",
  name: "Workspace",
  createDate: "",
  lastUpdateDate: "",
  ...overrides,
});

describe("utils/glossary-display", () => {
  describe("toGlossaryMeta", () => {
    it("maps the API structured fields to the Phase 2 meta shape", () => {
      const meta = toGlossaryMeta(
        glossary({
          rule: "translate",
          caseSensitive: true,
          variants: [" Workspaces ", ""],
          translations: [
            { language: "de-DE", value: " Arbeitsbereich ", forbiddenValues: ["Werkbereich", " "] },
            { language: "fr-FR", value: "", forbiddenValues: ["Atelier"] },
          ],
          additionalNote: "Approved by marketing",
        }),
      );
      expect(meta).toEqual({
        rule: "translate",
        caseSensitive: true,
        variants: ["Workspaces"],
        translations: { "de-DE": "Arbeitsbereich" },
        forbidden: { "de-DE": ["Werkbereich"], "fr-FR": ["Atelier"] },
        note: "Approved by marketing",
      });
    });

    it("defaults missing fields (Translate, not case-sensitive, no values, no note)", () => {
      expect(toGlossaryMeta(glossary())).toEqual({
        rule: "translate",
        caseSensitive: false,
        variants: [],
        translations: {},
        forbidden: {},
      });
    });

    it("keeps values that are inactive under Keep (Phase 2 A9)", () => {
      const meta = toGlossaryMeta(
        glossary({
          rule: "keep",
          translations: [{ language: "de-DE", value: "Arbeitsbereich", forbiddenValues: ["X"] }],
        }),
      );
      expect(meta.rule).toBe("keep");
      expect(meta.translations).toEqual({ "de-DE": "Arbeitsbereich" });
      expect(meta.forbidden).toEqual({ "de-DE": ["X"] });
    });

    it("reads the rule from the API even when additionalNote still holds JSON", () => {
      const meta = toGlossaryMeta(
        glossary({
          rule: "keep",
          schemaVersion: 2,
          additionalNote: '@@glossary-meta:v1@@{"rule":"keep","note":"brand"}',
        }),
      );
      expect(meta.rule).toBe("keep");
      expect(meta.note).toBe("brand");
    });
  });

  describe("getGlossaryNote", () => {
    it("returns a plain note as is", () => {
      expect(getGlossaryNote(glossary({ additionalNote: "Approved by marketing" }))).toBe(
        "Approved by marketing",
      );
    });

    it("returns the note inside v1 JSON (legacy document)", () => {
      expect(
        getGlossaryNote(
          glossary({ additionalNote: '@@glossary-meta:v1@@{"rule":"translate","note":"Internal"}' }),
        ),
      ).toBe("Internal");
    });

    it("returns the note inside v1 JSON on a schema-2 document saved by the Track A UI", () => {
      expect(
        getGlossaryNote(
          glossary({
            schemaVersion: 2,
            additionalNote: '@@glossary-meta:v1@@{"rule":"keep","note":"brand"}',
          }),
        ),
      ).toBe("brand");
    });

    it("returns an empty note for v1 JSON without one", () => {
      expect(getGlossaryNote(glossary({ additionalNote: '@@glossary-meta:v1@@{"rule":"keep"}' }))).toBe("");
    });

    it("returns the whole raw text for corrupt v1 JSON", () => {
      const raw = "@@glossary-meta:v1@@{not json";
      expect(getGlossaryNote(glossary({ additionalNote: raw }))).toBe(raw);
    });

    it("returns no note for an unsupported version and for a missing note", () => {
      expect(getGlossaryNote(glossary({ additionalNote: "@@glossary-meta:v2@@{}" }))).toBe("");
      expect(getGlossaryNote(glossary())).toBe("");
    });
  });

  describe("isUnsupportedGlossaryNote", () => {
    it.each([
      ["@@glossary-meta:v2@@{}", true],
      ["@@glossary-meta:v10@@{}", true],
      ['@@glossary-meta:v1@@{"rule":"keep"}', false],
      ["plain note", false],
      [undefined, false],
    ])("%s → %s", (additionalNote, expected) => {
      expect(isUnsupportedGlossaryNote(glossary({ additionalNote }))).toBe(expected);
    });
  });

  describe("getGlossaryStatus", () => {
    it("defaults a missing or unknown status to approved", () => {
      expect(getGlossaryStatus({})).toBe("approved");
      expect(getGlossaryStatus({ status: "weird" as never })).toBe("approved");
      expect(getGlossaryStatus({ status: "draft" })).toBe("draft");
      expect(getGlossaryStatus({ status: "deprecated" })).toBe("deprecated");
    });
  });
});
