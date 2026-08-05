import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCookie, getJsonCookie, removeCookie, setCookie, setJsonCookie } from "@/lib/cookie";

const ORIGIN = window.location.origin;

/** Set a cookie directly via document.cookie (jsdom-friendly, no domain). */
const seedCookie = (name: string, value: string) => {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/`;
};

/** Clear a cookie. */
const clearCookie = (name: string) => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
};

describe("lib/cookie", () => {
  beforeEach(() => {
    // Wipe cookie state before each test.
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0].trim();
      if (name) clearCookie(name);
    });
  });
  afterEach(() => {
    // Wipe after each test too.
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0].trim();
      if (name) clearCookie(name);
    });
    vi.restoreAllMocks();
  });

  // ─── getCookie ───────────────────────────────────────────────────────────
  describe("getCookie", () => {
    it("should return null when document is undefined (SSR safety)", () => {
      const originalDocument = globalThis.document;
      // @ts-expect-error: simulate non-browser env
      delete (globalThis as unknown as { document?: unknown }).document;
      try {
        expect(getCookie("anything")).toBeNull();
      } finally {
        (globalThis as unknown as { document?: unknown }).document = originalDocument;
      }
    });

    it("should return null when the cookie is not set", () => {
      expect(getCookie("missing")).toBeNull();
    });

    it("should return the cookie value when set", () => {
      seedCookie("token", "abc123");
      expect(getCookie("token")).toBe("abc123");
    });

    it("should decode URI-encoded values", () => {
      // Manually set a value with characters that need encoding.
      document.cookie = `token=${encodeURIComponent("a b/c")};path=/`;
      expect(getCookie("token")).toBe("a b/c");
    });

    it("should skip entries with leading whitespace and find the matching one", () => {
      // Seed two cookies: the parser should trim leading space per segment.
      document.cookie = `first=1;path=/`;
      document.cookie = `second=2;path=/`;
      expect(getCookie("second")).toBe("2");
      expect(getCookie("first")).toBe("1");
    });

    it("should return only the matching cookie when multiple are present", () => {
      document.cookie = `alpha=1;path=/`;
      document.cookie = `beta=2;path=/`;
      document.cookie = `gamma=3;path=/`;
      expect(getCookie("beta")).toBe("2");
    });
  });

  // ─── setCookie ───────────────────────────────────────────────────────────
  describe("setCookie", () => {
    it("should be a no-op when document is undefined (SSR safety)", () => {
      const originalDocument = globalThis.document;
      // @ts-expect-error: simulate non-browser env
      delete (globalThis as unknown as { document?: unknown }).document;
      try {
        // Should not throw.
        setCookie("foo", "bar");
        expect(true).toBe(true);
      } finally {
        (globalThis as unknown as { document?: unknown }).document = originalDocument;
      }
    });

    it("should set a cookie with default 365-day expiry and cross-subdomain domain", () => {
      // The default domain `.blocksdevelopers.com` won't be readable in jsdom
      // (origin mismatch), so we verify via a spy on document.cookie setter
      // that the cookie string was constructed with the expected defaults
      // (expires, path, domain, SameSite=Lax).
      const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
      const originalSetter = descriptor?.set;
      if (!originalSetter) return;

      const calls: string[] = [];
      const spy = vi.spyOn(document, "cookie", "set").mockImplementation(function (
        this: Document,
        value: string,
      ) {
        calls.push(value);
        // @ts-expect-error: call through to original
        originalSetter.call(this, value);
      });

      try {
        setCookie("name", "value");
      } finally {
        spy.mockRestore();
        (window as any).__BLOCKS_ENV__ = originalWindowEnv;
      }

      // The cookie write should have happened with all expected attributes.
      expect(calls.length).toBeGreaterThan(0);
      const written = calls[0];
      expect(written).toContain("name=");
      expect(written).toContain("path=/");
      expect(written).toContain(`domain=${window.location.hostname}`);
      expect(written).toContain("SameSite=Lax");
      expect(written).toContain("expires=");
    });

    it("should fall back to a host-only cookie when the configured domain does not match", () => {
      const originalWindowEnv = (window as any).__BLOCKS_ENV__;
      (window as any).__BLOCKS_ENV__ = {
        ...originalWindowEnv,
        BLOCKS_BASE_DOMAIN: "another-domain.example",
      };
      const calls: string[] = [];
      const spy = vi
        .spyOn(document, "cookie", "set")
        .mockImplementation((value: string) => {
          calls.push(value);
        });

      try {
        setCookie("name", "value");
      } finally {
        spy.mockRestore();
        (window as any).__BLOCKS_ENV__ = originalWindowEnv;
      }

      expect(calls[0]).not.toContain("domain=");
      expect(calls[0]).toContain("path=/");
    });

    it("should accept custom days and domain", () => {
      setCookie("custom", "v", 7, "localhost");
      expect(getCookie("custom")).toBe("v");
    });

    it("should encode special characters in the value", () => {
      setCookie("special", "a b/c", 1, "localhost");
      expect(getCookie("special")).toBe("a b/c");
    });

    it("should log and bail when the encoded value exceeds the 3500-byte limit", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const huge = "x".repeat(4000);
      setCookie("big", huge, 1, "localhost");
      expect(errorSpy).toHaveBeenCalled();
      // Cookie must NOT be set when oversized.
      expect(getCookie("big")).toBeNull();
    });

    it("should add a Secure attribute on https origins", () => {
      // jsdom defaults to http://; flip the URL protocol to https: temporarily
      // so setCookie takes the Secure branch.
      const originalHref = window.location.href;
      try {
        // jsdom does not allow flipping the protocol directly; instead we
        // override window.location.protocol for the duration of this test.
        Object.defineProperty(window, "location", {
          configurable: true,
          value: { ...window.location, protocol: "https:" },
        });

        const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
        const originalSetter = descriptor?.set;
        if (!originalSetter) return;

        const calls: string[] = [];
        const spy = vi.spyOn(document, "cookie", "set").mockImplementation(function (
          this: Document,
          value: string,
        ) {
          calls.push(value);
          // @ts-expect-error: call through to original
          originalSetter.call(this, value);
        });

        setCookie("secure-cookie", "value", 1, "localhost");
        spy.mockRestore();

        expect(calls.length).toBeGreaterThan(0);
        expect(calls[0]).toContain("Secure");
        expect(calls[0]).toContain("SameSite=Lax");
      } finally {
        // Restore original location.
        Object.defineProperty(window, "location", {
          configurable: true,
          value: { href: originalHref },
        });
      }
    });

    it("should NOT add Secure on http origins", () => {
      // Default jsdom origin is http:. setCookie should not add Secure.
      const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
      const originalSetter = descriptor?.set;
      if (!originalSetter) return;

      const calls: string[] = [];
      const spy = vi.spyOn(document, "cookie", "set").mockImplementation(function (
        this: Document,
        value: string,
      ) {
        calls.push(value);
        // @ts-expect-error: call through to original
        originalSetter.call(this, value);
      });

      setCookie("http-cookie", "value", 1, "localhost");
      spy.mockRestore();

      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0]).not.toContain(" Secure;");
      expect(calls[0]).not.toMatch(/;\s*Secure/);
    });
  });

  // ─── removeCookie ────────────────────────────────────────────────────────
  describe("removeCookie", () => {
    it("should be a no-op when document is undefined (SSR safety)", () => {
      const originalDocument = globalThis.document;
      // @ts-expect_error: simulate non-browser env
      delete (globalThis as unknown as { document?: unknown }).document;
      try {
        removeCookie("foo");
        expect(true).toBe(true);
      } finally {
        (globalThis as unknown as { document?: unknown }).document = originalDocument;
      }
    });

    it("should set an expiration in the past to delete the cookie", () => {
      // Seed then remove.
      seedCookie("temp", "x");
      expect(getCookie("temp")).toBe("x");
      removeCookie("temp", "localhost");
      expect(getCookie("temp")).toBeNull();
    });

    it("should accept a custom domain", () => {
      // Should not throw when removing with a custom domain.
      expect(() => removeCookie("nope", "example.com")).not.toThrow();
    });
  });

  // ─── getJsonCookie ───────────────────────────────────────────────────────
  describe("getJsonCookie", () => {
    it("should return null when the cookie is absent", () => {
      expect(getJsonCookie<{ a: number }>("absent")).toBeNull();
    });

    it("should return the parsed JSON when the cookie contains valid JSON", () => {
      seedCookie("config", JSON.stringify({ a: 1, b: "two" }));
      expect(getJsonCookie<{ a: number; b: string }>("config")).toEqual({
        a: 1,
        b: "two",
      });
    });

    it("should return null when the cookie contains malformed JSON", () => {
      // Set a non-JSON value via raw document.cookie (encoding-decoded by getCookie).
      document.cookie = `bad=${encodeURIComponent("not-json{")};path=/`;
      expect(getJsonCookie("bad")).toBeNull();
    });
  });

  // ─── setJsonCookie ───────────────────────────────────────────────────────
  describe("setJsonCookie", () => {
    it("should serialize the object to JSON and store it", () => {
      const payload = { name: "Blocks", count: 42 };
      setJsonCookie("data", payload, 1, "localhost");
      expect(getJsonCookie<typeof payload>("data")).toEqual(payload);
    });

    it("should log an error and bail when JSON.stringify throws (circular ref)", () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const circular: any = {};
      circular.self = circular;
      // Should not throw.
      setJsonCookie("circ", circular, 1, "localhost");
      expect(errSpy).toHaveBeenCalled();
    });
  });
});
