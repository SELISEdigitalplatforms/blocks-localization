import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BREADCRUMB_CUSTOM_TITLES,
  checkValidDate,
  clearBreadCrumbTitleEntry,
  clearQueryString,
  cn,
  compareDates,
  debounce,
  deepEqual,
  formatDate,
  formatFullDate,
  formatSize,
  getUniqueID,
  parseDateString,
  parseMongoDBString,
} from "@/lib/utils";

describe("lib/utils", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ─── cn ────────────────────────────────────────────────────────────────────
  describe("cn", () => {
    it("should merge class names", () => {
      expect(cn("a", "b")).toBe("a b");
    });

    it("should dedupe tailwind conflicts (last wins)", () => {
      expect(cn("p-2", "p-4")).toBe("p-4");
    });

    it("should drop falsy values", () => {
      expect(cn("a", false, null, undefined, "b")).toBe("a b");
    });
  });

  // ─── formatDate ──────────────────────────────────────────────────────────────
  describe("formatDate", () => {
    it("should format with zero-padded day/month and time by default", () => {
      const date = new Date(2026, 0, 5, 9, 3); // Jan 5, 2026 09:03
      expect(formatDate(date)).toBe("05/01/2026, 09:03");
    });

    it("should omit time when withoutTime is true", () => {
      const date = new Date(2026, 11, 25, 14, 30);
      expect(formatDate(date, true)).toBe("25/12/2026");
    });
  });

  // ─── formatFullDate ──────────────────────────────────────────────────────────
  describe("formatFullDate", () => {
    it("should format month name with time by default", () => {
      const date = new Date(2026, 2, 7, 8, 9); // Mar 07, 2026 08:09
      expect(formatFullDate(date)).toBe("Mar 07, 2026 at 08:09");
    });

    it("should omit time when withoutTime is true", () => {
      const date = new Date(2026, 6, 1, 0, 0); // Jul 01, 2026
      expect(formatFullDate(date, true)).toBe("Jul 01, 2026");
    });
  });

  // ─── parseDateString ─────────────────────────────────────────────────────────
  describe("parseDateString", () => {
    it("should return a Date for a valid ISO string", () => {
      const d = parseDateString("2026-01-01T00:00:00.000Z");
      expect(d).toBeInstanceOf(Date);
      expect(d.getUTCFullYear()).toBe(2026);
    });
  });

  // ─── compareDates ────────────────────────────────────────────────────────────
  describe("compareDates", () => {
    it("should return negative when A is before B", () => {
      expect(compareDates("2026-01-01", "2026-01-02")).toBeLessThan(0);
    });
    it("should return positive when A is after B", () => {
      expect(compareDates("2026-01-02", "2026-01-01")).toBeGreaterThan(0);
    });
    it("should return zero for equal dates", () => {
      expect(compareDates("2026-01-01", "2026-01-01")).toBe(0);
    });
  });

  // ─── clearBreadCrumbTitleEntry ───────────────────────────────────────────────
  describe("clearBreadCrumbTitleEntry", () => {
    it("should null out a breadcrumb title entry", () => {
      clearBreadCrumbTitleEntry("/some/path");
      expect(BREADCRUMB_CUSTOM_TITLES["/some/path"]).toBeNull();
    });
  });

  // ─── debounce ────────────────────────────────────────────────────────────────
  describe("debounce", () => {
    it("should only invoke once after the delay when called repeatedly", () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const debounced = debounce(fn, 200);
      debounced();
      debounced();
      debounced();
      expect(fn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(200);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should forward args and preserve `this`", () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      debounced("a", "b");
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledWith("a", "b");
    });

    it("cancel() should prevent a pending invocation", () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      debounced();
      debounced.cancel();
      vi.advanceTimersByTime(200);
      expect(fn).not.toHaveBeenCalled();
    });

    it("cancel() should be a no-op when nothing is pending", () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      expect(() => debounced.cancel()).not.toThrow();
    });

    it("should default to 300ms when no delay is provided", () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const debounced = debounce(fn);
      debounced();
      vi.advanceTimersByTime(299);
      expect(fn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  // ─── parseMongoDBString ──────────────────────────────────────────────────────
  describe("parseMongoDBString", () => {
    it("should unwrap ISODate() and ObjectId() calls", () => {
      expect(parseMongoDBString('ObjectId("abc123")')).toBe('"abc123"');
      expect(parseMongoDBString('ISODate("2026-01-01")')).toBe('"2026-01-01"');
    });

    it("should unwrap $date objects", () => {
      expect(parseMongoDBString('{ "$date": "2026-01-01" }')).toBe('"2026-01-01"');
    });

    it("should unwrap NumberLong()", () => {
      expect(parseMongoDBString("NumberLong(42)")).toBe("42");
    });

    it("should leave plain strings untouched", () => {
      expect(parseMongoDBString("hello")).toBe("hello");
    });
  });

  // ─── checkValidDate ──────────────────────────────────────────────────────────
  describe("checkValidDate", () => {
    it("should return true for a modern valid date", () => {
      expect(checkValidDate("2026-01-01")).toBe(true);
    });
    it("should return false for an invalid date string", () => {
      expect(checkValidDate("not-a-date")).toBe(false);
    });
    it("should return false for a date before 1900-01-01", () => {
      expect(checkValidDate("1899-12-31")).toBe(false);
    });
    it("should accept a Date object", () => {
      expect(checkValidDate(new Date(2026, 0, 1))).toBe(true);
    });
  });

  // ─── deepEqual ───────────────────────────────────────────────────────────────
  describe("deepEqual", () => {
    it("should return true for identical primitives", () => {
      expect(deepEqual(1, 1)).toBe(true);
      expect(deepEqual("x", "x")).toBe(true);
    });
    it("should return false when one is null", () => {
      expect(deepEqual(null, {})).toBe(false);
      expect(deepEqual({}, null)).toBe(false);
    });
    it("should return false for primitive vs object", () => {
      expect(deepEqual(1, {})).toBe(false);
    });
    it("should compare nested objects deeply", () => {
      expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
      expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
    });
    it("should return false when key counts differ", () => {
      expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });
    it("should return false when a key is missing in the other", () => {
      expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
    });
    it("should treat arrays element-wise", () => {
      expect(deepEqual([1, 2], [1, 2])).toBe(true);
      expect(deepEqual([1, 2], [2, 1])).toBe(false);
    });
  });

  // ─── clearQueryString ────────────────────────────────────────────────────────
  describe("clearQueryString", () => {
    it("should strip all query params by default", () => {
      window.history.replaceState(null, "", "/page?a=1&b=2");
      clearQueryString();
      expect(window.location.search).toBe("");
    });

    it("should keep only the params in `except`", () => {
      window.history.replaceState(null, "", "/page?a=1&b=2&c=3");
      clearQueryString({ except: ["b"] });
      const params = new URLSearchParams(window.location.search);
      expect(params.get("b")).toBe("2");
      expect(params.get("a")).toBeNull();
      expect(params.get("c")).toBeNull();
    });

    it("should ignore `except` keys not present in the URL", () => {
      window.history.replaceState(null, "", "/page?a=1");
      clearQueryString({ except: ["missing"] });
      expect(window.location.search).toBe("");
    });
  });

  // ─── getUniqueID ─────────────────────────────────────────────────────────────
  describe("getUniqueID", () => {
    it("should produce a BLK-prefixed id with 6 uppercase letters", () => {
      const id = getUniqueID();
      expect(id).toMatch(/^BLK-\d+-[A-Z]{6}$/);
    });

    it("should produce different ids on subsequent calls", () => {
      const a = getUniqueID();
      const b = getUniqueID();
      // timestamp or random letters differ
      expect(a).not.toBe(b);
    });
  });

  // ─── formatSize ──────────────────────────────────────────────────────────────
  describe("formatSize", () => {
    it("should format bytes without promotion", () => {
      expect(formatSize(512)).toBe("512 B");
    });
    it("should promote to KB", () => {
      expect(formatSize(2048)).toBe("2 KB");
    });
    it("should promote to MB", () => {
      expect(formatSize(1048576)).toBe("1 MB");
    });
    it("should respect a non-byte input unit", () => {
      expect(formatSize(1, "GB")).toBe("1 GB");
    });
    it("should respect the decimals argument", () => {
      expect(formatSize(1536, "B", 1)).toBe("1.5 KB");
    });
    it("should cap promotion at TB", () => {
      expect(formatSize(5, "TB")).toBe("5 TB");
    });
  });
});
