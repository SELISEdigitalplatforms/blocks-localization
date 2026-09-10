import { describe, expect, it } from "vitest";

import {
  getStickyBodyCellClassName,
  getStickyHeaderClassName,
  isStickyLeftColumn,
} from "./language-table.utils";

describe("language-table sticky column helpers", () => {
  it("identifies select and actions as sticky left columns", () => {
    expect(isStickyLeftColumn("select")).toBe(true);
    expect(isStickyLeftColumn("actions")).toBe(true);
    expect(isStickyLeftColumn("keyName")).toBe(false);
  });

  it("returns sticky header classes with left offsets for the pinned cluster", () => {
    expect(getStickyHeaderClassName("select")).toContain("sticky left-0");
    expect(getStickyHeaderClassName("actions")).toContain("sticky left-12");
    expect(getStickyHeaderClassName("keyName")).toBe("");
  });

  it("returns sticky body classes that preserve row hover and selected backgrounds", () => {
    expect(getStickyBodyCellClassName("select")).toContain("group-hover:bg-muted/50");
    expect(getStickyBodyCellClassName("select")).toContain("group-data-[state=selected]:bg-muted");
    expect(getStickyBodyCellClassName("actions")).toContain("sticky left-12");
    expect(getStickyBodyCellClassName("moduleId")).toBe("");
  });
});
