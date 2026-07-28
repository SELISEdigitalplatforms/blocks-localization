import { describe, expect, it } from "vitest";

import { getErrorMessage, handleErrorMessages, isErrorWithErrors } from "@/lib/error";

describe("lib/error", () => {
  // ─── getErrorMessage ─────────────────────────────────────────────────────────
  describe("getErrorMessage", () => {
    it("should return fallback for null/empty error", () => {
      expect(getErrorMessage(null as never)).toBe("Something went wrong.");
      expect(getErrorMessage({})).toBe("Something went wrong.");
    });

    it("should use the messageMap override when present", () => {
      const result = getErrorMessage({ code_invalid: "raw" }, { code_invalid: "Friendly message" });
      expect(result).toEqual(["Friendly message"]);
    });

    it("should push string values directly", () => {
      expect(getErrorMessage({ field: "is required" })).toEqual(["is required"]);
    });

    it("should join non-empty array values with a comma", () => {
      expect(getErrorMessage({ field: ["a", "b"] })).toEqual(["a, b"]);
    });

    it("should skip empty array values", () => {
      // Only empty arrays → no messages → fallback string.
      expect(getErrorMessage({ field: [] })).toBe("Something went wrong.");
    });

    it("should combine multiple keys", () => {
      const result = getErrorMessage({
        a: "first",
        b: ["second", "third"],
      });
      expect(result).toEqual(["first", "second, third"]);
    });
  });

  // ─── isErrorWithErrors ───────────────────────────────────────────────────────
  describe("isErrorWithErrors", () => {
    it("should return true for an object with an errors object", () => {
      expect(isErrorWithErrors({ errors: { a: "x" } })).toBe(true);
    });
    it("should return false for null", () => {
      expect(isErrorWithErrors(null)).toBe(false);
    });
    it("should return false for a non-object", () => {
      expect(isErrorWithErrors("oops")).toBe(false);
    });
    it("should return false when errors is not an object", () => {
      expect(isErrorWithErrors({ errors: "string" })).toBe(false);
    });
    it("should return false when errors key is absent", () => {
      expect(isErrorWithErrors({ other: 1 })).toBe(false);
    });
  });

  // ─── handleErrorMessages ─────────────────────────────────────────────────────
  describe("handleErrorMessages", () => {
    it("should return the string when given a string", () => {
      expect(handleErrorMessages("boom")).toBe("boom");
    });

    it("should delegate to getErrorMessage for object errors", () => {
      expect(handleErrorMessages({ field: "bad" })).toEqual(["bad"]);
    });

    it("should pass custom messages through", () => {
      expect(handleErrorMessages({ key: "raw" }, { key: "Custom" })).toEqual(["Custom"]);
    });

    it("should return the unexpected fallback for arrays", () => {
      expect(handleErrorMessages([1, 2, 3])).toBe("An unexpected error occurred.");
    });

    it("should return the unexpected fallback for null/number", () => {
      expect(handleErrorMessages(null)).toBe("An unexpected error occurred.");
      expect(handleErrorMessages(42)).toBe("An unexpected error occurred.");
    });
  });
});
