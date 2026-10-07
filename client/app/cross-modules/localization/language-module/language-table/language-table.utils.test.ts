import { describe, expect, it } from "vitest";

import {
  getStickyBodyCellClassName,
  getStickyHeaderClassName,
  getStretchedColumnWidths,
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
    expect(getStickyHeaderClassName("select")).toContain("pl-2");
    expect(getStickyHeaderClassName("select")).toContain("pr-2");
    expect(getStickyHeaderClassName("actions")).toContain("sticky left-8");
    expect(getStickyHeaderClassName("actions")).toContain("pl-2");
    expect(getStickyHeaderClassName("actions")).toContain("pr-2");
    expect(getStickyHeaderClassName("keyName")).toBe("");
  });

  it("returns opaque sticky body backgrounds for default, hover, and selected states", () => {
    const selectClasses = getStickyBodyCellClassName("select");
    const actionsClasses = getStickyBodyCellClassName("actions");

    expect(selectClasses).toContain("bg-background");
    expect(selectClasses).toContain("pl-2");
    expect(selectClasses).toContain("pr-2");
    expect(selectClasses).toContain("group-hover:bg-[linear-gradient(");
    expect(selectClasses).not.toContain("group-hover:bg-muted/50");
    expect(selectClasses).toContain("group-data-[state=selected]:bg-muted");
    expect(actionsClasses).toContain("sticky left-8");
    expect(actionsClasses).toContain("pl-2");
    expect(actionsClasses).toContain("pr-2");
    expect(actionsClasses).toContain("group-hover:bg-[linear-gradient(");
    expect(getStickyBodyCellClassName("moduleId")).toBe("");
  });
});

describe("getStretchedColumnWidths", () => {
  const columnIds = ["select", "actions", "keyName", "moduleId", "resources_en-US"];

  it("does not stretch when the columns already fill or overflow the viewport", () => {
    expect(getStretchedColumnWidths(columnIds, 500, 1280)).toEqual({});
  });

  it("stretches data columns proportionally and keeps sticky columns fixed", () => {
    const widths = getStretchedColumnWidths(columnIds, 80 + 646 * 2, 1280);
    expect(widths).toEqual({ keyName: 464, moduleId: 364, "resources_en-US": 464 });
    expect(widths.select).toBeUndefined();
    expect(widths.actions).toBeUndefined();
  });
});
