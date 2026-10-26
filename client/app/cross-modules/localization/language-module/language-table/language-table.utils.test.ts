import { describe, expect, it } from "vitest";

import {
  areAllRowsSelected,
  getDeleteKeyErrorMessage,
  getKeyListErrorCode,
  getPageSizeOptions,
  getStickyBodyCellClassName,
  getStickyHeaderClassName,
  getStretchedColumnWidths,
  isStickyLeftColumn,
  parseKeyPageSize,
  toKeyPageSize,
  withRowsSelected,
} from "./language-table.utils";

describe("getDeleteKeyErrorMessage", () => {
  const fallback = "Failed to delete key. Please try again.";

  it.each([
    ["no errors", null, fallback],
    ["a plain string", "bad", fallback],
    ["an empty list", [], fallback],
    ["an empty map", {}, fallback],
    ["a list", ["a", "b"], "a, b"],
    ["a map with a string message", { field: "bad", other: "worse" }, "bad"],
    ["a map without a string message", { field: { code: 1 } }, '{"field":{"code":1}}'],
  ])("reports %s", (_label, errors, expected) => {
    expect(getDeleteKeyErrorMessage(errors)).toBe(expected);
  });
});

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

describe("getPageSizeOptions", () => {
  it("returns only the smallest option when everything fits on one page", () => {
    expect(getPageSizeOptions(0)).toEqual([10]);
    expect(getPageSizeOptions(7)).toEqual([10]);
    expect(getPageSizeOptions(10)).toEqual([10]);
  });

  it("does not list totalCount twice when it equals a fixed option", () => {
    expect(getPageSizeOptions(30)).toEqual([10, 30]);
    expect(getPageSizeOptions(100)).toEqual([10, 30, 50, 100]);
  });

  it("appends totalCount as the all option", () => {
    expect(getPageSizeOptions(25)).toEqual([10, 25]);
    expect(getPageSizeOptions(250)).toEqual([10, 30, 50, 100, 250]);
  });
});

describe("parseKeyPageSize", () => {
  it("keeps the presets and the All view", () => {
    expect(parseKeyPageSize("10")).toBe(10);
    expect(parseKeyPageSize("100")).toBe(100);
    expect(parseKeyPageSize("all")).toBe("all");
  });

  it("opens the All view for an old bookmarked All (n) size", () => {
    expect(parseKeyPageSize("101")).toBe("all");
    expect(parseKeyPageSize("1234")).toBe("all");
  });

  it("snaps any other size up to the nearest preset", () => {
    expect(parseKeyPageSize("1")).toBe(10);
    expect(parseKeyPageSize("20")).toBe(30);
    expect(parseKeyPageSize("31")).toBe(50);
  });

  it("rejects invalid sizes so the default applies", () => {
    expect(parseKeyPageSize("abc")).toBeNull();
    expect(parseKeyPageSize("-5")).toBeNull();
    expect(parseKeyPageSize("0")).toBeNull();
    expect(parseKeyPageSize("2.5")).toBeNull();
    expect(parseKeyPageSize("")).toBeNull();
  });
});

describe("toKeyPageSize", () => {
  it("maps the All (n) option to the All view", () => {
    expect(toKeyPageSize(250, 250)).toBe("all");
    expect(toKeyPageSize(25, 25)).toBe("all");
  });

  it("keeps a preset, even when it equals the total", () => {
    expect(toKeyPageSize(30, 250)).toBe(30);
    expect(toKeyPageSize(100, 100)).toBe(100);
  });
});

describe("getKeyListErrorCode", () => {
  it("reads the code from a failed request's errors map", () => {
    expect(getKeyListErrorCode({ status: 400, errors: { Cursor: "CURSOR_MISMATCH" } })).toBe(
      "CURSOR_MISMATCH",
    );
    expect(getKeyListErrorCode({ errors: { Query: ["QUERY_TIMEOUT"] } })).toBe("QUERY_TIMEOUT");
  });

  it("returns undefined when there is no errors map", () => {
    expect(getKeyListErrorCode(null)).toBeUndefined();
    expect(getKeyListErrorCode(new Error("network"))).toBeUndefined();
  });
});

describe("areAllRowsSelected", () => {
  it("is true only when every row is selected", () => {
    expect(areAllRowsSelected(["a", "b"], { a: true, b: true, c: true })).toBe(true);
    expect(areAllRowsSelected(["a", "b"], { a: true })).toBe(false);
  });

  it("is false when there are no rows", () => {
    expect(areAllRowsSelected([], { a: true })).toBe(false);
  });
});

describe("withRowsSelected", () => {
  it("adds the unselected rows and keeps the rest", () => {
    expect(withRowsSelected({ a: true }, ["a", "b"])).toEqual({ a: true, b: true });
  });

  it("returns the same selection when nothing is added", () => {
    const selection = { a: true };
    expect(withRowsSelected(selection, ["a"])).toBe(selection);
  });
});
