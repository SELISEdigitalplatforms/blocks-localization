import { describe, expect, it } from "vitest";

import { toGlossaryNameFromSelection } from "./use-source-text-selection";

describe("toGlossaryNameFromSelection", () => {
  it("collapses inner whitespace and trims", () => {
    expect(toGlossaryNameFromSelection("  Customer\n  Portal \t")).toBe("Customer Portal");
  });

  it("returns nothing for an empty or whitespace-only selection (C5)", () => {
    expect(toGlossaryNameFromSelection("")).toBeUndefined();
    expect(toGlossaryNameFromSelection("   \n ")).toBeUndefined();
    expect(toGlossaryNameFromSelection(undefined)).toBeUndefined();
  });

  it("accepts 200 characters and rejects longer selections after trimming (C5)", () => {
    expect(toGlossaryNameFromSelection(` ${"a".repeat(200)} `)).toHaveLength(200);
    expect(toGlossaryNameFromSelection("a".repeat(201))).toBeUndefined();
  });
});
