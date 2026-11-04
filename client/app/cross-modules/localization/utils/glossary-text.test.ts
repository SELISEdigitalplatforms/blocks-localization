import { describe, expect, it } from "vitest";

import {
  alignCultureKeys,
  findCultureEntry,
  isNoSpaceCulture,
  isWordStart,
} from "@blocks-localization/utils/glossary-text";

describe("utils/glossary-text", () => {
  it.each(["zh-CN", "ja", "th-TH", "lo", "km-KH", "my_MM"])("treats %s as a no-space culture", (code) => {
    expect(isNoSpaceCulture(code)).toBe(true);
  });

  it.each(["en-US", "ko-KR", "", undefined])("treats %s as a spaced culture", (code) => {
    expect(isNoSpaceCulture(code)).toBe(false);
  });

  it("detects word starts on letters and digits, including astral letters", () => {
    expect(isWordStart("Open Workspace", 5)).toBe(true);
    expect(isWordStart("OpenWorkspace", 4)).toBe(false);
    expect(isWordStart("7Workspace", 1)).toBe(false);
    expect(isWordStart("Workspace", 0)).toBe(true);
    expect(isWordStart("😀Workspace", 2)).toBe(true);
    expect(isWordStart("𝐀Workspace", 2)).toBe(false);
  });
});

describe("utils/glossary-text culture entries", () => {
  it("prefers the exact code, then another case, then the bare language", () => {
    expect(findCultureEntry({ "de-DE": "exact", "de-de": "case", de: "bare" }, "de-DE")).toBe(
      "exact",
    );
    expect(findCultureEntry({ "de-de": "case", de: "bare" }, "de-DE")).toBe("case");
    expect(findCultureEntry({ de: "bare" }, "de-DE")).toBe("bare");
    expect(findCultureEntry({ de: "bare" }, "de_AT")).toBe("bare");
  });

  it("never uses a regional entry for a bare language or another region", () => {
    expect(findCultureEntry({ "de-DE": "x" }, "de")).toBeUndefined();
    expect(findCultureEntry({ "de-AT": "x" }, "de-DE")).toBeUndefined();
    expect(findCultureEntry({}, "de-DE")).toBeUndefined();
  });

  it("moves entries onto the project's code, the exact one winning a merge", () => {
    const keep = (kept: string, moved: string) => (kept ? kept : moved);
    expect(alignCultureKeys({ "de-de": "Arbeitsbereich", fr: "x" }, ["de-DE"], keep)).toEqual({
      "de-DE": "Arbeitsbereich",
      fr: "x",
    });
    expect(alignCultureKeys({ "de-de": "old", "de-DE": "new" }, ["de-DE"], keep)).toEqual({
      "de-DE": "new",
    });
    expect(alignCultureKeys({ "de-de": "old", "de-DE": "" }, ["de-DE"], keep)).toEqual({
      "de-DE": "old",
    });
  });
});
