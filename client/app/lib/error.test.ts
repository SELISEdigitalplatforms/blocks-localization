import { describe, expect, it } from "vitest";

import {
  FORBIDDEN_ERROR_MESSAGE,
  formatErrorMessage,
  getErrorMessage,
  getForbiddenErrorMessage,
  handleErrorMessages,
  isErrorWithErrors,
} from "@/lib/error";

const UNEXPECTED_ERROR_MESSAGE = "An unexpected error occurred. Please try again.";

describe("lib/error", () => {
  describe("getForbiddenErrorMessage", () => {
    it("should provide the frontend fallback for a 403 response without details", () => {
      expect(getForbiddenErrorMessage({ Status: 403, errors: {} })).toBe(FORBIDDEN_ERROR_MESSAGE);
    });

    it("should recognize a JSON-stringified 403 response", () => {
      expect(getForbiddenErrorMessage('{"Status":403,"errors":{}}')).toBe(FORBIDDEN_ERROR_MESSAGE);
    });

    it("should preserve a backend description from a nested 403 response", () => {
      expect(
        getForbiddenErrorMessage({
          response: {
            status: 403,
            data: { errors: { description: "Your role cannot update this key." } },
          },
        }),
      ).toBe("Your role cannot update this key.");
    });

    it("should not replace non-403 errors", () => {
      expect(getForbiddenErrorMessage({ status: 500, errors: {} })).toBeNull();
    });
  });

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

    it("should provide the forbidden fallback for a 403 without a backend description", () => {
      expect(handleErrorMessages({ Status: 403, errors: {} })).toBe(FORBIDDEN_ERROR_MESSAGE);
    });
  });

  // ─── formatErrorMessage ──────────────────────────────────────────────────────
  describe("formatErrorMessage", () => {
    it("H1 — returns a plain string trimmed and without extra quotes", () => {
      expect(formatErrorMessage("Tenant limit reached")).toBe("Tenant limit reached");
      expect(formatErrorMessage("  spaces  ")).toBe("spaces");
    });

    it("H2 — returns an Error instance's message", () => {
      expect(formatErrorMessage(new Error("network timeout"))).toBe("network timeout");
      expect(formatErrorMessage(new Error(""))).toBe(UNEXPECTED_ERROR_MESSAGE);
    });

    it("H3 — returns the errorMessage property of an object", () => {
      expect(formatErrorMessage({ errorMessage: "Save failed" })).toBe("Save failed");
    });

    it("H4 — joins an errors key-value map with '; '", () => {
      expect(formatErrorMessage({ errors: { itemId: "Glossary not found" } })).toBe(
        "Glossary not found",
      );
      expect(formatErrorMessage({ errors: { a: "First", b: "Second" } })).toBe("First; Second");
    });

    it("H5 — joins an errors string array with '; '", () => {
      expect(formatErrorMessage({ errors: ["Field required", "Invalid format"] })).toBe(
        "Field required; Invalid format",
      );
    });

    it("H6 — falls back to the safe message for unrecognized input", () => {
      expect(formatErrorMessage(null)).toBe(UNEXPECTED_ERROR_MESSAGE);
      expect(formatErrorMessage(undefined)).toBe(UNEXPECTED_ERROR_MESSAGE);
      expect(formatErrorMessage({})).toBe(UNEXPECTED_ERROR_MESSAGE);
      expect(formatErrorMessage(123)).toBe(UNEXPECTED_ERROR_MESSAGE);
    });

    it("C1 — no longer produces double-quoted strings for a string value", () => {
      const result = formatErrorMessage("Tenant limit reached");
      expect(result).toBe("Tenant limit reached");
      expect(result).not.toBe(JSON.stringify("Tenant limit reached"));
    });

    it("C2 — produces a human-readable string for a raw error object", () => {
      expect(formatErrorMessage({ itemId: "Glossary item not found" })).toBe(
        "Glossary item not found",
      );
    });

    it("C3 — returns .message instead of the empty JSON.stringify('{}') for a native Error", () => {
      const error = new Error("network timeout");
      expect(JSON.stringify(error)).toBe("{}");
      expect(formatErrorMessage(error)).toBe("network timeout");
    });

    it("C4 — never throws and falls back for an object with no recognizable shape", () => {
      expect(() => formatErrorMessage({ foo: 123, bar: null })).not.toThrow();
      expect(formatErrorMessage({ foo: 123, bar: null })).toBe(UNEXPECTED_ERROR_MESSAGE);
    });

    it("C5 — always returns a non-empty string", () => {
      [null, undefined, {}, 123, "", new Error(), [], { errors: {} }].forEach((input) => {
        const result = formatErrorMessage(input);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });
});
