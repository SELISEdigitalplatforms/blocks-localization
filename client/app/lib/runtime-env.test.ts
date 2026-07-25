import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getRuntimeEnv } from "@/lib/runtime-env";

describe("lib/runtime-env", () => {
  const originalWindowEnv = (window as unknown as { __BLOCKS_ENV__?: unknown }).__BLOCKS_ENV__;

  beforeEach(() => {
    delete (window as unknown as { __BLOCKS_ENV__?: unknown }).__BLOCKS_ENV__;
  });
  afterEach(() => {
    if (originalWindowEnv === undefined) {
      delete (window as unknown as { __BLOCKS_ENV__?: unknown }).__BLOCKS_ENV__;
    } else {
      (window as unknown as { __BLOCKS_ENV__?: unknown }).__BLOCKS_ENV__ = originalWindowEnv;
    }
    vi.unstubAllGlobals();
  });

  // ─── placeholder detection ───────────────────────────────────────────────
  describe("placeholder detection (internal isPlaceholder)", () => {
    it("should fall through to import.meta.env when window value matches __BLOCKS_*__ placeholder", () => {
      vi.stubEnv("BLOCKS_GOOGLE_SITE_KEY", "vite-value");
      (window as unknown as { __BLOCKS_ENV__?: unknown }).__BLOCKS_ENV__ = {
        BLOCKS_GOOGLE_SITE_KEY: "__BLOCKS_GOOGLE_SITE_KEY__",
      };
      expect(getRuntimeEnv("BLOCKS_GOOGLE_SITE_KEY")).toBe("vite-value");
    });

    it("should fall through when window value is just the prefix (empty string after)", () => {
      vi.stubEnv("BLOCKS_GOOGLE_SITE_KEY", "vite-value");
      // "startsWith __BLOCKS_" is true; "endsWith __" is false → NOT a placeholder.
      (window as unknown as { __BLOCKS_ENV__?: unknown }).__BLOCKS_ENV__ = {
        BLOCKS_GOOGLE_SITE_KEY: "__BLOCKS_NO_SUFFIX",
      };
      expect(getRuntimeEnv("BLOCKS_GOOGLE_SITE_KEY")).toBe("__BLOCKS_NO_SUFFIX");
    });

    it("should fall through when window value is the suffix only", () => {
      vi.stubEnv("BLOCKS_GOOGLE_SITE_KEY", "vite-value");
      // startsWith false, endsWith true → NOT a placeholder.
      (window as unknown as { __BLOCKS_ENV__?: unknown }).__BLOCKS_ENV__ = {
        BLOCKS_GOOGLE_SITE_KEY: "JUST_SUFFIX__",
      };
      expect(getRuntimeEnv("BLOCKS_GOOGLE_SITE_KEY")).toBe("JUST_SUFFIX__");
    });

    it("should fall through for empty string in window", () => {
      vi.stubEnv("BLOCKS_GOOGLE_SITE_KEY", "vite-value");
      (window as unknown as { __BLOCKS_ENV__?: unknown }).__BLOCKS_ENV__ = { BLOCKS_GOOGLE_SITE_KEY: "" };
      // !!"" is false → not a placeholder → but also falsy → skip branch.
      expect(getRuntimeEnv("BLOCKS_GOOGLE_SITE_KEY")).toBe("vite-value");
    });
  });

  // ─── window passthrough ──────────────────────────────────────────────────
  describe("window passthrough", () => {
    it("should return the window value directly (not the placeholder path) when valid", () => {
      // Line 52 coverage: returns windowValue when valid + non-placeholder.
      (window as unknown as { __BLOCKS_ENV__?: unknown }).__BLOCKS_ENV__ = {
        BLOCKS_GOOGLE_SITE_KEY: "real-window-value",
      };
      expect(getRuntimeEnv("BLOCKS_GOOGLE_SITE_KEY")).toBe("real-window-value");
    });

    it("should not look at import.meta.env when a valid window value exists", () => {
      vi.stubEnv("BLOCKS_GOOGLE_SITE_KEY", "vite-value");
      (window as unknown as { __BLOCKS_ENV__?: unknown }).__BLOCKS_ENV__ = {
        BLOCKS_GOOGLE_SITE_KEY: "wins",
      };
      expect(getRuntimeEnv("BLOCKS_GOOGLE_SITE_KEY")).toBe("wins");
    });
  });

  // ─── SSR safety ──────────────────────────────────────────────────────────
  describe("SSR safety (no window)", () => {
    it("should not throw when window is undefined", () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error: forcing non-browser-like environment for this test only
      delete (globalThis as unknown as { window?: unknown }).window;
      try {
        vi.stubEnv("BLOCKS_GOOGLE_SITE_KEY", "vite-value");
        expect(getRuntimeEnv("BLOCKS_GOOGLE_SITE_KEY")).toBe("vite-value");
      } finally {
        (globalThis as unknown as { window?: unknown }).window = originalWindow;
      }
    });
  });

  // ─── import.meta.env fallback ────────────────────────────────────────────
  describe("import.meta.env fallback", () => {
    it("should fall back to vite env when window env is absent", () => {
      vi.stubEnv("BLOCKS_GOOGLE_SITE_KEY", "vite-value");
      expect(getRuntimeEnv("BLOCKS_GOOGLE_SITE_KEY")).toBe("vite-value");
    });

    it("should return empty string when neither source provides the value", () => {
      expect(getRuntimeEnv("BLOCKS_PUBLIC_API_BASE_URL")).toBe("");
    });
  });

  // ─── __BLOCKS_ENV__ exists but key missing ───────────────────────────────
  describe("__BLOCKS_ENV__ present but key absent", () => {
    it("should fall back to import.meta.env when the key is not in window.__BLOCKS_ENV__", () => {
      vi.stubEnv("BLOCKS_GOOGLE_SITE_KEY", "vite-value");
      (window as unknown as { __BLOCKS_ENV__?: unknown }).__BLOCKS_ENV__ = { BLOCKS_OTHER_KEY: "irrelevant" };
      expect(getRuntimeEnv("BLOCKS_GOOGLE_SITE_KEY")).toBe("vite-value");
    });

    it("should return empty string when neither __BLOCKS_ENV__ nor import.meta.env has the key", () => {
      (window as unknown as { __BLOCKS_ENV__?: unknown }).__BLOCKS_ENV__ = { BLOCKS_OTHER_KEY: "irrelevant" };
      // Use a key that no prior test stubs to avoid cross-test env pollution.
      expect(getRuntimeEnv("BLOCKS_MONITOR_BASE_URL")).toBe("");
    });
  });
});
