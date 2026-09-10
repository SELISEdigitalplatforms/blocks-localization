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

  it("returns opaque sticky body backgrounds for default, hover, and selected states", () => {
    const selectClasses = getStickyBodyCellClassName("select");
    const actionsClasses = getStickyBodyCellClassName("actions");

    expect(selectClasses).toContain("bg-background");
    expect(selectClasses).toContain("group-hover:bg-[linear-gradient(");
    expect(selectClasses).not.toContain("group-hover:bg-muted/50");
    expect(selectClasses).toContain("group-data-[state=selected]:bg-muted");
    expect(actionsClasses).toContain("sticky left-12");
    expect(actionsClasses).toContain("group-hover:bg-[linear-gradient(");
    expect(getStickyBodyCellClassName("moduleId")).toBe("");
  });
});
