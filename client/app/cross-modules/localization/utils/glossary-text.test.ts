import { describe, expect, it } from "vitest";

import { isNoSpaceCulture, isWordStart } from "@blocks-localization/utils/glossary-text";

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
